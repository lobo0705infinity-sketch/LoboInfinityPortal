import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const DEFAULT_MAPS_API_URL = 'http://51.255.44.29/infinity/api/maps'
export const DEFAULT_MAPS_PAGE_URL = 'http://51.255.44.29/infinity/maps'
export const DEFAULT_RESOURCES_URL = DEFAULT_MAPS_API_URL
export const DEFAULT_WORKSHOP_ITEM_IDS = Object.freeze(['3719263238'])
export const STEAM_WORKSHOP_DETAILS_URL = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/'
export const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
export const DEFAULT_BASELINE_LOOKBACK_MS = 72 * 60 * 60 * 1000
export const DEFAULT_STATE_PATH = resolve(import.meta.dirname, '..', '.tmp', 'rules-resource-watcher.json')
export const MAP_WATCHER_STATE_VERSION = 2

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

export function slugifyMapName(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizedHttpUrls(values = []) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.flatMap((value) => {
    try {
      const url = new URL(String(value || '').trim())
      return ['http:', 'https:'].includes(url.protocol) ? [url.toString()] : []
    } catch {
      return []
    }
  }))]
}

function mapPageUrl(name, mapsPageUrl) {
  const url = new URL(mapsPageUrl)
  url.searchParams.set('map', slugifyMapName(name))
  return url.toString()
}

function mapJsonUrl(id, mapsApiUrl, suppliedUrl) {
  if (suppliedUrl) {
    try {
      const url = new URL(String(suppliedUrl))
      if (['http:', 'https:'].includes(url.protocol)) return url.toString()
    } catch {}
  }
  return new URL(`tts-maps/${id}/json`, mapsApiUrl).toString()
}

export function parseMapCatalog(payload, {
  mapsApiUrl = DEFAULT_MAPS_API_URL,
  mapsPageUrl = DEFAULT_MAPS_PAGE_URL,
} = {}) {
  if (!Array.isArray(payload)) throw new Error('Maps endpoint returned an invalid payload')
  const maps = payload.map((rawMap) => {
    const id = String(rawMap?.id ?? '').trim()
    const name = String(rawMap?.name ?? '').trim()
    const createdAtMs = Date.parse(String(rawMap?.created_at ?? ''))
    if (!/^\d+$/.test(id) || !name || !Number.isFinite(createdAtMs)) {
      throw new Error('Maps endpoint returned a map without a valid id, name, or created_at value')
    }
    const images = normalizedHttpUrls(rawMap.images)
    const contentSignature = sha256(JSON.stringify({
      name,
      createdAt: new Date(createdAtMs).toISOString(),
      images,
      json: rawMap.json ?? null,
    }))
    return {
      id,
      name,
      createdAt: new Date(createdAtMs).toISOString(),
      pageUrl: mapPageUrl(name, mapsPageUrl),
      jsonUrl: mapJsonUrl(id, mapsApiUrl, rawMap.json_url),
      images,
      contentSignature,
    }
  })
  const duplicateIds = maps.filter((map, index) => maps.findIndex((candidate) => candidate.id === map.id) !== index)
  if (duplicateIds.length) throw new Error(`Maps endpoint returned duplicate map id ${duplicateIds[0].id}`)
  return maps.sort((a, b) => Number(a.id) - Number(b.id))
}

export function diffMapCatalog(previous = [], current = []) {
  const before = new Map(previous.map((item) => [String(item.id), item]))
  const after = new Map(current.map((item) => [String(item.id), item]))
  return {
    added: current.filter((item) => !before.has(String(item.id))),
    removed: previous.filter((item) => !after.has(String(item.id))),
    updated: current.filter((item) => {
      const prior = before.get(String(item.id))
      return prior && (prior.contentSignature !== item.contentSignature || prior.name !== item.name)
    }).map((item) => ({ ...item, previous: before.get(String(item.id)) })),
  }
}

export function selectRecentBaselineMaps(maps = [], {
  nowMs = Date.now(),
  lookbackMs = DEFAULT_BASELINE_LOOKBACK_MS,
} = {}) {
  return maps
    .filter((map) => {
      const ageMs = nowMs - Date.parse(map.createdAt)
      return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= lookbackMs
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(-10)
}

export function parseWorkshopItemIds(value = DEFAULT_WORKSHOP_ITEM_IDS) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',')
  return [...new Set(raw.map((item) => String(item).trim()).filter((item) => /^\d+$/.test(item)))].sort()
}

export function diffWorkshopItems(previous = [], current = []) {
  const before = new Map(previous.map((item) => [item.id, item]))
  return current.filter((item) => {
    const prior = before.get(item.id)
    return prior && (prior.updatedAt !== item.updatedAt || prior.title !== item.title)
  }).map((item) => ({ ...item, previous: before.get(item.id) }))
}

