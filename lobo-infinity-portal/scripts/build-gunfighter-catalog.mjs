#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { chromium } from 'playwright'
import { buildGunfighterBenchmarkCatalog } from '../bot/gunfighter-benchmark-catalog.mjs'
import { buildCanonicalGunfighterProfiles } from '../bot/gunfighter-profile-canonicalizer.mjs'
import { buildStandardGunfighterDefenders, GUNFIGHTER_BENCHMARK_VERSION } from '../bot/gunfighter-standard-benchmark.mjs'
import { extractWeaponChartRows, normalizeWeaponChartRows } from '../bot/infinity-weapon-chart.mjs'
import { buildCanonicalDataset } from './infinity-army-canonical-dataset.mjs'

const args = parseArgs(process.argv.slice(2))
if (!args.input) throw new Error('Usage: npm run gunfighters:catalog -- --input <Army code> [--output <catalog.json>]')
const output = resolve(args.output || 'data/infinity-army/gunfighter-benchmark-catalog.json')
const executablePath = args['executable-path'] || process.env.PLAYWRIGHT_EXECUTABLE_PATH
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-webgl'] } : {}),
})
try {
  const captured = await captureOfficialData(browser, args.input)
  const chartRows = normalizeWeaponChartRows(await captureWeaponChart(captured.page))
  const payloads = await captureAllFactionPayloads(captured.page, captured.metadata, captured.payloads)
  const dataset = buildCanonicalDataset({ metadata: captured.metadata, payloads })
  const { fireteamUnitIds, wildcardUnitIds, fireteamProfiles } = fireteamEligibility(payloads)
  const profiles = buildCanonicalGunfighterProfiles({ dataset, weaponChart: chartRows, fireteamUnitIds, wildcardUnitIds, fireteamProfiles })
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
    },
  }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(artifact)}\n`, 'utf8')
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
  if (rowCount < 10) {
    throw new Error(`Weapons chart loaded only ${rowCount} rows; expected the full official chart`)
  }
  const rows = await extractWeaponChartRows(chartPage)
  if (popup) await popup.close()
  return rows
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
      if (wildcard) wildcardUnitIds.add(id)
      else fireteamUnitIds.add(id)
      fireteamProfiles.push({ unitId: id, memberName: String(member.name || ''), wildcard })
    }
  }
  return { fireteamUnitIds: [...fireteamUnitIds], wildcardUnitIds: [...wildcardUnitIds], fireteamProfiles }
}

function endpointId(url) { const match = String(url || '').match(/\/(\d+)$/); return match ? Number(match[1]) : null }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) result[values[index].replace(/^--/, '')] = values[index + 1]; return result }
