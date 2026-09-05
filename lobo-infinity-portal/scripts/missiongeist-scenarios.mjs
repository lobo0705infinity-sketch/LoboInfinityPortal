import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

export const MISSIONGEIST_ORIGIN = 'https://infinitygeist.com'
export const MISSIONGEIST_LISTING_URL = `${MISSIONGEIST_ORIGIN}/api/v1/listing.json`
export const MISSIONGEIST_CAPTURE_VERSION = 'mission-content-v1'
export const MISSIONGEIST_CACHE_TTL_MS = 6 * 60 * 60 * 1000
export const MISSIONGEIST_VIEWPORT = Object.freeze({ width: 1200, height: 1000 })
export const MISSIONGEIST_SEGMENT_HEIGHT = 1900
export const MISSIONGEIST_SEGMENT_OVERLAP = 80
export const MISSIONGEIST_MAX_FILE_BYTES = 8 * 1024 * 1024

const listingTimeoutMs = 15_000
const aliases = new Map([
  ['c and p', 'capture and protect'],
  ['cap and protect', 'capture and protect'],
  ['cap protect', 'capture and protect'],
  ['hc', 'highly classified'],
  ['l and s', 'looting and sabotaging'],
  ['sup', 'supplies'],
])
let catalogMemory = null
let catalogLoadedAt = 0
const captureJobs = new Map()

export class MissionGeistError extends Error {
  constructor(code, message, options = {}) {
    super(message, options)
    this.name = 'MissionGeistError'
    this.code = code
    this.canonicalUrl = options.canonicalUrl || null
    this.missionName = options.missionName || null
  }
}

export function normalizeMissionName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function flattenMissionGeistListing(listing) {
  if (!listing || !Array.isArray(listing.seasons)) {
    throw new MissionGeistError('catalog_invalid', 'MissionGeist returned an invalid scenario catalog.')
  }
  return listing.seasons.flatMap((collection, collectionIndex) =>
    (collection?.missions || []).map((mission, missionIndex) => validateCatalogMission({
      id: mission?.id,
      name: mission?.name,
      canonicalUrl: mission?.canonicalUrl,
      current: collection?.current === true,
      sourceCollectionId: collection?.id,
      sourceCollectionName: collection?.name,
      collectionIndex,
      missionIndex,
    })))
}

export function resolveMissionQuery(query, missions) {
  const raw = String(query ?? '').trim()
  let key = normalizeMissionName(raw)
  if (!key) return { kind: 'missing', query: raw, matches: [] }
  key = aliases.get(key) || key

  const candidates = missions.map((mission) => ({
    mission,
    full: normalizeMissionName(mission.name),
    base: normalizeMissionName(baseMissionName(mission.name)),
  }))
  const exact = candidates.filter((item) => item.full === key || item.base === key)
  if (exact.length) return selectEdition(exact.map((item) => item.mission), raw)

  const grouped = new Map()
  for (const item of candidates) {
    const groupKey = item.base || item.full
    if (!grouped.has(groupKey)) grouped.set(groupKey, [])
    grouped.get(groupKey).push(item.mission)
  }
  const scored = [...grouped.entries()].map(([name, editions]) => ({
    mission: [...editions].sort(compareEdition)[0],
    score: similarity(key, name),
  })).sort((left, right) => right.score - left.score || compareEdition(left.mission, right.mission))
  const bestScore = scored[0]?.score || 0
  if (bestScore >= 0.82 && bestScore - (scored[1]?.score || 0) >= 0.08) {
    return { kind: 'resolved', query: raw, mission: scored[0].mission, fuzzy: true }
  }

  const partial = scored.filter((item) => normalizeMissionName(baseMissionName(item.mission.name)).includes(key))
  const likely = partial.length ? partial.map((item) => item.mission) : scored.filter((item) => item.score >= 0.48).map((item) => item.mission)
  const matches = distinctSuggestions(likely).slice(0, 5)
  return matches.length > 1
    ? { kind: 'ambiguous', query: raw, matches }
    : { kind: 'not_found', query: raw, matches }
}

export async function fetchMissionGeistCatalog({ fetchImpl = fetch, now = Date.now() } = {}) {
  if (catalogMemory && now - catalogLoadedAt < MISSIONGEIST_CACHE_TTL_MS) return catalogMemory
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), listingTimeoutMs)
  try {
    const response = await fetchImpl(MISSIONGEIST_LISTING_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const listing = await response.json()
    const catalog = {
      contentHash: String(listing.contentHash || ''),
      generatedAt: String(listing.generatedAt || ''),
      missions: flattenMissionGeistListing(listing),
    }
    catalogMemory = catalog
    catalogLoadedAt = now
    return catalog
  } catch (error) {
    if (catalogMemory) return catalogMemory
    throw new MissionGeistError('catalog_unavailable', 'MissionGeist could not be reached.', { cause: error })
  } finally {
    clearTimeout(timeout)
  }
}

