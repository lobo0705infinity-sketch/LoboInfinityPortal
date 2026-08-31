export const PUBLIC_SNAPSHOT_ID = '20260831T045141Z'
export const PUBLIC_SNAPSHOT_BASE =
  `https://ecwefvuvauaqpary.public.blob.vercel-storage.com/public-snapshots/${PUBLIC_SNAPSHOT_ID}/`

export const PUBLIC_SNAPSHOT_DATASETS = [
  'players', 'games', 'events', 'missions', 'factions', 'standings',
  'army-lists', 'army-intelligence-summary', 'army-intelligence-detail',
  'schedule', 'statistics', 'community', 'snapshot',
] as const

export type PublicSnapshotDataset = typeof PUBLIC_SNAPSHOT_DATASETS[number]

type SnapshotEnvelope<T> = {
  schemaVersion: number
  snapshotId: string
  sourceCutoff: string
  data: T
}

const cache = new Map<PublicSnapshotDataset, Promise<unknown>>()

export function getPublicSnapshotDataset<T>(
  dataset: PublicSnapshotDataset,
  signal?: AbortSignal,
): Promise<T> {
  if (dataset === 'snapshot') {
    return readPublicSnapshotFile<T>(dataset, signal)
  }
  const existing = cache.get(dataset)
  if (existing) return existing as Promise<T>
  const pending = readPublicSnapshotFile<SnapshotEnvelope<T>>(dataset, signal)
    .then((envelope) => {
      if (envelope.snapshotId !== PUBLIC_SNAPSHOT_ID) {
        throw new Error(`Public snapshot generation mismatch: ${dataset}.json`)
      }
      return envelope.data
    })
  cache.set(dataset, pending)
  pending.catch(() => cache.delete(dataset))
  return pending
}

async function readPublicSnapshotFile<T>(dataset: PublicSnapshotDataset, signal?: AbortSignal) {
  const response = await fetch(`${PUBLIC_SNAPSHOT_BASE}${dataset}.json`, {
    cache: 'force-cache',
    signal,
  })
  if (!response.ok) throw new Error(`Public snapshot dataset could not be loaded: ${dataset}.json`)
  return response.json() as Promise<T>
}

export function clearPublicSnapshotMemoryCacheForTests() {
  cache.clear()
}
