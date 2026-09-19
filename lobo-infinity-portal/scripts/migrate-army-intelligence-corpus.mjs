#!/usr/bin/env node

const endpoint = process.env.ARMY_INTELLIGENCE_MIGRATION_URL || 'https://lobo-infinity-portal.vercel.app/api/army-intelligence-refresh-worker'
const token = String(process.env.ARMY_INTELLIGENCE_BACKFILL_TOKEN || '').trim()
const batchLimit = Math.min(10, Math.max(1, Number(process.env.ARMY_INTELLIGENCE_BATCH_LIMIT) || 10))
const requestTimeoutMs = Math.min(240_000, Math.max(30_000, Number(process.env.ARMY_INTELLIGENCE_REQUEST_TIMEOUT_MS) || 180_000))
if (!token) throw new Error('ARMY_INTELLIGENCE_BACKFILL_TOKEN is required.')

async function call(body) {
  let lastError
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
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
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const transient = /armyIntelligence(?:Sources)? failed with HTTP 404|unable to open the file|Page Not Found|Unknown API action/i.test(message)
      if (!transient || attempt === 5) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000))
    }
  }
  throw lastError
}

const initial = await call({ dryRun: true })
const keys = initial.obsoleteSnapshots.slice(0, batchLimit)
const results = []

for (const snapshotKey of keys) {
  try {
    // Each request is its own durable checkpoint. Read models are rebuilt so the
    // next invocation cannot select completed v7 or isolated invalid records.
    const result = await call({ batchLimit: 1, snapshotKeys: [snapshotKey] })
    const processed = result.processed?.find((item) => item.snapshotKey === snapshotKey)
    const failure = result.failures?.find((item) => item.snapshotKey === snapshotKey)
    results.push({
      snapshotKey,
      status: processed?.status || 'failed',
      reason: failure?.reason || '',
    })
  } catch (error) {
    results.push({
      snapshotKey,
      status: 'retryable',
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}

const final = await call({ dryRun: true })
const invalid = results.filter((item) => item.status === 'failed' && /Invalid IDs in Army Code/i.test(item.reason))
const retryable = results.filter((item) => item.status === 'retryable' || (item.status === 'failed' && !/Invalid IDs in Army Code/i.test(item.reason)))

console.log(JSON.stringify({
  batchLimit,
  attempted: results.length,
  decoded: results.filter((item) => item.status === 'decoded').length,
  isolatedInvalid: invalid.length,
  retryableFailures: retryable,
  remaining: final.staleSnapshots,
  current: final.currentVersionSnapshots,
  total: final.totalDistinctLists,
  duplicateSnapshotKeys: final.duplicateSnapshotKeys,
}, null, 2))
