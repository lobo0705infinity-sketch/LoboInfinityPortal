import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Reproduce Vercel's isolated function filesystem: no src/ or scripts/.
const isolated = await mkdtemp(join(tmpdir(), 'lobo-story-package-'))
const priorToken = process.env.ARMY_INTELLIGENCE_WORKER_TOKEN
try {
  await mkdir(join(isolated, '_lib'))
  await copyFile(new URL('../api/game-story-for-discord.mjs', import.meta.url), join(isolated, 'handler.mjs'))
  await copyFile(new URL('../api/_lib/game-story-handler.mjs', import.meta.url), join(isolated, '_lib/game-story-handler.mjs'))
  const { default: handler } = await import(pathToFileURL(join(isolated, 'handler.mjs')))
  const invoke = async request => {
    const reply = {}
    await handler(request, { setHeader() {}, status(code) { reply.status = code; return this },
      json(body) { reply.body = body } })
    return reply
  }
  assert.equal((await invoke({ method: 'GET' })).status, 405)
  process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = 'package-test-token'
  assert.equal((await invoke({ method: 'POST', headers: {} })).status, 401)
  const reply = await invoke({ method: 'POST', headers: { authorization: 'Bearer package-test-token' },
    body: { game: { id: 123, date: '2026-10-04', mission: 'The Dig',
      winner: 'Defuser', loser: 'xtapro', winnerFaction: 'USAriadna Ranger Force', loserFaction: 'O-12',
      tp: '4–1', op: '2–0', vp: '171–64', winnerArmyListId: '', loserArmyListId: '' }, lists: [] } })
  assert.equal(reply.status, 200)
  assert.equal(reply.body.success, true)
  assert.match(reply.body.story, /Defuser/)
  assert.match(reply.body.story, /xtapro/)
  assert.equal(reply.body.rosterless, true)
  console.log('Discord story packaging PASS: isolated runtime loads, authenticates, and generates a report')
} finally {
  if (priorToken === undefined) delete process.env.ARMY_INTELLIGENCE_WORKER_TOKEN
  else process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = priorToken
  await rm(isolated, { recursive: true, force: true })
}
