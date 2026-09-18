#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { chromium } from 'playwright'
import { buildGunfighterBenchmarkCatalog } from '../bot/gunfighter-benchmark-catalog.mjs'
import { buildCanonicalGunfighterProfiles } from '../bot/gunfighter-profile-canonicalizer.mjs'
import { buildStandardGunfighterDefenders, GUNFIGHTER_BENCHMARK_VERSION } from '../bot/gunfighter-standard-benchmark.mjs'
import { evaluateGunfighterProfile } from '../bot/gunfighter-rating.mjs'
import { extractWeaponChartRows, normalizeWeaponChartRows } from '../bot/infinity-weapon-chart.mjs'
import { buildCanonicalDataset } from './infinity-army-canonical-dataset.mjs'

const BENCHMARK_WEAPON_ARMY_CODES = [
  // Fusilier, Swiss Guard ML, and Black A.I.R. MSR complete profiles.
  'ZQpwYW5vY2VhbmlhDkJlbmNobWFyayBQYW5PgSwBAQEAAwABAQEAAAAJAQMAAACHEAEDAAA=',
  // Riot Grrl ML complete profile.
  'gfcHYmFrdW5pbhFCZW5jaG1hcmsgQmFrdW5pboEsAQEBAAEAga8BBQAA',
  // Transductor Zond and Reaktion Zond HMG complete profiles.
  'gfUGbm9tYWRzEEJlbmNobWFyayBOb21hZHOBLAEBAQACAIGcAQEAAACBmQEBAAA=',
]

const args = parseArgs(process.argv.slice(2))
if (!args.input) throw new Error('Usage: npm run gunfighters:catalog -- --input <Army code> [--output <catalog.json>]')
const output = resolve(args.output || 'data/infinity-army/gunfighter-benchmark-catalog.json')
const ttsCatalogPath = resolve(args['tts-catalog'] || 'data/infinity-army/tts-profile-catalog.json')
const ttsCatalog = JSON.parse(await readFile(ttsCatalogPath, 'utf8'))
const ttsProfiles = Array.isArray(ttsCatalog.profiles) ? ttsCatalog.profiles : []
const executablePath = args['executable-path'] || process.env.PLAYWRIGHT_EXECUTABLE_PATH
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-webgl'] } : {}),
})
try {
  const captured = await captureOfficialData(browser, args.input)
  const rawWeaponRows = [...await captureWeaponChart(captured.page)]
  for (const armyCode of BENCHMARK_WEAPON_ARMY_CODES) rawWeaponRows.push(...await captureWeaponChartForArmyCode(browser, armyCode))
  const chartRows = dedupeWeaponChartRows(normalizeWeaponChartRows(rawWeaponRows))
  const payloads = await captureAllFactionPayloads(captured.page, captured.metadata, captured.payloads)
  const dataset = buildCanonicalDataset({ metadata: captured.metadata, payloads })
  const profiles = payloads.flatMap((payload) => {
    const sectorialId = endpointId(payload.url)
    const sectorialDataset = buildCanonicalDataset({ metadata: captured.metadata, payloads: [payload] })
    const { fireteamUnitIds, wildcardUnitIds, fireteamProfiles } = fireteamEligibility([payload])
    return buildCanonicalGunfighterProfiles({ dataset: sectorialDataset, weaponChart: chartRows, sectorialId, fireteamUnitIds, wildcardUnitIds, fireteamProfiles, ttsProfiles })
  })
  const defenders = buildStandardGunfighterDefenders(chartRows)
  const catalog = buildGunfighterBenchmarkCatalog({
    profiles,
    defenders,
    officialDataVersion: dataset.datasetId,
    benchmarkVersion: GUNFIGHTER_BENCHMARK_VERSION,
    options: { sourceWeaponChart: 'official' },
  })
  const artifact = {
    ...catalog,
    source: {
      armyVersion: dataset.officialUnitVersion,
      datasetId: dataset.datasetId,
      weaponChartSchema: 'infinity-official-weapon-chart-v1',
      payloadCount: payloads.length,
      weaponRecordCount: chartRows.length,
      ttsProfileCatalog: {
        schemaVersion: ttsCatalog.schemaVersion || null,
        profileCount: ttsCatalog.profileCount || ttsProfiles.length,
        fingerprint: ttsCatalog.fingerprint || null,
        source: ttsCatalog.source || null,
      },
    },
  }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(artifact)}\n`, 'utf8')
  if (args['audit-keys'] && args['audit-output']) {
    const keys = new Set(String(args['audit-keys']).split(',').map((value) => value.trim()).filter(Boolean))
    const audited = profiles.filter((profile) => keys.has(profile.id)).map((profile) => ({ profile, evaluation: evaluateGunfighterProfile(profile, defenders) }))
    const auditOutput = resolve(args['audit-output'])
    await mkdir(dirname(auditOutput), { recursive: true })
    const auditedUnitIds = new Set([...keys].map((key) => Number(key.split(':')[1])))
    const rawUnits = payloads.filter((payload) => endpointId(payload.url) === 502).flatMap((payload) => payload.units || []).filter((unit) => auditedUnitIds.has(Number(unit.id)))
    await writeFile(auditOutput, `${JSON.stringify({ benchmarkVersion: GUNFIGHTER_BENCHMARK_VERSION, defenders, rawUnits, profiles: audited }, null, 2)}\n`, 'utf8')
  }
  console.log(JSON.stringify({ output, entries: artifact.entryCount, payloads: payloads.length, weapons: chartRows.length, fingerprint: artifact.fingerprint }))
  await captured.page.close()
} finally {
  await browser.close()
}

async function captureOfficialData(browser, armyCode) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  let metadata = null
  const payloads = []
  page.on('response', async (response) => {
    const url = response.url().split('?')[0].replace(/\/$/, '')
    try {
      if (/\/army\/infinity\/en\/metadata$/.test(url)) metadata = await response.json()
      else if (/\/army\/units\/en\/\d+$/.test(url)) payloads.push({ ...(await response.json()), url })
    } catch {}
  })
  const normalizedArmyCode = decodeURIComponent(String(armyCode).trim())
  await page.goto(`https://infinityuniverse.com/army/list/${encodeURIComponent(normalizedArmyCode)}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
  const reject = page.getByRole('button', { name: 'Reject All' })
  if (await reject.isVisible().catch(() => false)) await reject.click()
  if (!metadata) throw new Error('Official Infinity Army metadata was not captured.')
  if (!payloads.length) throw new Error('Official Infinity Army unit payload was not captured.')
  return { page, metadata, payloads }
}