export async function getMissionScenario({
  query,
  browserType = chromium,
  captureImpl = captureMissionGeistScenario,
  cacheDir = resolve('.tmp', 'missiongeist-cache'),
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  const catalog = await fetchMissionGeistCatalog({ fetchImpl, now })
  const resolution = resolveMissionQuery(query, catalog.missions)
  if (resolution.kind !== 'resolved') return resolution

  const mission = resolution.mission
  const cacheKey = createHash('sha256')
    .update(`${mission.id}\0${mission.canonicalUrl}\0${MISSIONGEIST_CAPTURE_VERSION}`)
    .digest('hex').slice(0, 24)
  const jobKey = `${resolve(cacheDir)}:${cacheKey}`
  if (!captureJobs.has(jobKey)) {
    const job = readOrCaptureMission({ browserType, cacheDir, cacheKey, captureImpl, mission, now })
      .finally(() => captureJobs.delete(jobKey))
    captureJobs.set(jobKey, job)
  }
  const capture = await captureJobs.get(jobKey)
  return { ...resolution, ...capture }
}

export async function captureMissionGeistScenario({
  browserType = chromium,
  canonicalUrl,
  missionName,
} = {}) {
  validateCanonicalMissionUrl(canonicalUrl)
  const browser = await browserType.launch({ headless: true })
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1, viewport: MISSIONGEIST_VIEWPORT })
    await page.goto(canonicalUrl, { timeout: 45_000, waitUntil: 'domcontentloaded' })
    await page.waitForURL((url) => url.origin === MISSIONGEIST_ORIGIN && url.pathname.startsWith('/mission/'), { timeout: 15_000 })
    await page.locator('main#content').waitFor({ state: 'visible', timeout: 30_000 })
    await page.waitForFunction(() => {
      const content = document.querySelector('main#content')
      const text = content?.innerText || ''
      return content && content.getBoundingClientRect().height > 500
        && /MISSION OBJECTIVES|SCENARIO|OBJECTIVES/i.test(text)
    }, { timeout: 30_000 })
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 800) {
        window.scrollTo(0, y)
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      }
      window.scrollTo(0, 0)
      await document.fonts.ready
      const images = [...document.images]
      await Promise.all(images.map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolveImage) => {
          image.addEventListener('load', resolveImage, { once: true })
          image.addEventListener('error', resolveImage, { once: true })
        })))
    })
    await page.waitForTimeout(300)
    const layout = await inspectScenarioLayout(page)
    const safeHeight = Math.min(layout.height, layout.documentHeight - layout.y)
    const safeWidth = Math.min(layout.width, layout.documentWidth - layout.x)
    const ranges = buildCaptureRanges({ ...layout, height: safeHeight })
    const fullScenarioImage = await page.locator('main#content').screenshot({
      animations: 'disabled',
      caret: 'hide',
      type: 'png',
    })
    const croppedImages = await cropScenarioImage(browser, fullScenarioImage, safeWidth, ranges)
    const segments = []
    for (const [index, range] of ranges.entries()) {
      const imageBuffer = croppedImages[index]
      if (imageBuffer.length > MISSIONGEIST_MAX_FILE_BYTES) {
        throw new MissionGeistError('capture_too_large', `MissionGeist image ${index + 1} exceeds the Discord-safe size.`, {
          canonicalUrl, missionName,
        })
      }
      segments.push({
        bytes: imageBuffer.length,
        end: range.end,
        height: range.end - range.start,
        imageBuffer,
        start: range.start,
        width: safeWidth,
      })
    }
    return { contentHeight: safeHeight, contentWidth: safeWidth, segments }
  } catch (error) {
    if (error instanceof MissionGeistError) throw error
    throw new MissionGeistError('capture_failed', 'MissionGeist scenario images could not be generated.', {
      cause: error, canonicalUrl, missionName,
    })
  } finally {
    await browser.close()
  }
}

