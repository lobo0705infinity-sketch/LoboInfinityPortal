import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import handler, { PUBLIC_SNAPSHOT_FILES, publishPublicSnapshot } from '../api/public-snapshot-publish.mjs'

const snapshotId = '20260831T044344Z'
const sourceCutoff = '2026-08-31T04:43:55.151Z'
assert.equal(PUBLIC_SNAPSHOT_FILES.length, 13)
assert.deepEqual(PUBLIC_SNAPSHOT_FILES, [
  'snapshot.json', 'players.json', 'games.json', 'events.json', 'missions.json',
  'factions.json', 'standings.json', 'army-lists.json',
  'army-intelligence-summary.json', 'army-intelligence-detail.json',
  'schedule.json', 'statistics.json', 'community.json',
])
const files = Object.fromEntries(PUBLIC_SNAPSHOT_FILES.map((filename) => [filename, JSON.stringify({ snapshotId, sourceCutoff, data: [] })]))
files['snapshot.json'] = JSON.stringify({ snapshotId, sourceCutoff, status: 'validated', published: false, livePointer: false })

const uploads = []
const result = await publishPublicSnapshot({ snapshotId, sourceCutoff, files }, {
  putObject: async (pathname, text, options) => {
    uploads.push({ pathname, text, options })
    return { url: `https://example.public.blob.vercel-storage.com/${pathname}` }
  },
})
assert.equal(result.uploaded, PUBLIC_SNAPSHOT_FILES.length)
assert.deepEqual(uploads.map(({ pathname }) => pathname), PUBLIC_SNAPSHOT_FILES.map((name) => `public-snapshots/${snapshotId}/${name}`))
assert.ok(uploads.every(({ options }) => options.access === 'public' && options.addRandomSuffix === false))
assert.ok(uploads.every(({ options }) => !Object.hasOwn(options, 'allowOverwrite') || options.allowOverwrite === false))

for (const invalid of ['../games.json', 'games.json/../secret', 'unknown.json']) {
  await assert.rejects(() => publishPublicSnapshot({ snapshotId, sourceCutoff, files: { ...files, [invalid]: '{}' } }, { putObject: async () => ({}) }), /allowlisted/)
}
const incomplete = { ...files }; delete incomplete['games.json']
await assert.rejects(() => publishPublicSnapshot({ snapshotId, sourceCutoff, files: incomplete }, { putObject: async () => ({}) }), /allowlisted/)
await assert.rejects(() => publishPublicSnapshot({ snapshotId: '../bad', sourceCutoff, files }, { putObject: async () => ({}) }), /Invalid snapshot ID/)

async function invoke(request) {
  let statusCode = 0; let payload = null
  await handler(request, {
    setHeader() {},
    status(code) { statusCode = code; return this },
    json(value) { payload = value; return this },
  })
  return { statusCode, payload }
}
delete process.env.LOBO_SNAPSHOT_PUBLISH_TOKEN
assert.equal((await invoke({ method: 'POST', headers: {}, body: {} })).statusCode, 401)
process.env.LOBO_SNAPSHOT_PUBLISH_TOKEN = 'correct-token'
assert.equal((await invoke({ method: 'POST', headers: { authorization: 'Bearer wrong-token' }, body: {} })).statusCode, 401)

const endpointSource = await readFile(new URL('../api/public-snapshot-publish.mjs', import.meta.url), 'utf8')
assert.doesNotMatch(endpointSource, /script\.google|googleusercontent|VITE_API_URL|projection|automation queue/i)
assert.doesNotMatch(endpointSource, /allowOverwrite:\s*true/)

console.log('Public snapshot Blob publication regression PASS')