export async function fetchWorkshopItems(itemIds, fetchImpl = globalThis.fetch) {
  if (!itemIds.length) return []
  const body = new URLSearchParams({ itemcount: String(itemIds.length) })
  itemIds.forEach((id, index) => body.set(`publishedfileids[${index}]`, id))
  const response = await fetchImpl(STEAM_WORKSHOP_DETAILS_URL, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Steam Workshop endpoint returned HTTP ${response.status}`)
  const details = (await response.json())?.response?.publishedfiledetails
  if (!Array.isArray(details)) throw new Error('Steam Workshop endpoint returned an invalid payload')
  const found = new Map(details.map((item) => [String(item?.publishedfileid || ''), item]))
  return itemIds.map((id) => {
    const item = found.get(id)
    if (!item || Number(item.result) !== 1 || !Number.isFinite(Number(item.time_updated))) throw new Error(`Steam Workshop item ${id} was unavailable`)
    return {
      id,
      title: String(item.title || `Steam Workshop item ${id}`).trim(),
      updatedAt: Number(item.time_updated),
      url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`,
    }
  })
}

async function readState(path) {
  try { return JSON.parse(await readFile(path, 'utf8')) } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function writeState(path, state) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`)
  await rename(temporary, path)
}

function hasAnnounceableChanges(changes) {
  return Boolean(changes.added.length || changes.updated.length || changes.workshops.length)
}

export async function checkRulesResources({
  url = process.env.INFINITY_MAPS_API_URL || DEFAULT_MAPS_API_URL,
  mapsPageUrl = process.env.INFINITY_MAPS_PAGE_URL || DEFAULT_MAPS_PAGE_URL,
  statePath = process.env.INFINITY_RESOURCES_STATE_PATH || DEFAULT_STATE_PATH,
  fetchImpl = globalThis.fetch,
  workshopItemIds = parseWorkshopItemIds(process.env.INFINITY_WORKSHOP_ITEM_IDS || DEFAULT_WORKSHOP_ITEM_IDS),
  baselineLookbackMs = DEFAULT_BASELINE_LOOKBACK_MS,
  now = () => Date.now(),
  onChange,
  logger = console,
} = {}) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Maps endpoint returned HTTP ${response.status}`)
  const maps = parseMapCatalog(await response.json(), { mapsApiUrl: url, mapsPageUrl })
  const workshops = await fetchWorkshopItems(parseWorkshopItemIds(workshopItemIds), fetchImpl)
  const checkedAt = new Date(now()).toISOString()
  const snapshot = {
    version: MAP_WATCHER_STATE_VERSION,
    source: 'maps-api',
    checkedAt,
    maps,
    workshops,
  }
  const previous = await readState(statePath)
  const hasPreviousMapCatalog = Array.isArray(previous?.maps)
  const mapChanges = hasPreviousMapCatalog
    ? diffMapCatalog(previous.maps, maps)
    : { added: selectRecentBaselineMaps(maps, { nowMs: now(), lookbackMs: baselineLookbackMs }), removed: [], updated: [] }
  const workshopChanges = hasPreviousMapCatalog && Array.isArray(previous?.workshops)
    ? diffWorkshopItems(previous.workshops, workshops)
    : workshops
  const changes = { ...mapChanges, workshops: workshopChanges }

  if (hasAnnounceableChanges(changes) && onChange) await onChange({ previous, snapshot, changes })
  await writeState(statePath, snapshot)

  if (!previous) {
    logger.info?.(`Infinity maps baseline saved: maps=${maps.length} recent=${changes.added.length} workshops=${workshops.length}`)
    return { status: 'BASELINED', snapshot, changes }
  }
  if (!hasPreviousMapCatalog) {
    logger.info?.(`Infinity maps watcher migrated: maps=${maps.length} recent=${changes.added.length} workshops=${changes.workshops.length}`)
    return { status: 'MIGRATED', snapshot, changes }
  }
  if (!changes.added.length && !changes.removed.length && !changes.updated.length && !changes.workshops.length) {
    return { status: 'UNCHANGED', snapshot, changes }
  }

  logger.info?.(`Infinity maps changed: added=${changes.added.length} removed=${changes.removed.length} updated=${changes.updated.length} workshops=${changes.workshops.length}`)
  return { status: 'CHANGED', snapshot, changes }
}

export function startRulesResourceWatcher(options = {}) {
  if (String(process.env.INFINITY_RESOURCES_ANNOUNCER_ENABLED || 'true').toLowerCase() === 'false') {
    return { stop() {}, runNow: async () => ({ status: 'DISABLED' }) }
  }
  const intervalMs = Math.max(60_000, Number(process.env.INFINITY_RESOURCES_CHECK_INTERVAL_MS) || DEFAULT_CHECK_INTERVAL_MS)
  let stopped = false
  let running = null
  const runNow = async () => {
    if (running) return running
    running = checkRulesResources(options)
      .catch((error) => {
        options.logger?.error?.(`Infinity maps check failed: ${error instanceof Error ? error.message : String(error)}`)
        return { status: 'ERROR', error }
      })
      .finally(() => { running = null })
    return running
  }
  const timer = setInterval(() => { if (!stopped) void runNow() }, intervalMs)
  timer.unref?.()
  void runNow()
  return { stop() { stopped = true; clearInterval(timer) }, runNow }
}
