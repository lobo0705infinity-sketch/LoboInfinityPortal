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
  if (cached && Array.isArray(cached.units) && now - cached.cachedAt < maxAgeMs) return { ...cached, cacheStatus: 'hit' }
  try {
    const fresh = await captureOfficialPayload({ sectorialId: id, armyCode, browser })
    const normalized = normalizeOfficialPayload(fresh, now, id)
    await mkdir(cacheDir, { recursive: true })
    const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(normalized)}\n`, 'utf8')
    await rename(temporary, path)
    return { ...normalized, cacheStatus: cached ? 'refresh' : 'miss' }
  } catch (error) {
    if (cached && now - cached.cachedAt <= maxStaleMs) return { ...cached, cacheStatus: 'stale-fallback', warning: String(error?.message || error) }
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  try {
    let captured
    page.on('response', async (response) => {
      if (response.url() !== endpoint) return
      try { captured = { body: await response.json(), headers: await response.allHeaders() } } catch {}
    })
    await page.goto(`https://infinitytheuniverse.com/army/list/${encodeURIComponent(armyCode)}`, { waitUntil: 'commit', timeout: 45_000 }).catch(() => {})
    for (let elapsed = 0; !captured && elapsed < 45_000; elapsed += 500) await page.waitForTimeout(500)
    if (!captured) throw new Error('Official Infinity Army payload was not observed.')
    return captured
  } finally { await page.close() }
}

export function normalizeOfficialPayload({ body, headers }, cachedAt = Date.now(), sectorialId = null) {
  if (!body || !Array.isArray(body.units) || !body.fireteamChart || !Array.isArray(body.fireteamChart.teams)) throw new Error('Official Infinity Army Fireteam payload is malformed.')
  const unitBySlug = new Map(body.units.map((unit) => [unit.slug, unit]))
  const chart = structuredClone(body.fireteamChart)
  for (const team of chart.teams) for (const unit of team.units || []) {
    const official = unitBySlug.get(unit.slug)
    unit.unitId = official?.id ?? null
    unit.officialUnitName = official?.name ?? null
  }
  return { status: chart.teams.length ? 'available' : 'none', sectorialId: sectorialId ?? null, payloadVersion: body.version ?? null, etag: headers?.etag ?? null, responseDate: headers?.date ?? null, cachedAt, units: body.units.map(normalizeOfficialUnit), weapons: (body.filters?.weapons || []).map(normalizeOfficialWeapon), skills: body.filters?.skills || [], equip: body.filters?.equip || [], fireteamChart: chart }
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
      })),
      options: (group.options || []).map((option) => ({
        id: Number(option.id) || null,
        name: String(option.name || ''),
        weapons: (option.weapons || []).map((weapon) => ({ id: Number(weapon.id) || null, order: Number(weapon.order) || 0, mode: weapon.mode == null ? null : String(weapon.mode), variant: weapon.variant == null ? null : String(weapon.variant), name: weapon.name == null ? null : String(weapon.name) })),
      })),
    })),
  }
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
