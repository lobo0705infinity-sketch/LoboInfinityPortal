import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AURORA_FACTION_BRIEFINGS, YU_JING_BRIEFING } from '../bot/aurora-faction-briefings.mjs'
import { createFactionBriefingPublisher } from '../bot/aurora-faction-briefing-publisher.mjs'
import { ARIADNA_BRIEFING_MARKER, ARIADNA_BRIEFING } from '../bot/aurora-ariadna-briefing.mjs'
import { AURORA_REGISTRATION_FACTIONS, AURORA_DISCORD_GUILD_ID } from '../shared/aurora-registration.mjs'
import { AURORA_DOCTRINES } from '../shared/aurora-public.mjs'
const directory = await mkdtemp(join(tmpdir(), 'faction-briefings-'))
try {
  assert.deepEqual(AURORA_FACTION_BRIEFINGS.map(item => item.id), AURORA_REGISTRATION_FACTIONS.filter(item => item.id !== 'nomads').map(item => item.id))
  assert.equal(new Set(AURORA_FACTION_BRIEFINGS.map(item => item.marker)).size, 10)
  assert.equal(new Set(AURORA_FACTION_BRIEFINGS.map(item => item.path)).size, 10)
  const ariadna = AURORA_FACTION_BRIEFINGS.find(item => item.id === 'ariadna')
  assert.equal(ariadna.content, ARIADNA_BRIEFING); assert.equal(ariadna.marker, ARIADNA_BRIEFING_MARKER)
  assert.equal(ariadna.path, '/data/aurora-vii-ariadna-briefing.json')
  assert.equal(AURORA_FACTION_BRIEFINGS.find(item => item.id === 'yu-jing').content, YU_JING_BRIEFING)
  let sends = 0, pins = 0
  for (const faction of AURORA_FACTION_BRIEFINGS) {
    assert(faction.content.length <= 4096); assert(faction.content.length >= 1500)
    assert(!/join the expedition|register for|Gate Awakens|synchronization heartbeat|Gate remains dormant|unknown destination/i.test(faction.content))
    assert(faction.content.includes('Before each game'))
    const doctrine = AURORA_DOCTRINES.find(item => item.faction === faction.name)
    if (doctrine) { assert(faction.content.includes(doctrine.name)); assert(faction.content.includes('three times')) }
    const messages = new Map(), path = join(directory, `${faction.id}.json`)
    const channel = { id: String(12345678900000000n + BigInt(sends)), name: faction.id,
      guild: { id: AURORA_DISCORD_GUILD_ID, members: { fetchMe: async () => ({ id: 'bot' }) } }, permissionsFor: () => ({ has: () => true }),
      messages: { fetch: async input => typeof input === 'string' ? messages.get(input) : messages },
      send: async payload => {
        sends++; assert.equal(payload.embeds[0].description, faction.content); assert.equal(payload.embeds[0].footer.text, faction.marker)
        assert.deepEqual(payload.allowedMentions, { parse: [] })
        const message = { id: String(22345678900000000n + BigInt(sends)), author: { id: 'bot' }, embeds: payload.embeds, pinned: false, pin: async () => { pins++; message.pinned = true } }
        messages.set(message.id, message); return message
      },
    }
    const publish = createFactionBriefingPublisher({ ...faction, path, factionId: faction.id })
    const result = await publish(channel, 'bot'); assert(result.posted && result.pinned)
    assert(result.url.includes(`/${channel.id}/`))
    await publish(channel, 'bot')
    await createFactionBriefingPublisher({ ...faction, path, factionId: faction.id })(channel, 'bot')
    await assert.rejects(publish({ ...channel, name: faction.id === 'pano' ? 'ariadna' : 'pano' }, 'bot'), /only in its campaign/)
    await assert.rejects(publish({ ...channel, guild: { id: 'foreign' } }, 'bot'), /only in its campaign/)
  }
  assert.equal(sends, 10); assert.equal(pins, 10)
  const na2 = AURORA_FACTION_BRIEFINGS.find(item => item.id === 'na2').content
  assert(na2.includes('every non-Employer faction') && na2.includes('Employer’s totals are ignored'))
  const tohaa = AURORA_FACTION_BRIEFINGS.find(item => item.id === 'tohaa').content
  assert(tohaa.includes('complete 5 Tohaa TP') && tohaa.includes('Remainder TP does not carry over'))
  const ca = AURORA_FACTION_BRIEFINGS.find(item => item.id === 'combined-army').content
  assert(ca.includes('does not change normal territorial ownership') && ca.includes('not already Infiltrated'))
  console.log('PASS: ten faction-specific briefings, exact channel/server routing, Conquest doctrines, three special scoring systems, no future reveals, embed limits, approved Ariadna reuse, no mentions, verified pins and restart idempotence.')
} finally { await rm(directory, { recursive: true, force: true }) }
