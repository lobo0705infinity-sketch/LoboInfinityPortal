import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const cacheRoot = resolve('.tmp', 'inf-id-fireteams')
const ttlMs = 24 * 60 * 60 * 1000
const maxStaleMs = 7 * 24 * 60 * 60 * 1000

export function validateSectorialId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1 || id > 9999) throw new Error('Invalid Infinity Army sectorial ID.')
  return id
}

export function fireteamEndpoint(sectorialId) {
  return `https://api.corvusbelli.com/army/units/en/${validateSectorialId(sectorialId)}`
}

export async function getFireteamReference({ sectorialId, armyCode, browser, now = Date.now(), cacheDir = cacheRoot, maxAgeMs = ttlMs }) {
  const id = validateSectorialId(sectorialId)
  const path = resolve(cacheDir, `${id}.json`)
  const cached = await readCache(path)
  if (cached && Array.isArray(cached.units) && Array.isArray(cached.extras) && now - cached.cachedAt < maxAgeMs) return { ...cached, cacheStatus: 'hit' }
  try {
    const fresh = await captureOfficialPayload({ sectorialId: id, armyCode, browser })
    const normalized = normalizeOfficialPayload(fresh, now, id)
    await mkdir(cacheDir, { recursive: true })
    const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(normalized)}\n`, 'utf8')
    await rename(temporary, path)
    return { ...normalized, cacheStatus: cached ? 'refresh' : 'miss' }
  } catch (error) {
    if (cached && Array.isArray(cached.extras) && now - cached.cachedAt <= maxStaleMs) return { ...cached, cacheStatus: 'stale-fallback', warning: String(error?.message || error) }
    return { status: 'unavailable', sectorialId: id, cacheStatus: 'unavailable', warning: String(error?.message || error) }
  }
}

async function readCache(path) {
  try {
    await stat(path)
    const value = JSON.parse(await readFile(path, 'utf8'))
    return value?.sectorialId && Number.isFinite(value.cachedAt) ? value : null
  } catch { return null }
}

async function captureOfficialPayload({ sectorialId, armyCode, browser }) {
  const endpoint = fireteamEndpoint(sectorialId)
  try {
    const requestHeaders = { accept: 'application/json, text/plain, */*', origin: 'https://infinityuniverse.com', referer: 'https://infinityuniverse.com/' }
    const [response, metadataResponse] = await Promise.all([
      fetch(endpoint, { headers: requestHeaders }),
      fetch('https://api.corvusbelli.com/army/infinity/en/metadata', { headers: requestHeaders }),
    ])
    if (response.ok && metadataResponse.ok) {
      return { body: await response.json(), headers: Object.fromEntries(response.headers.entries()), metadata: await metadataResponse.json() }
    }
  } catch {}
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  try {
    let captured
    page.on('response', async (response) => {
      const responseUrl = response.url().split('?')[0].replace(/\/$/, '')
      if (responseUrl !== endpoint) return
      try { captured = { body: await response.json(), headers: await response.allHeaders() } } catch {}
    })
    await page.goto(`https://infinityuniverse.com/army/list/${encodeURIComponent(armyCode)}`, { waitUntil: 'commit', timeout: 45_000 }).catch(() => {})
    for (let elapsed = 0; !captured && elapsed < 45_000; elapsed += 500) await page.waitForTimeout(500)
    if (!captured) throw new Error('Official Infinity Army payload was not observed.')
    return captured
  } finally { await page.close() }
}

export function normalizeOfficialPayload({ body, headers, metadata }, cachedAt = Date.now(), sectorialId = null) {
  if (!body || !Array.isArray(body.units) || !body.fireteamChart || !Array.isArray(body.fireteamChart.teams)) throw new Error('Official Infinity Army Fireteam payload is malformed.')
  const unitBySlug = new Map(body.units.map((unit) => [unit.slug, unit]))
  const chart = structuredClone(body.fireteamChart)
  for (const team of chart.teams) for (const unit of team.units || []) {
    const official = unitBySlug.get(unit.slug) || resolveChartUnitByName(body.units, unit)
    unit.unitId = official?.id ?? null
    unit.officialUnitName = official?.name ?? null
  }
  return { status: chart.teams.length ? 'available' : 'none', sectorialId: sectorialId ?? null, payloadVersion: body.version ?? null, etag: headers?.etag ?? null, responseDate: headers?.date ?? null, cachedAt, units: body.units.map(normalizeOfficialUnit), weapons: (metadata?.weapons || body.filters?.weapons || []).map(normalizeOfficialWeapon), extras: metadata?.extras || body.filters?.extras || [], skills: metadata?.skills || body.filters?.skills || [], equip: metadata?.equips || body.filters?.equip || [], fireteamChart: chart }
}

