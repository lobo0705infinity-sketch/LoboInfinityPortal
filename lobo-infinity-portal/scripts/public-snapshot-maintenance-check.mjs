import assert from 'node:assert/strict'
import { refreshPublicSnapshotIfDue } from '../api/_lib/public-snapshot-maintenance.mjs'

const now = Date.parse('2026-10-05T20:00:00Z')
const pointer = (id, publishedAt) => ({ schemaVersion: 1, snapshotId: id,
  sourceCutoff: publishedAt, publishedAt, basePath: `public-snapshots/${id}/` })
const old = pointer('20260930T040304Z', '2026-09-30T04:04:06Z')
const fresh = pointer('20261005T195900Z', '2026-10-05T19:59:00Z')

function fixture({ initial = old, activated = fresh, receipt = { success: true,
  publication: { success: true, snapshotId: fresh.snapshotId } }, status,
  rawReceipt, httpStatus = 200 } = {}) {
  const apiCalls = []; const writes = []; let live = initial
  const fetchObject = async (url, options) => {
    if (url.endsWith('/current.json')) return new Response(JSON.stringify(live), { status: 200 })
    if (url.endsWith('/refresh-status.json')) return status
      ? new Response(JSON.stringify(status)) : new Response('', { status: 404 })
    apiCalls.push(options)
    live = activated
    return new Response(rawReceipt ?? JSON.stringify(receipt), { status: httpStatus })
  }
  return { apiCalls, writes, options: { now: () => now, fetchObject,
    putObject: async (...args) => { writes.push(args) } } }
}

const stale = fixture()
const recovered = await refreshPublicSnapshotIfDue('https://example.invalid/api', 'secret', stale.options)
assert.equal(recovered.snapshotId, fresh.snapshotId)
assert.equal(stale.apiCalls.length, 1)
const params = stale.apiCalls[0].body
assert.equal(params.get('workerToken'), 'secret')
assert.equal(params.get('snapshots'), '[]', 'publication does not redecode or append games')
assert.equal(params.get('publishPublicSnapshot'), 'true')
assert.equal(stale.writes.length, 1)
assert.doesNotMatch(stale.writes[0][1], /secret|workerToken/, 'public maintenance status contains no credential')

const recent = fixture({ initial: fresh })
assert.equal((await refreshPublicSnapshotIfDue('https://example.invalid/api', 'secret', recent.options)).attempted, false)
assert.equal(recent.apiCalls.length, 0)

const unchanged = fixture({ activated: old, receipt: { success: true,
  publication: { success: true, unchanged: true, current: old } } })
assert.equal((await refreshPublicSnapshotIfDue('https://example.invalid/api', 'secret', unchanged.options)).unchanged, true)
const checked = fixture({ status: JSON.parse(unchanged.writes[0][1]) })
assert.equal((await refreshPublicSnapshotIfDue('https://example.invalid/api', 'secret', checked.options)).attempted, false,
  'a successful unchanged refresh is durably throttled across cold starts')

for (const bad of [
  { rawReceipt: 'A server error has occurred', httpStatus: 500 },
  { receipt: { success: false, publication: { success: false, error: 'chunk upload failed' } } },
  { receipt: { success: true } },
  { activated: old },
]) {
  const failed = fixture(bad)
  await assert.rejects(refreshPublicSnapshotIfDue('https://example.invalid/api', 'secret', failed.options))
  assert.equal(failed.writes.length, 0, 'failed publication never records success or suppresses the next attempt')
}

console.log('Snapshot maintenance PASS: authenticated stale refresh, verified activation, unchanged throttling and failure recovery')
