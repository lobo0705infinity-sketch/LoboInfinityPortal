import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAriadnaBriefingPublisher, ARIADNA_BRIEFING, ARIADNA_BRIEFING_MARKER } from '../bot/aurora-ariadna-briefing.mjs'
import { AURORA_DISCORD_GUILD_ID } from '../shared/aurora-registration.mjs'
const directory = await mkdtemp(join(tmpdir(), 'ariadna-briefing-'))
try {
  assert(ARIADNA_BRIEFING.length <= 4096)
  let permission = false, sends = 0, pins = 0
  const messages = new Map()
  const channel = { id: '123456789012345678', name: 'ariadna',
    guild: { id: AURORA_DISCORD_GUILD_ID, members: { fetchMe: async () => ({ id: 'bot' }) } },
    permissionsFor: () => ({ has: () => permission }),
    messages: { fetch: async input => typeof input === 'string' ? messages.get(input) : messages },
    send: async payload => {
      sends++; assert.deepEqual(payload.allowedMentions, { parse: [] })
      assert.equal(payload.embeds[0].description, ARIADNA_BRIEFING)
      assert.equal(payload.embeds[0].footer.text, ARIADNA_BRIEFING_MARKER)
      const message = { id: '234567890123456789', author: { id: 'bot' }, embeds: payload.embeds, pinned: false, pin: async () => { pins++; message.pinned = true } }
      messages.set(message.id, message); return message
    },
  }
  const path = join(directory, 'publication.json'), publish = createAriadnaBriefingPublisher({ path })
  const pending = await publish(channel, 'bot')
  assert.equal(pending.posted, true); assert.equal(pending.pinned, false); assert.equal(pending.needsManageMessages, true)
  assert.equal(sends, 1); assert.equal(pins, 0)
  permission = true
  const result = await createAriadnaBriefingPublisher({ path })(channel, 'bot')
  assert.equal(result.pinned, true); assert.equal(sends, 1); assert.equal(pins, 1)
  assert(result.url.endsWith('/123456789012345678/234567890123456789'))
  await createAriadnaBriefingPublisher({ path })(channel, 'bot')
  assert.equal(sends, 1); assert.equal(pins, 1)
  // Lost checkpoint after sending recovers from the actual bot-authored draft.
  await createAriadnaBriefingPublisher({ path: join(directory, 'recovered.json') })(channel, 'bot')
  assert.equal(sends, 1)
  await assert.rejects(publish({ ...channel, name: 'pano' }, 'bot'), /only in its campaign/)
  await assert.rejects(publish({ ...channel, guild: { id: 'other' } }, 'bot'), /only in its campaign/)
  console.log('PASS: exact approved draft, single message within embed limit, no mentions, Ariadna/server scope, durable duplicate protection, permission-gated pin, verified pin and restart recovery.')
} finally { await rm(directory, { recursive: true, force: true }) }
