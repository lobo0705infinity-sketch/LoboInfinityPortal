const snapshotOrigin = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
let pointerCache

export async function readPublicDataset(name, fetchObject = fetch) {
  if (!['games', 'events', 'factions', 'missions'].includes(name)) {
    throw new Error('Unsupported public snapshot dataset')
  }
  if (!pointerCache || pointerCache.expires < Date.now()) {
    const pointer = await readJson(new URL('public-snapshots/current.json', snapshotOrigin), fetchObject)
    if (!/^\d{8}T\d{6}Z$/.test(pointer?.snapshotId)
      || pointer.basePath !== `public-snapshots/${pointer.snapshotId}/`) {
      throw new Error('Invalid public snapshot pointer')
    }
    pointerCache = { pointer, expires: Date.now() + 60_000 }
  }
  const { pointer } = pointerCache
  const envelope = await readJson(new URL(`${pointer.basePath}${name}.json`, snapshotOrigin), fetchObject)
  if (envelope.snapshotId !== pointer.snapshotId || !Array.isArray(envelope.data)) {
    throw new Error(`Invalid public ${name} snapshot`)
  }
  return envelope.data
}

async function readJson(url, fetchObject) {
  const result = await fetchObject(url, { signal: AbortSignal.timeout(7_000) })
  if (!result.ok) throw new Error(`Public snapshot returned HTTP ${result.status}`)
  return result.json()
}