async function cropScenarioImage(browser, imageBuffer, width, ranges) {
  const cropPage = await browser.newPage({ viewport: { width, height: MISSIONGEIST_SEGMENT_HEIGHT } })
  try {
    const source = `data:image/png;base64,${imageBuffer.toString('base64')}`
    const images = []
    for (const range of ranges) {
      const height = range.end - range.start
      await cropPage.setViewportSize({ width, height })
      await cropPage.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}.crop{position:relative;width:${width}px;height:${height}px;overflow:hidden}.crop img{position:absolute;left:0;top:-${range.start}px;width:${width}px;max-width:none}</style><div class="crop"><img src="${source}"></div>`)
      await cropPage.locator('.crop img').evaluate((image) => image.decode())
      images.push(await cropPage.locator('.crop').screenshot({ type: 'png' }))
    }
    return images
  } finally {
    await cropPage.close()
  }
}

export function buildCaptureRanges({ height, boundaries = [] }, {
  maxHeight = MISSIONGEIST_SEGMENT_HEIGHT,
  overlap = MISSIONGEIST_SEGMENT_OVERLAP,
} = {}) {
  if (!(height > 0)) return []
  if (height <= maxHeight) return [{ start: 0, end: Math.ceil(height) }]
  const cleanBoundaries = [...new Set(boundaries
    .filter((value) => Number.isFinite(value) && value > 120 && value < height - 120)
    .map((value) => Math.round(value)))]
    .sort((left, right) => left - right)
  const ranges = []
  const segmentCount = Math.ceil((height - overlap) / (maxHeight - overlap))
  const idealHeight = (height + overlap * (segmentCount - 1)) / segmentCount
  let start = 0
  while (ranges.length < segmentCount) {
    const remaining = height - start
    const remainingSegments = segmentCount - ranges.length
    if (remainingSegments === 1) {
      ranges.push({ start, end: Math.ceil(height) })
      break
    }
    const target = start + Math.min(maxHeight, idealHeight)
    const minimumForRemainder = height + overlap
      - (remainingSegments - 1) * maxHeight
      + (remainingSegments - 2) * overlap
    const minimum = Math.max(start + Math.floor(idealHeight * 0.75), minimumForRemainder)
    const maximum = Math.min(start + maxHeight, target + 180)
    const candidates = cleanBoundaries.filter((value) => value >= minimum && value <= maximum)
    const end = candidates.sort((left, right) => Math.abs(left - target) - Math.abs(right - target))[0]
      || Math.round(Math.max(minimum, target))
    ranges.push({ start, end })
    start = Math.max(end - overlap, start + 1)
  }
  return ranges
}

export function validateCanonicalMissionUrl(value) {
  let url
  try { url = new URL(value) } catch {
    throw new MissionGeistError('invalid_url', 'MissionGeist returned an invalid scenario URL.')
  }
  if (url.protocol !== 'https:' || url.origin !== MISSIONGEIST_ORIGIN || !/^\/mission\/[A-Za-z0-9_-]+$/.test(url.pathname)) {
    throw new MissionGeistError('invalid_url', 'MissionGeist returned an unsafe scenario URL.')
  }
  return url.href
}

export function clearMissionGeistMemoryCacheForTests() {
  catalogMemory = null
  catalogLoadedAt = 0
  captureJobs.clear()
}

async function inspectScenarioLayout(page) {
  return page.locator('main#content').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const y = rect.top + window.scrollY
    const candidates = [...element.querySelectorAll('section, article, table, h1, h2, h3, .card, .box')]
      .flatMap((child) => {
        const childRect = child.getBoundingClientRect()
        return [childRect.top + window.scrollY - y, childRect.bottom + window.scrollY - y]
      })
    return {
      boundaries: candidates,
      documentHeight: Math.floor(document.documentElement.scrollHeight),
      documentWidth: Math.floor(document.documentElement.scrollWidth),
      height: Math.ceil(rect.height),
      width: Math.ceil(rect.width),
      x: Math.floor(rect.left + window.scrollX),
      y: Math.floor(y),
    }
  })
}

async function readOrCaptureMission({ browserType, cacheDir, cacheKey, captureImpl, mission, now }) {
  await mkdir(cacheDir, { recursive: true })
  const manifestPath = join(cacheDir, `${cacheKey}.json`)
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (manifest.version === MISSIONGEIST_CAPTURE_VERSION
      && manifest.canonicalUrl === mission.canonicalUrl
      && now - Date.parse(manifest.createdAt) >= 0
      && now - Date.parse(manifest.createdAt) < MISSIONGEIST_CACHE_TTL_MS) {
      const segments = await Promise.all(manifest.segments.map(async (segment) => ({
        ...segment,
        imageBuffer: await readFile(join(cacheDir, segment.filename)),
      })))
      return { cacheHit: true, contentHeight: manifest.contentHeight, contentWidth: manifest.contentWidth, segments }
    }
  } catch {}

  const captured = await captureImpl({
    browserType,
    canonicalUrl: mission.canonicalUrl,
    missionName: mission.name,
  })
  const prefix = `${cacheKey}-${randomUUID()}`
  const storedSegments = []
  try {
    for (const [index, segment] of captured.segments.entries()) {
      const filename = `${prefix}-${String(index + 1).padStart(2, '0')}.png`
      const temporaryPath = join(cacheDir, `${filename}.tmp`)
      await writeFile(temporaryPath, segment.imageBuffer)
      await rename(temporaryPath, join(cacheDir, filename))
      storedSegments.push({
        bytes: segment.bytes,
        end: segment.end,
        filename,
        height: segment.height,
        start: segment.start,
        width: segment.width,
      })
    }
    const manifest = {
      canonicalUrl: mission.canonicalUrl,
      contentHeight: captured.contentHeight,
      contentWidth: captured.contentWidth,
      createdAt: new Date(now).toISOString(),
      missionId: mission.id,
      missionName: mission.name,
      segments: storedSegments,
      version: MISSIONGEIST_CAPTURE_VERSION,
    }
    const temporaryManifest = join(cacheDir, `${prefix}.json`)
    await writeFile(temporaryManifest, JSON.stringify(manifest, null, 2))
    await rename(temporaryManifest, manifestPath)
    await pruneCache(cacheDir, now).catch(() => {})
  } finally {
    await rm(join(cacheDir, `${prefix}.json`), { force: true }).catch(() => {})
    for (let index = 0; index < captured.segments.length; index += 1) {
      await rm(join(cacheDir, `${prefix}-${String(index + 1).padStart(2, '0')}.png.tmp`), { force: true }).catch(() => {})
    }
  }
  return { cacheHit: false, ...captured }
}

async function pruneCache(cacheDir, now) {
  const { readdir } = await import('node:fs/promises')
  const entries = await readdir(cacheDir, { withFileTypes: true })
  await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
    const path = join(cacheDir, entry.name)
    const details = await stat(path)
    if (now - details.mtimeMs > MISSIONGEIST_CACHE_TTL_MS * 2) await rm(path, { force: true })
  }))
}

function validateCatalogMission(mission) {
  const id = String(mission.id || '')
  const name = String(mission.name || '').trim()
  const canonicalUrl = validateCanonicalMissionUrl(mission.canonicalUrl)
  if (!id || !name || !mission.sourceCollectionId || !mission.sourceCollectionName) {
    throw new MissionGeistError('catalog_invalid', 'MissionGeist returned an incomplete scenario catalog.')
  }
  if (new URL(canonicalUrl).pathname !== `/mission/${id}`) {
    throw new MissionGeistError('catalog_invalid', 'MissionGeist returned a mismatched canonical scenario URL.')
  }
  return { ...mission, id, name, canonicalUrl }
}

function baseMissionName(name) {
  return String(name)
    .replace(/^Mission\s+\d+[A-Za-z]?\s*[:—-]\s*/i, '')
    .split(/\s+[—–]\s+/).at(-1)
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim()
}

function selectEdition(missions, query) {
  const sorted = [...missions].sort(compareEdition)
  const top = sorted[0]
  const tied = sorted.filter((mission) => editionRank(mission) === editionRank(top))
  if (tied.length === 1) return { kind: 'resolved', query, mission: top, fuzzy: false }
  return { kind: 'ambiguous', query, matches: distinctSuggestions(tied).slice(0, 5) }
}

function compareEdition(left, right) {
  return editionRank(right) - editionRank(left)
    || left.sourceCollectionName.localeCompare(right.sourceCollectionName)
    || left.name.localeCompare(right.name)
}

function editionRank(mission) {
  if (mission.current) return 100_000
  const its = String(mission.sourceCollectionId).match(/^s(\d+)$/i)
  if (its) return 10_000 + Number(its[1])
  return Number(mission.collectionIndex || 0)
}

function distinctSuggestions(missions) {
  const seen = new Set()
  return [...missions].sort(compareEdition).filter((mission) => {
    const key = `${normalizeMissionName(mission.name)}:${mission.sourceCollectionId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function similarity(left, right) {
  const distance = levenshtein(left, right)
  return 1 - distance / Math.max(left.length, right.length, 1)
}

function levenshtein(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const previous = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1))
      diagonal = previous
    }
  }
  return row[right.length]
}
