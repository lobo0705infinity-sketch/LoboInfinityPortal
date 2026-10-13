import { readFile, mkdir, open, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PermissionFlagsBits } from 'discord.js'
import { AURORA_DISCORD_GUILD_ID, AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'

export function createFactionBriefingPublisher({ path, factionId, marker, content, color = 0x71854a }) {
  if (!AURORA_REGISTRATION_FACTIONS.some(faction => faction.id === factionId) || !path || !marker || typeof content !== 'string' || !content || content.length > 4096) throw Error('Invalid faction briefing configuration.')
  let completed
  const link = (channelId, messageId) => `https://discord.com/channels/${AURORA_DISCORD_GUILD_ID}/${channelId}/${messageId}`
  async function save(record) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${randomUUID()}.tmp`, file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(JSON.stringify(record)); await file.sync() } finally { await file.close() }
    await rename(temporary, path)
  }
  return async function publish(channel, botUserId) {
    if (channel.guild.id !== AURORA_DISCORD_GUILD_ID || channel.name !== factionId) throw Error('Faction briefing must be posted only in its campaign faction channel.')
    if (completed) return completed
    let record
    try {
      record = JSON.parse(await readFile(path, 'utf8'))
      if (record.marker !== marker || record.channelId !== channel.id || !/^\d+$/.test(record.messageId) || typeof record.pinned !== 'boolean') throw Error('Invalid briefing publication record.')
    } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (record?.pinned) return completed = { posted: true, pinned: true, url: link(channel.id, record.messageId) }
    const matchesBriefing = message => message.author?.id === botUserId && message.embeds?.some(embed => embed.footer?.text === marker && embed.description === content)
    let message
    if (record) {
      message = await channel.messages.fetch(record.messageId)
      if (!matchesBriefing(message)) throw Error('Stored briefing message does not match the authorized draft.')
    } else {
      let matches = [], before
      for (let page = 0; page < 50; page++) {
        const recent = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) })
        matches = [...recent.values()].filter(matchesBriefing)
        if (matches.length || recent.size < 100) break
        if (page === 49) throw Error('Briefing history could not be checked completely; posting deferred to avoid duplicates.')
        before = recent.last().id
      }
      if (matches.length > 1) throw Error('Duplicate Faction briefing messages need review before pinning.')
      message = matches[0] || await channel.send({ embeds: [{ description: content, color, footer: { text: marker } }], allowedMentions: { parse: [] } })
      record = { marker: marker, channelId: channel.id, messageId: message.id, pinned: false }
      await save(record)
    }
    const me = await channel.guild.members.fetchMe()
    if (!message.pinned && !channel.permissionsFor(me).has(PermissionFlagsBits.ManageMessages)) return { posted: true, pinned: false, needsManageMessages: true, url: link(channel.id, message.id) }
    if (!message.pinned) await message.pin('Commissioner requested the faction briefing be pinned')
    const verified = await channel.messages.fetch(message.id)
    if (!verified.pinned || !matchesBriefing(verified)) throw Error('Faction briefing pin could not be verified.')
    await save({ ...record, pinned: true })
    // This is a one-time authorized publication, not a rule that overrides a
    // moderator's later choice to edit or unpin the message.
    return completed = { posted: true, pinned: true, url: link(channel.id, message.id) }
  }
}
