import { ChannelType, PermissionFlagsBits as P, OverwriteType } from 'discord.js'
import { AURORA_REGISTRATION_FACTIONS, AURORA_DISCORD_GUILD_ID } from '../shared/aurora-registration.mjs'

export const AURORA_FACTION_CATEGORY = 'Aurora VII — Factions'
const playerPermissions = P.ViewChannel | P.SendMessages | P.ReadMessageHistory | P.EmbedLinks | P.AttachFiles
const entry = (id, type, allow = 0n, deny = 0n) => ({ id, type, allow, deny })
function sameOverwrites(channel, expected) {
  const current = [...channel.permissionOverwrites.cache.values()]
  return current.length === expected.length && expected.every(value => current.some(item => item.id === value.id && item.type === value.type && item.allow.bitfield === value.allow && item.deny.bitfield === value.deny))
}
async function enforce(channel, expected) {
  if (!sameOverwrites(channel, expected)) await channel.permissionOverwrites.set(expected, 'Restrict Aurora VII faction channel access')
}

export async function provisionFactionChannels(guild, roles) {
  if (guild.id !== AURORA_DISCORD_GUILD_ID) throw Error('Faction channels belong only in Lobo’s server.')
  const me = await guild.members.fetchMe()
  if (!me.permissions.has(P.ManageChannels) || !me.permissions.has(P.ManageRoles)) throw Error('Lobo’s Little Helper needs Manage Channels and Manage Roles to create private faction channels.')
  if (roles.size !== 10) throw Error('All ten campaign roles must be ready before faction channels are created.')
  const channels = await guild.channels.fetch()
  const categories = [...channels.values()].filter(channel => channel?.type === ChannelType.GuildCategory && channel.name === AURORA_FACTION_CATEGORY)
  if (categories.length > 1) throw Error('Duplicate Aurora VII faction categories need to be resolved by Lobo.')
  const base = [entry(guild.id, OverwriteType.Role, 0n, P.ViewChannel), entry(me.id, OverwriteType.Member, playerPermissions)]
  const category = categories[0] || await guild.channels.create({ name: AURORA_FACTION_CATEGORY, type: ChannelType.GuildCategory, permissionOverwrites: base, reason: 'Aurora VII private faction coordination' })
  await enforce(category, base)
  const result = new Map()
  for (const faction of AURORA_REGISTRATION_FACTIONS) {
    const role = roles.get(faction.id)
    const expected = [...base, entry(role.id, OverwriteType.Role, playerPermissions)]
    const matches = [...channels.values()].filter(channel => channel?.parentId === category.id && channel.name === faction.id)
    if (matches.length > 1 || (matches[0] && matches[0].type !== ChannelType.GuildText)) throw Error('Ambiguous faction channels need to be resolved by Lobo.')
    const channel = matches[0] || await guild.channels.create({ name: faction.id, type: ChannelType.GuildText, parent: category.id,
      topic: `Private Aurora VII coordination for ${faction.name}. Access follows the Aurora VII — ${faction.name} campaign role.`,
      permissionOverwrites: expected, reason: 'Aurora VII faction registration access',
    })
    await enforce(channel, expected)
    result.set(faction.id, channel.id)
  }
  // Fetch actual Discord state after creation/updates before reporting ready.
  const verified = await guild.channels.fetch()
  for (const faction of AURORA_REGISTRATION_FACTIONS) {
    const channel = verified.get(result.get(faction.id))
    if (!channel || channel.parentId !== category.id || !sameOverwrites(channel, [...base, entry(roles.get(faction.id).id, OverwriteType.Role, playerPermissions)])) throw Error('Discord faction channel access verification failed.')
  }
  return result
}
