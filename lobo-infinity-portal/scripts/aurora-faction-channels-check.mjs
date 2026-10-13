import assert from 'node:assert/strict'
import { ChannelType, PermissionFlagsBits as P, OverwriteType } from 'discord.js'
import { provisionFactionChannels, AURORA_FACTION_CATEGORY } from '../bot/aurora-faction-channels.mjs'
import { AURORA_REGISTRATION_FACTIONS as factions, AURORA_DISCORD_GUILD_ID } from '../shared/aurora-registration.mjs'

const roles = new Map(factions.map((faction, index) => [faction.id, { id: `role-${index}` }]))
const channels = new Map(), created = []
let permitted = true, updates = 0
function overwriteCache(values) { return new Map(values.map(value => [value.id, { ...value, allow: { bitfield: value.allow }, deny: { bitfield: value.deny } }])) }
const guild = {
  id: AURORA_DISCORD_GUILD_ID,
  members: { fetchMe: async () => ({ id: 'bot-member', permissions: { has: () => permitted } }) },
  channels: {
    fetch: async () => channels,
    create: async options => {
      created.push(options)
      const channel = { id: `channel-${created.length}`, name: options.name, type: options.type, parentId: options.parent || null,
        permissionOverwrites: { cache: overwriteCache(options.permissionOverwrites), set: async values => { updates++; channel.permissionOverwrites.cache = overwriteCache(values) } },
      }
      channels.set(channel.id, channel); return channel
    },
  },
}
const provisioned = await provisionFactionChannels(guild, roles)
assert.equal(provisioned.size, 10); assert.equal(created.length, 11)
assert.equal(created[0].name, AURORA_FACTION_CATEGORY); assert.equal(created[0].type, ChannelType.GuildCategory)
for (const faction of factions) {
  const channel = channels.get(provisioned.get(faction.id))
  assert.equal(channel.type, ChannelType.GuildText)
  assert.equal(channel.parentId, 'channel-1')
  const overwrites = [...channel.permissionOverwrites.cache.values()]
  assert.equal(overwrites.length, 3)
  const everyone = overwrites.find(value => value.id === guild.id)
  assert.equal(everyone.type, OverwriteType.Role); assert(everyone.deny.bitfield & P.ViewChannel)
  const eligible = overwrites.find(value => value.id === roles.get(faction.id).id)
  assert(eligible.allow.bitfield & P.ViewChannel); assert(eligible.allow.bitfield & P.SendMessages)
  assert(overwrites.some(value => value.id === 'bot-member' && value.type === OverwriteType.Member))
  assert(!overwrites.some(value => [...roles.values()].some(role => role.id === value.id && role.id !== roles.get(faction.id).id)))
}
await provisionFactionChannels(guild, roles)
assert.equal(created.length, 11); assert.equal(updates, 0)
// An accidental extra faction grant is removed, without recreating channels.
channels.get(provisioned.get('pano')).permissionOverwrites.cache.set('wrong-role', { id: 'wrong-role', type: OverwriteType.Role, allow: { bitfield: P.ViewChannel }, deny: { bitfield: 0n } })
await provisionFactionChannels(guild, roles); assert.equal(updates, 1)
permitted = false
await assert.rejects(provisionFactionChannels(guild, roles), /Manage Channels/)
assert.equal(created.length, 11)
await assert.rejects(provisionFactionChannels({ ...guild, id: 'another-server' }, roles), /Lobo’s server/)
console.log('PASS: ten text channels in one private category, exact role access, bot maintenance access, no cross-faction grants, idempotence, overwrite repair, permission gating and server scope.')
