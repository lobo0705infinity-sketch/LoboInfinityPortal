#!/usr/bin/env node

const endpoint = process.env.ARMY_INTELLIGENCE_MIGRATION_URL || 'https://lobo-infinity-portal.vercel.app/api/army-intelligence-refresh-worker'
const token = String(process.env.ARMY_INTELLIGENCE_BACKFILL_TOKEN || '').trim()
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

async function audit(snapshotKeys) {
  return call({ dryRun: true, ...(snapshotKeys ? { snapshotKeys } : {}) })
}

async function isCurrent(snapshotKey) {
  const result = await audit([snapshotKey])
  return result.totalDistinctLists === 1 && result.currentVersionSnapshots === 1 && result.staleSnapshots === 0
}

function classifyFailure(reason) {
  const text = String(reason || '')
  if (/Invalid IDs in Army Code/i.test(text)) return 'invalid-army-code'
  if (/no decoded snapshot/i.test(text)) return 'empty-decoder-result'
  return text.replace(/[a-f0-9]{32,}/gi, '<key>').slice(0, 180)
}

const initial = await audit()
const keys = [...initial.obsoleteSnapshots]
const failures = []
let succeeded = 0
let consecutiveCause = ''
let consecutiveFailures = 0

console.log(JSON.stringify({ stage: 'initial', total: initial.totalDistinctLists, current: initial.currentVersionSnapshots, remaining: keys.length }))
for (let index = 0; index < keys.length; index += 1) {
  const snapshotKey = keys[index]
  if (await isCurrent(snapshotKey)) {
    console.log(JSON.stringify({ stage: 'list', current: index + 1, key: snapshotKey, status: 'already-current', remaining: keys.length - index - 1 }))
    continue
  }

  let result
  let transportError = ''
  try {
    result = await call({ batchLimit: 1, deferReadModelRebuild: true, snapshotKeys: [snapshotKey] })
  } catch (error) {
    transportError = error instanceof Error ? error.message : String(error)
  }

  const processed = result?.processed?.find((item) => item.snapshotKey === snapshotKey)
  if (processed?.status === 'decoded') {
    succeeded += 1
    consecutiveCause = ''
    consecutiveFailures = 0
    console.log(JSON.stringify({ stage: 'list', current: index + 1, key: snapshotKey, status: 'success', remaining: keys.length - index - 1 }))
    continue
  }

  const workerFailure = result?.failures?.find((failure) => failure.snapshotKey === snapshotKey)
  const reason = workerFailure?.reason || transportError || 'Worker returned no decoded snapshot.'
  const cause = classifyFailure(reason)
  failures.push({ snapshotKey, cause, reason })
  consecutiveFailures = cause === consecutiveCause ? consecutiveFailures + 1 : 1
  consecutiveCause = cause
  console.log(JSON.stringify({ stage: 'list', current: index + 1, key: snapshotKey, status: 'failed', cause, reason, remaining: keys.length - index - 1 }))
  if (consecutiveFailures >= 3 && !['invalid-army-code', 'empty-decoder-result'].includes(cause)) {
    throw new Error(`Stopped after three consecutive unexplained failures with cause: ${cause}`)
  }
}

const beforeFinalize = await audit()
const failedKeys = new Set(failures.map((failure) => failure.snapshotKey))
if (succeeded + initial.currentVersionSnapshots + failedKeys.size !== initial.totalDistinctLists)
  throw new Error('Migration attempt census is incomplete; read-model finalization blocked.')

const finalization = await call({ finalizeMigration: true, publishPublicSnapshot: false, snapshotKeys: ['__finalize_only__'] })
const finalAudit = await audit()
const unexplainedStale = finalAudit.obsoleteSnapshots.filter((key) => !failedKeys.has(key))
if (unexplainedStale.length > 0) throw new Error(`${unexplainedStale.length} stale snapshots remain after read-model finalization; publication remains blocked.`)
if (finalAudit.duplicateSnapshotKeys.length > 0) throw new Error(`${finalAudit.duplicateSnapshotKeys.length} duplicate snapshot keys remain; publication remains blocked.`)
console.log(JSON.stringify({
  stage: 'complete',
  totalDistinctLists: finalAudit.totalDistinctLists,
  currentVersionSnapshots: finalAudit.currentVersionSnapshots,
  successfullyRefreshedSnapshots: succeeded,
  unchangedCurrentSnapshots: initial.currentVersionSnapshots,
  failedSnapshots: failures,
  staleSnapshotsAfterMigration: unexplainedStale,
  finalizationRequested: finalization.success === true,
}, null, 2))
