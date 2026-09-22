import { createHash } from 'node:crypto'
import { deserialize } from 'bson'

export const MAX_WORKSHOP_FILE_BYTES = 100 * 1024 * 1024
export const WORKSHOP_MAP_SOURCE = 'lobo-workshop'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function canonicalize(value) {
  if (value === null || value === undefined) return value ?? null
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { $binary: Buffer.from(value).toString('base64') }
  }
  if (typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
}

export function cleanWorkshopMapName(value = '') {
  return String(value).replace(/^\s*SET_\s*/i, '').replace(/\s+/g, ' ').trim()
}

function explicitMapId(mapBag) {
  const text = [mapBag?.GMNotes, mapBag?.Description].map((value) => String(value || '')).join('\n')
  return /(?:^|\s)lobo-map-id\s*:\s*([a-z0-9][a-z0-9_-]*)/i.exec(text)?.[1]?.toLowerCase() || ''
}

function workshopMapId(mapBag, workshopId) {
  const explicitId = explicitMapId(mapBag)
  if (explicitId) return `${workshopId}:${explicitId}`
  const guid = String(mapBag?.GUID || '').trim().toLowerCase()
  if (!/^[a-z0-9]{6}$/.test(guid)) throw new Error(`Workshop map ${String(mapBag?.Nickname || '').trim() || '(unnamed)'} has no stable GUID`)
  return `${workshopId}:${guid}`
}

function mapContentSignature(mapBag) {
  return sha256(JSON.stringify(canonicalize({
    nickname: String(mapBag.Nickname || '').trim(),
    description: String(mapBag.Description || '').trim(),
    gmNotes: String(mapBag.GMNotes || '').trim(),
    tags: Array.isArray(mapBag.Tags) ? mapBag.Tags : [],
    containedObjects: mapBag.ContainedObjects,
  })))
}

export function extractWorkshopMapCatalog(rawWorkshopFile, workshop) {
  const buffer = Buffer.isBuffer(rawWorkshopFile) ? rawWorkshopFile : Buffer.from(rawWorkshopFile)
  if (!buffer.length || buffer.length > MAX_WORKSHOP_FILE_BYTES) {
    throw new Error(`Steam Workshop file size was outside the supported range: ${buffer.length} bytes`)
  }
  let save
  try {
    save = deserialize(buffer, { promoteLongs: true })
  } catch (error) {
    throw new Error(`Steam Workshop file was not a readable Tabletop Simulator BSON save: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(save?.ObjectStates)) throw new Error('Steam Workshop save did not contain ObjectStates')

  const workshopId = String(workshop?.id || '').trim()
  const workshopTitle = String(workshop?.title || '').trim()
  const updatedAt = Number(workshop?.updatedAt)
  if (!/^\d+$/.test(workshopId) || !workshopTitle || !Number.isFinite(updatedAt)) {
    throw new Error('Steam Workshop metadata was incomplete')
  }
  const updatedAtIso = new Date(updatedAt * 1000).toISOString()
  const maps = save.ObjectStates
    .filter((object) => object?.Name === 'Bag' && /^\s*SET_/i.test(String(object?.Nickname || '')) && Array.isArray(object?.ContainedObjects))
    .map((mapBag) => ({
      id: workshopMapId(mapBag, workshopId),
      source: WORKSHOP_MAP_SOURCE,
      sourceLabel: workshopTitle,
      workshopId,
      workshopContentId: String(workshop.contentId || ''),
      guid: String(mapBag.GUID).trim().toLowerCase(),
      name: cleanWorkshopMapName(mapBag.Nickname),
      description: String(mapBag.Description || '').trim(),
      objectCount: mapBag.ContainedObjects.length,
      createdAt: updatedAtIso,
      pageUrl: String(workshop.url || '').trim(),
      jsonUrl: '',
      images: [],
      previewUrl: String(workshop.previewUrl || '').trim(),
      contentSignature: mapContentSignature(mapBag),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }))

  const duplicate = maps.find((map, index) => maps.findIndex((candidate) => candidate.id === map.id) !== index)
  if (duplicate) throw new Error(`Steam Workshop save contained duplicate map id ${duplicate.id}`)
  if (!maps.length) throw new Error('Steam Workshop save did not contain any SET_ map bags')
  return {
    saveName: String(save.SaveName || workshopTitle).trim(),
    mapCount: maps.length,
    maps,
  }
}

export async function fetchWorkshopMapCatalog(workshop, fetchImpl = globalThis.fetch) {
  const fileUrl = String(workshop?.fileUrl || '').trim()
  if (!fileUrl) throw new Error(`Steam Workshop item ${String(workshop?.id || '').trim() || '(unknown)'} did not provide a downloadable file`)
  const response = await fetchImpl(fileUrl, {
    headers: { accept: 'application/octet-stream' },
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) throw new Error(`Steam Workshop file endpoint returned HTTP ${response.status}`)
  const statedSize = Number(response.headers?.get?.('content-length'))
  if (Number.isFinite(statedSize) && statedSize > MAX_WORKSHOP_FILE_BYTES) {
    throw new Error(`Steam Workshop file exceeded ${MAX_WORKSHOP_FILE_BYTES} bytes`)
  }
  const file = Buffer.from(await response.arrayBuffer())
  const expectedSize = Number(workshop.fileSize)
  if (Number.isFinite(expectedSize) && expectedSize > 0 && file.length !== expectedSize) {
    throw new Error(`Steam Workshop file size did not match Steam metadata: expected ${expectedSize}, received ${file.length}`)
  }
  return extractWorkshopMapCatalog(file, workshop)
}
