#!/usr/bin/env node

const endpoint = process.env.ARMY_INTELLIGENCE_MIGRATION_URL || 'https://lobo-infinity-portal.vercel.app/api/army-intelligence-refresh-worker'
const token = String(process.env.ARMY_INTELLIGENCE_BACKFILL_TOKEN || '').trim()
const batchSize = Math.min(5, Math.max(1, Number(process.env.ARMY_INTELLIGENCE_BATCH_SIZE) || 4))
const requestTimeoutMs = Math.min(240_000, Math.max(30_000, Number(process.env.ARMY_INTELLIGENCE_REQUEST_TIMEOUT_MS) || 180_000))
if (!token) throw new Error('ARMY_INTELLIGENCE_BACKFILL_TOKEN is required.')

async function call(body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-army-backfill-token': token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(requestTimeoutMs),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Worker HTTP ${response.status}: ${text.slice(0, 500)}`)
  const payload = JSON.parse(text)
  if (payload.success !== true) throw new Error(payload.error || 'Worker request failed.')
  return payload
}

const initial = await call({ dryRun: true })
const maximumBatches = Math.ceil(initial.staleSnapshots / batchSize) + 1
const failures = []
const excludedSnapshotKeys = new Set()
let succeeded = 0
let previousRemaining = initial.staleSnapshots + 1
let remaining = initial.staleSnapshots

console.log(JSON.stringify({ stage: 'initial', batchSize, maximumBatches, ...initial }))
for (let batch = 1; batch <= maximumBatches && remaining > 0; batch += 1) {
  const result = await call({ batchLimit: batchSize, excludeSnapshotKeys: Array.from(excludedSnapshotKeys) })
  succeeded += result.decoded
  for (const failure of result.failures || []) {
    if (failure.snapshotKey) excludedSnapshotKeys.add(failure.snapshotKey)
    failures.push(failure)
  }
  remaining = result.remaining
  console.log(JSON.stringify({ stage: 'batch', batch, processed: result.processed.length, succeeded: result.decoded, failed: result.failed, remaining }))
  if (remaining === 0) break
  if (remaining >= previousRemaining) throw new Error(`Migration made no progress: remaining ${remaining}, previous ${previousRemaining}.`)
  previousRemaining = remaining
}
if (remaining !== 0) throw new Error(`Migration stopped with ${remaining} unprocessed snapshots after ${maximumBatches} batches.`)

const publication = await call({ snapshotKeys: ['__publish_only__'], publishPublicSnapshot: true, batchLimit: 1 })
const finalAudit = await call({ dryRun: true })
console.log(JSON.stringify({
  stage: 'complete',
  pipelineVersion: finalAudit.pipelineVersion,
  totalDistinctLists: initial.totalDistinctLists,
  currentVersionSnapshots: finalAudit.currentVersionSnapshots,
  successfullyRefreshedSnapshots: succeeded,
  unchangedCurrentSnapshots: initial.currentVersionSnapshots,
  failedSnapshots: failures,
  documentedFailureKeys: Array.from(excludedSnapshotKeys),
  eligibleCurrentOrDocumentedFailure: finalAudit.currentVersionSnapshots + excludedSnapshotKeys.size === initial.totalDistinctLists,
  duplicateSnapshotKeys: finalAudit.duplicateSnapshotKeys,
  missingStoredSnapshots: finalAudit.missingStoredSnapshots,
  staleSnapshotsAfterMigration: finalAudit.obsoleteSnapshots.filter((key) => !excludedSnapshotKeys.has(key)),
  publicationRequested: publication.success === true,
}, null, 2))
