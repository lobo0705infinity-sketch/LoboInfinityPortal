import { readFile, mkdir, open, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PermissionFlagsBits } from 'discord.js'
import { AURORA_DISCORD_GUILD_ID } from '../shared/aurora-registration.mjs'

export const ARIADNA_BRIEFING_MARKER = 'Aurora VII · Ariadna faction briefing · v1'
export const ARIADNA_BRIEFING = `## 🐺 ARIADNA — FACTION BRIEFING
**Aurora VII: Race for the Gate**

Welcome to Ariadna’s campaign headquarters. Use this channel to coordinate games, discuss targets, share lists, and keep our plans within the faction.

**Why we’re here**
Our settlers, prospectors, and expedition crews have already made lives on Aurora VII’s frontier. Those communities need supplies, safe routes, and protection as rival powers compete for control.

We fight to ensure the people who helped settle this world have a say in its future.

**How we win**
Ariadna uses territorial **Conquest**:

• Every **Tournament Point generates 1 Influence** in the territory where that game was reported.
• Only the Turn’s announced **Vulnerable Territories** can change hands.
• Highest faction Influence controls the territory at Turn end. **Objective Points break ties**; a complete tie preserves the current controller.
• Territories held **at the end of Turn 6** award their printed Campaign VP.

**Our Doctrine: Frontier Masters**
Capture or successfully defend a **1 VP territory** to earn **+1 Campaign VP**—once per Turn, up to three times across the campaign.

The 1 VP territories are **Ember Highlands, Sulfur Basin, Frostreach Wastes, Northward Expanse, and Iron Corridor**. They become possible Doctrine targets when announced as Vulnerable.

**Our approach**
Coordinate before spreading our games across the map. Securing a Doctrine target can earn a bonus, but higher-value territories also matter for the final score. Choose priorities together based on each Turn’s announced situation.

Narrative Mission games contribute to a **separate faction total**, not territorial Influence. Decide together how much effort to commit to each contest.

**Keep our plans here**
Discuss targets, match scheduling, and any GM-issued Secret Objective in this channel. Don’t share private objectives or faction briefings outside it.

**Before each game:** confirm the mission, Campaign Location, and current Event rules. Afterwards, report the result accurately.

**Protect our people. Hold the frontier.**`

export function createAriadnaBriefingPublisher({ path = '/data/aurora-vii-ariadna-briefing.json' } = {}) {
  let completed
  const link = (channelId, messageId) => `https://discord.com/channels/${AURORA_DISCORD_GUILD_ID}/${channelId}/${messageId}`
  async function save(record) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${randomUUID()}.tmp`, file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(JSON.stringify(record)); await file.sync() } finally { await file.close() }
    await rename(temporary, path)
  }
  return async function publish(channel, botUserId) {
    if (channel.guild.id !== AURORA_DISCORD_GUILD_ID || channel.name !== 'ariadna') throw Error('Ariadna briefing must be posted only in its campaign faction channel.')
    if (completed) return completed
    let record
    try {
      record = JSON.parse(await readFile(path, 'utf8'))
      if (record.marker !== ARIADNA_BRIEFING_MARKER || record.channelId !== channel.id || !/^\d+$/.test(record.messageId) || typeof record.pinned !== 'boolean') throw Error('Invalid briefing publication record.')
    } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (record?.pinned) return completed = { posted: true, pinned: true, url: link(channel.id, record.messageId) }
    const matchesBriefing = message => message.author?.id === botUserId && message.embeds?.some(embed => embed.footer?.text === ARIADNA_BRIEFING_MARKER && embed.description === ARIADNA_BRIEFING)
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
      if (matches.length > 1) throw Error('Duplicate Ariadna briefing messages need review before pinning.')
      message = matches[0] || await channel.send({ embeds: [{ description: ARIADNA_BRIEFING, color: 0x71854a, footer: { text: ARIADNA_BRIEFING_MARKER } }], allowedMentions: { parse: [] } })
      record = { marker: ARIADNA_BRIEFING_MARKER, channelId: channel.id, messageId: message.id, pinned: false }
      await save(record)
    }
    const me = await channel.guild.members.fetchMe()
    if (!message.pinned && !channel.permissionsFor(me).has(PermissionFlagsBits.ManageMessages)) return { posted: true, pinned: false, needsManageMessages: true, url: link(channel.id, message.id) }
    if (!message.pinned) await message.pin('Commissioner requested the Ariadna faction briefing be pinned')
    const verified = await channel.messages.fetch(message.id)
    if (!verified.pinned || !matchesBriefing(verified)) throw Error('Ariadna briefing pin could not be verified.')
    await save({ ...record, pinned: true })
    // This is a one-time authorized publication, not a rule that overrides a
    // moderator's later choice to edit or unpin the message.
    return completed = { posted: true, pinned: true, url: link(channel.id, message.id) }
  }
}
