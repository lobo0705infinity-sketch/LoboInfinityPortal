import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import handler from '../api/army-intelligence-refresh-worker.mjs'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }
const sources = [{ snapshotKey: 'source:1', armyCode: 'secret-code', armyListId: 'list-1', player: 'Player', sourceId: '42', sourcePlayer: 'Player', faction: 'Ariadna', sectorial: 'Caledonia', sourceType: 'league', mission: 'must-not-export' }]
let sourceFetches = 0
let mutationCalls = 0

process.env.VITE_API_URL = 'https://apps.example.test/exec'
process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = 'worker-secret'
process.env.ARMY_INTELLIGENCE_BACKFILL_TOKEN = 'backfill-secret'
globalThis.fetch = async (input, init = {}) => {
  if (init.method === 'POST') mutationCalls += 1
  const action = new URL(String(input)).searchParams.get('action')
  if (action === 'armyIntelligenceSources') {
    sourceFetches += 1
    return Response.json({ success: true, sources })
  }
  if (action === 'armyIntelligence') return Response.json({ success: true, lists: [] })
  throw new Error(`Unexpected fetch: ${input}`)
}

try {
  const unauthorized = await invoke({ exportSources: true })
  assert.equal(unauthorized.statusCode, 401)
  assert.equal(sourceFetches, 0)

  const ordinary = await invoke({ dryRun: true }, 'backfill-secret')
  assert.equal(ordinary.statusCode, 200)
  assert.equal(JSON.stringify(ordinary.body).includes('secret-code'), false, 'ordinary responses must not expose army codes')

  const exported = await invoke({ exportSources: true }, 'backfill-secret')
  assert.equal(exported.statusCode, 200)
  assert.deepEqual(exported.body.sources, [{ snapshotKey: 'source:1', armyCode: 'secret-code', armyListId: 'list-1', player: 'Player', sourceId: '42', sourcePlayer: 'Player', faction: 'Ariadna', sectorial: 'Caledonia', sourceType: 'league' }])
  assert.equal(exported.body.totalDistinctLists, 1)
  assert.equal(mutationCalls, 0, 'source export must perform zero mutation calls')
  console.log('Army Intelligence authenticated source export checks passed.')
} finally {
  globalThis.fetch = originalFetch
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
}

async function invoke(body, token = '') {
  const request = Readable.from([Buffer.from(JSON.stringify(body))])
  request.method = 'POST'
  request.headers = token ? { 'x-army-backfill-token': token } : {}
  const result = { body: null, statusCode: 200 }
  const response = {
    setHeader() {},
    status(code) { result.statusCode = code; return this },
    json(value) { result.body = value; return this },
  }
  await handler(request, response)
  return result
}
