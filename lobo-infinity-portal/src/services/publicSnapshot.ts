const PUBLIC_BLOB_ORIGIN = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
export const PUBLIC_SNAPSHOT_POINTER_URL = `${PUBLIC_BLOB_ORIGIN}public-snapshots/current.json`

export const PUBLIC_SNAPSHOT_DATASETS = [
  'players', 'games', 'events', 'missions', 'mission-catalog', 'factions', 'standings',
  'army-lists', 'army-intelligence-summary', 'army-intelligence-detail',
  'schedule', 'statistics', 'community', 'top-40-registrations', 'snapshot',
] as const

export type PublicSnapshotDataset = typeof PUBLIC_SNAPSHOT_DATASETS[number]

type SnapshotEnvelope<T> = {
  schemaVersion: number
  snapshotId: string
  sourceCutoff: string
  data: T
}

export type PublicSnapshotPointer = {
  schemaVersion: 1
  snapshotId: string
  sourceCutoff: string
  publishedAt?: string
  basePath: string
}

export type MissionGeistCatalogMission = {
  id: string
  name: string
  canonicalUrl: string
  rights: Record<string, unknown>
  sourceCollectionId: string
  sourceCollectionName: string
  current: boolean
}

export type MissionGeistCatalog = {
  schemaVersion: string
  contentHash: string
  generatedAt: string
  attribution: string
  missions: MissionGeistCatalogMission[]
}

const cache = new Map<PublicSnapshotDataset, Promise<unknown>>()
let pointerPromise: Promise<PublicSnapshotPointer> | undefined

export function getPinnedPublicSnapshot(signal?: AbortSignal) {
  if (pointerPromise) return pointerPromise
  const pending = fetch(PUBLIC_SNAPSHOT_POINTER_URL, {
    cache: 'no-cache',
    signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('Current public snapshot could not be discovered.')
      return response.json() as Promise<PublicSnapshotPointer>
    })
    .then(validatePointer)
  pointerPromise = pending
  pending.catch(() => {
    if (pointerPromise === pending) pointerPromise = undefined
  })
  return pending
}

export function getPublicSnapshotDataset<T>(
  dataset: PublicSnapshotDataset,
  signal?: AbortSignal,
): Promise<T> {
  const existing = cache.get(dataset)
  if (existing) return existing as Promise<T>
  const pending = Promise.all([
    getPinnedPublicSnapshot(signal),
    readPublicSnapshotFile<T>(dataset, signal),
  ]).then(([pointer, value]) => {
    if (dataset === 'snapshot') return value
    const envelope = value as SnapshotEnvelope<T>
    if (envelope.snapshotId !== pointer.snapshotId) {
      throw new Error(`Public snapshot generation mismatch: ${dataset}.json`)
    }
    return envelope.data
  })
  cache.set(dataset, pending)
  pending.catch(() => cache.delete(dataset))
  return pending as Promise<T>
}

// A report that is still waiting for decoded lists can inspect a newer
// generation without invalidating the session's pinned, internally consistent
// snapshot. The caller decides whether the new data merits a page refresh.
export async function getNewerPublicSnapshotDataset<T>(
  dataset: PublicSnapshotDataset,
  sinceSnapshotId: string,
  signal?: AbortSignal,
): Promise<{ snapshotId: string; data: T } | null> {
  const pinned = await getPinnedPublicSnapshot(signal)
  const response = await fetch(PUBLIC_SNAPSHOT_POINTER_URL, { cache: 'no-cache', signal })
  if (!response.ok) return null
  const latest = validatePointer(await response.json() as PublicSnapshotPointer)
  if (latest.snapshotId === pinned.snapshotId || latest.snapshotId === sinceSnapshotId) return null
  const envelope = await readPublicSnapshotFile<SnapshotEnvelope<T>>(dataset, signal, latest)
  if (envelope.snapshotId !== latest.snapshotId) return null
  return { snapshotId: latest.snapshotId, data: envelope.data }
}

export function getPublicMissionGeistCatalog(signal?: AbortSignal) {
  return getPublicSnapshotDataset<MissionGeistCatalog>('mission-catalog', signal)
}

async function readPublicSnapshotFile<T>(dataset: PublicSnapshotDataset, signal?: AbortSignal, pointer?: PublicSnapshotPointer) {
  pointer ??= await getPinnedPublicSnapshot(signal)
  const base = new URL(pointer.basePath, PUBLIC_BLOB_ORIGIN)
  const response = await fetch(new URL(`${dataset}.json`, base), {
    cache: 'force-cache',
    signal,
  })
  if (!response.ok) throw new Error(`Public snapshot dataset could not be loaded: ${dataset}.json`)
  return response.json() as Promise<T>
}

export function clearPublicSnapshotMemoryCacheForTests() {
  cache.clear()
  pointerPromise = undefined
}

function validatePointer(pointer: PublicSnapshotPointer) {
  if (
    pointer?.schemaVersion !== 1
    || !/^\d{8}T\d{6}Z$/.test(pointer.snapshotId)
    || pointer.basePath !== `public-snapshots/${pointer.snapshotId}/`
    || !pointer.sourceCutoff
  ) {
    throw new Error('Current public snapshot pointer is invalid.')
  }
  return Object.freeze({ ...pointer })
}
