import fs from 'node:fs'

const expectedId = '20260831T045141Z'
const origin = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
const files = ['snapshot.json','players.json','games.json','events.json','missions.json','factions.json','standings.json','army-lists.json','army-intelligence-summary.json','army-intelligence-detail.json','schedule.json','statistics.json','community.json']
const client = fs.readFileSync(new URL('../src/services/publicSnapshot.ts', import.meta.url), 'utf8')

const response = await fetch(`${origin}public-snapshots/current.json`, { cache: 'no-store' })
assert(response.ok, 'current.json is publicly readable')
const pointer = await response.json()
assert(pointer.schemaVersion === 1, 'pointer schema version')
assert(pointer.snapshotId === expectedId, 'pointer snapshot ID')
assert(pointer.sourceCutoff === '2026-08-31T04:51:47.860Z', 'pointer source cutoff')
assert(pointer.basePath === `public-snapshots/${expectedId}/`, 'pointer base path')
assert(!Object.keys(pointer).some((key) => /token|secret|credential|drive|commissioner/i.test(key)), 'pointer contains no sensitive keys')

const statuses = await Promise.all(files.map(async (file) => {
  const result = await fetch(new URL(`${pointer.basePath}${file}`, origin), { method: 'HEAD' })
  return [file, result.status]
}))
assert(statuses.every(([, status]) => status === 200), 'all 13 referenced files exist')

assert(client.includes('let pointerPromise'), 'one module-level session pointer promise')
assert(client.includes('if (pointerPromise) return pointerPromise'), 'pointer fetched once per session')
assert(client.includes('pointer.basePath'), 'dataset URLs use pinned base path')
assert(client.includes('envelope.snapshotId !== pointer.snapshotId'), 'dataset generations checked against pinned pointer')
assert(!/setInterval|setTimeout|WebSocket|EventSource/.test(client), 'no polling or push refresh')
assert(!/API_URL|script\.google|\/api\//.test(client), 'no Apps Script or legacy fallback')
assert(!client.includes('20260831T045141Z'), 'no hardcoded snapshot ID remains in client')

console.log(`Current snapshot pointer regression passed: ${files.length} files, session-pinned ${pointer.snapshotId}.`)

function assert(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`)
}