async function captureWeaponChart(page) {
  const popupPromise = page.waitForEvent('popup', { timeout: 15_000 }).catch(() => null)
  await page.locator('[title="Weapons Chart"]').click()
  const popup = await popupPromise
  const chartPage = popup || page
  const chartRows = chartPage.locator('tr').filter({ has: chartPage.locator('.imp_armas_nombre') })
  await chartRows.nth(1).waitFor({ state: 'attached', timeout: 60_000 })

  const rowCount = await chartRows.count()
  if (rowCount < 1) {
    throw new Error('Weapons chart did not expose any rows for the loaded army list')
  }
  const rows = await extractWeaponChartRows(chartPage)
  if (popup) await popup.close()
  return rows
}

async function captureWeaponChartForArmyCode(browser, armyCode) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  try {
    await page.goto(`https://infinityuniverse.com/army/list/${encodeURIComponent(armyCode)}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
    const reject = page.getByRole('button', { name: 'Reject All' })
    if (await reject.isVisible().catch(() => false)) await reject.click()
    return await captureWeaponChart(page)
  } finally {
    await page.close()
  }
}

function dedupeWeaponChartRows(rows) {
  const byFingerprint = new Map()
  for (const row of rows) {
    const fingerprint = JSON.stringify([row.name, row.mode, row.ranges, row.damage, row.burst, row.ammo, row.save, row.saveDivisor, row.saveFixed, row.saveModifier, row.savingRolls, row.traits])
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, row)
  }
  return [...byFingerprint.values()]
}

async function captureAllFactionPayloads(page, metadata, seeded) {
  const byId = new Map(seeded.map((payload) => [endpointId(payload.url), payload]))
  const ids = collectFactionIds(metadata.factions)
  for (const id of ids) {
    if (byId.has(id)) continue
    const result = await page.evaluate(async (sectorialId) => {
      const url = `https://api.corvusbelli.com/army/units/en/${sectorialId}`
      const response = await fetch(url)
      if (!response.ok) return { ok: false, status: response.status, url }
      return { ok: true, body: await response.json(), url }
    }, id)
    if (result.ok && Array.isArray(result.body?.units)) byId.set(id, { ...result.body, url: result.url })
  }
  return [...byId.values()]
}

function collectFactionIds(factions) {
  const ids = new Set()
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if (Number.isInteger(Number(value.id))) ids.add(Number(value.id))
    for (const [key, child] of Object.entries(value)) if (key !== 'id') visit(child)
  }
  visit(factions)
  return [...ids].filter((id) => id > 0 && id < 10_000).sort((a, b) => a - b)
}

function fireteamEligibility(payloads) {
  const fireteamUnitIds = new Set()
  const wildcardUnitIds = new Set()
  const fireteamProfiles = []
  for (const payload of payloads) {
    const unitBySlug = new Map((payload.units || []).map((unit) => [unit.slug, Number(unit.id)]))
    for (const team of payload.fireteamChart?.teams || []) for (const member of team.units || []) {
      const id = Number(member.unitId || unitBySlug.get(member.slug))
      if (!Number.isInteger(id)) continue
      const wildcard = !Array.isArray(team.type) || !team.type.length
      const core = Array.isArray(team.type) && team.type.some((type) => String(type).toUpperCase() === 'CORE')
      if (wildcard) wildcardUnitIds.add(id)
      else if (core) fireteamUnitIds.add(id)
      if (wildcard || core) fireteamProfiles.push({ unitId: id, memberName: String(member.name || ''), wildcard })
    }
  }
  return { fireteamUnitIds: [...fireteamUnitIds], wildcardUnitIds: [...wildcardUnitIds], fireteamProfiles }
}

function endpointId(url) { const match = String(url || '').match(/\/(\d+)$/); return match ? Number(match[1]) : null }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) result[values[index].replace(/^--/, '')] = values[index + 1]; return result }