function resolveChartUnitByName(units, chartUnit) {
  const chartNames = [chartUnit?.name, String(chartUnit?.name || '').replace(/\s*\([^)]*\)\s*/g, ' ')]
    .map(normalizeName)
    .filter(Boolean)
  const candidates = (units || []).filter((unit) => {
    const officialNames = [unit?.name, unit?.isc].map(normalizeName).filter(Boolean)
    return chartNames.some((chartName) => officialNames.some((officialName) => officialName === chartName || officialName.startsWith(`${chartName} `) || chartName.startsWith(`${officialName} `)))
  })
  return candidates.length === 1 ? candidates[0] : null
}

function normalizeOfficialWeapon(weapon) {
  const rawBurst = weapon?.burst
  const numericBurst = Number(rawBurst)
  return {
    id: Number.isInteger(Number(weapon?.id)) ? Number(weapon.id) : null,
    mode: weapon?.mode == null ? null : String(weapon.mode),
    variant: weapon?.variant == null ? null : String(weapon.variant),
    name: String(weapon?.name || ''),
    type: String(weapon?.type || ''),
    burst: rawBurst === '-' ? null : Number.isFinite(numericBurst) ? numericBurst : null,
    burstStatus: rawBurst === '-' ? 'not-applicable' : Number.isFinite(numericBurst) ? 'canonical' : 'unknown',
  }
}

function normalizeOfficialUnit(unit) {
  return {
    id: Number(unit.id) || null,
    name: String(unit.name || ''),
    slug: String(unit.slug || ''),
    profileGroups: (unit.profileGroups || []).map((group) => ({
      id: Number(group.id) || null,
      profiles: (group.profiles || []).map((profile) => ({
        id: Number(profile.id) || null,
        name: String(profile.name || ''),
        bs: Number.isFinite(Number(profile.bs)) ? Number(profile.bs) : null,
        cc: Number.isFinite(Number(profile.cc)) ? Number(profile.cc) : null,
        weapons: (profile.weapons || []).map(normalizeWeaponReference),
        skills: (profile.skills || []).map(normalizeTraitReference),
      })),
      options: (group.options || []).map((option) => ({
        id: Number(option.id) || null,
        name: String(option.name || ''),
        weapons: (option.weapons || []).map(normalizeWeaponReference),
        skills: (option.skills || []).map(normalizeTraitReference),
      })),
    })),
  }
}

function normalizeWeaponReference(weapon) {
  return { id: Number(weapon.id) || null, order: Number(weapon.order) || 0, extra: Array.isArray(weapon.extra) ? weapon.extra.map(Number).filter(Number.isFinite) : [], mode: weapon.mode == null ? null : String(weapon.mode), variant: weapon.variant == null ? null : String(weapon.variant), name: weapon.name == null ? null : String(weapon.name) }
}

function normalizeTraitReference(trait) {
  return { id: Number(trait.id) || null, order: Number(trait.order) || 0 }
}

export function relationshipMatchesEntry(unit, entry) {
  if (!unit.unitId || unit.unitId !== entry.unitId) return false
  const source = normalizeName(unit.name)
  const roster = normalizeName(entry.unitName)
  return roster === source || roster.startsWith(`${source} `) || source.startsWith(`${roster} `)
}

export function matchFireteamRoster(reference, entries) {
  if (reference.status !== 'available') return []
  return reference.fireteamChart.teams.flatMap((team) => (team.units || []).map((unit) => ({ team: team.name, unit: unit.name, matches: entries.filter((entry) => relationshipMatchesEntry(unit, entry)).map((entry) => entry.rosterPosition) }))).filter((item) => item.matches.length)
}

function normalizeName(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}
