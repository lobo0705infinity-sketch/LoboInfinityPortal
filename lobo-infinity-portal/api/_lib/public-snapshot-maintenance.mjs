import { put } from '@vercel/blob'

const ORIGIN = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
const POINTER_PATH = 'public-snapshots/current.json'
const STATUS_PATH = 'public-snapshots/refresh-status.json'
const REFRESH_INTERVAL_MS = 15 * 60_000

export async function refreshPublicSnapshotIfDue(apiUrl, workerToken, {
  fetchObject = fetch, putObject = put, now = Date.now,
} = {}) {
  const timestamp = now()
  const [pointer, status] = await Promise.all([
    readPublicJson(POINTER_PATH, fetchObject),
    readPublicJson(STATUS_PATH, fetchObject),
  ])
  if (pointer) validatePointer(pointer)
  const lastRefresh = status?.snapshotId === pointer?.snapshotId
    ? Date.parse(status?.lastSuccessfulRefreshAt || '') : NaN
  const lastPublication = Date.parse(pointer?.publishedAt || '')
  const lastSuccess = Math.max(Number.isFinite(lastRefresh) ? lastRefresh : 0,
    Number.isFinite(lastPublication) ? lastPublication : 0)
  if (pointer && lastSuccess <= timestamp && timestamp - lastSuccess < REFRESH_INTERVAL_MS) {
    return { attempted: false, snapshotId: pointer.snapshotId, success: true }
  }

  const body = new URLSearchParams({
    action: 'refreshArmyIntelligence', snapshots: '[]',
    publishPublicSnapshot: 'true', workerToken,
  })
  const upstream = await fetchObject(apiUrl, {
    body, method: 'POST', redirect: 'follow', signal: AbortSignal.timeout(240_000),
  })
  const text = await upstream.text()
  let payload
  try { payload = JSON.parse(text) } catch {
    throw new Error(`Snapshot refresh returned non-JSON (HTTP ${upstream.status}).`)
  }
  if (!upstream.ok || payload.success !== true || payload.publication?.success !== true) {
    throw new Error(`Snapshot refresh failed (HTTP ${upstream.status}): ${
      String(payload.publication?.error || payload.error || 'No successful publication receipt.').slice(0, 300)}`)
  }

  // Verify activation independently; an HTTP 200 alone is not publication.
  const activated = await readPublicJson(POINTER_PATH, fetchObject)
  validatePointer(activated)
  const publication = payload.publication
  const expectedId = publication.unchanged === true
    ? publication.current?.snapshotId || pointer?.snapshotId : publication.snapshotId
  if (!expectedId || activated.snapshotId !== expectedId) {
    throw new Error('Snapshot refresh receipt does not match the live pointer.')
  }
  await putObject(STATUS_PATH, JSON.stringify({
    schemaVersion: 1, snapshotId: activated.snapshotId,
    lastSuccessfulRefreshAt: new Date(now()).toISOString(),
  }), { access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 0 })
  return { attempted: true, snapshotId: activated.snapshotId,
    unchanged: publication.unchanged === true, success: true }
}

async function readPublicJson(path, fetchObject) {
  const response = await fetchObject(ORIGIN + path, { cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Snapshot maintenance read failed (HTTP ${response.status}).`)
  return response.json()
}

function validatePointer(pointer) {
  if (!pointer || !/^\d{8}T\d{6}Z$/.test(pointer.snapshotId || '') ||
      pointer.basePath !== `public-snapshots/${pointer.snapshotId}/` ||
      !Number.isFinite(Date.parse(pointer.sourceCutoff || '')) ||
      !Number.isFinite(Date.parse(pointer.publishedAt || ''))) {
    throw new Error('Snapshot maintenance received an invalid live pointer.')
  }
}
