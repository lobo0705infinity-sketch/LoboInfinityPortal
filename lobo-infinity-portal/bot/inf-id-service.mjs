import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { decodeArmyCode, decodeArmyList, normalizeArmyCodeInput, normalizeArmyCodeForInfinityDataTransport } from '../scripts/infinity-army-decode.mjs'
import { chooseMiniature, fetchImageData, loadSupplementalMiniatures } from './inf-id-miniatures.mjs'
import { getFireteamReference, matchFireteamRoster } from './inf-id-fireteams.mjs'
import { renderIdentificationSheet } from './inf-id-renderer.mjs'

const infinityDataOrigin = 'https://infinity.2nirwana.de'
const viewPath = /^\/cards\/view\/[A-Za-z0-9-]+$/

export class InfIdError extends Error {
  constructor(code, message, options = {}) { super(message, options); this.name = 'InfIdError'; this.code = code }
}

export function createInfIdOutputDir() { return resolve('.tmp', 'inf-id-production', crypto.randomUUID()) }

export async function generateInfId({ input, outputDir, browserFactory = () => chromium.launch({ headless: true }), dependencies = {} } = {}) {
  const started = performance.now()
  let armyCode
  try { armyCode = normalizeArmyCodeInput(input) } catch (error) { throw new InfIdError('invalid_army_code', 'Invalid Infinity Army code.', { cause: error }) }
  const decodeStart = performance.now()
  let raw, normalized
  try { [raw, normalized] = await Promise.all([Promise.resolve(decodeArmyCode(armyCode)), decodeArmyList({ input: armyCode })]) } catch (error) { throw new InfIdError('decode_failed', 'Infinity Army code could not be decoded.', { cause: error }) }
  const decodeMs = performance.now() - decodeStart
  const entries = mergeRoster(raw, normalized)
  if (!entries.length) throw new InfIdError('empty_roster', 'Infinity Army list is empty.')
  const destination = outputDir || createInfIdOutputDir()
  await mkdir(destination, { recursive: true })
  let browser
  try {
    browser = await browserFactory()
    const miniatureStart = performance.now()
    const catalog = dependencies.supplementalCatalog || await loadSupplementalMiniatures()
    const infinityImages = dependencies.infinityImages || await inspectInfinityDataImages(armyCode, browser)
    const resolved = []
    const imageFetches = new Map()
    const loadImage = (url) => {
      if (!imageFetches.has(url)) imageFetches.set(url, (dependencies.fetchImageData || fetchImageData)(url))
      return imageFetches.get(url)
    }
    for (const entry of entries) {
      let image = chooseMiniature({ rosterEntry: entry, infinityDataImage: infinityImages.get(entry.combinedId), supplementalCatalog: catalog })
      let imageDataUrl = null
      if (image.url) {
        try { imageDataUrl = await loadImage(image.url) } catch (error) {
          if (image.resolutionSource === 'infinity-data') {
            image = chooseMiniature({ rosterEntry: entry, infinityDataImage: null, supplementalCatalog: catalog })
            if (image.url) try { imageDataUrl = await loadImage(image.url) } catch {}
          }
        }
      }
      if (!imageDataUrl) image = { url: null, key: null, matchType: null, resolutionSource: 'unresolved', resolves: false }
      resolved.push({ ...entry, image, imageDataUrl })
    }
    const miniatureMs = performance.now() - miniatureStart
    const fireteamStart = performance.now()
    const fireteams = dependencies.fireteams || await getFireteamReference({ sectorialId: raw.sectorialId, armyCode, browser })
    const fireteamMatches = matchFireteamRoster(fireteams, resolved)
    const fireteamMs = performance.now() - fireteamStart
    const renderStart = performance.now()
    const artifacts = await renderIdentificationSheet({ army: { faction: normalized.faction, sectorial: normalized.sectorial, sectorialId: raw.sectorialId, listName: normalized.listName }, entries: resolved, fireteams, fireteamMatches, outputDir: destination, browser })
    const renderMs = performance.now() - renderStart
    return { ...artifacts, armyCode, entries: resolved, fireteams, fireteamMatches, missingImageCount: resolved.filter((entry) => !entry.image.resolves).length, timings: { decodeMs, miniatureMs, fireteamMs, renderMs, totalMs: performance.now() - started }, outputDir: destination }
  } catch (error) {
    await rm(destination, { recursive: true, force: true })
    throw error
  } finally { await browser?.close() }
}

export async function cleanupInfId(result) {
  if (result?.outputDir) await rm(result.outputDir, { recursive: true, force: true })
}

function mergeRoster(raw, normalized) {
  const rawEntries = raw.combatGroups.flatMap((group) => group.members.map((member, index) => ({ ...member, combatGroup: group.combatGroup, position: index + 1 })))
  const normalizedEntries = normalized.combatGroups.flatMap((group) => group.entries.map((entry, index) => ({ ...entry, position: index + 1 })))
  if (rawEntries.length !== normalizedEntries.length) throw new InfIdError('decode_mismatch', 'Canonical and normalized roster lengths differ.')
  return normalizedEntries.map((entry, index) => {
    const source = rawEntries[index]
    if (entry.combatGroup !== source.combatGroup || entry.combinedId !== source.combinedId) throw new InfIdError('decode_mismatch', 'Canonical roster order differs from normalized roster.')
    return { rosterPosition: `G${entry.combatGroup}.${entry.position}`, combatGroup: entry.combatGroup, position: entry.position, unitName: entry.unit, profileName: entry.profile, weapons: entry.weapons || [], unitId: source.unitId, profileGroupId: source.groupId, optionId: source.optionId, profileId: Number(source.combinedId.split('-').at(-1)), combinedId: source.combinedId }
  })
}

async function inspectInfinityDataImages(armyCode, browser) {
  const url = new URL('/cards/generate', infinityDataOrigin)
  url.searchParams.set('armyData', normalizeArmyCodeForInfinityDataTransport(armyCode)); url.searchParams.set('unit', 'inch'); url.searchParams.set('style', 'a4_image'); url.searchParams.set('showUnitImages', 'true')
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) })
  const location = response.headers.get('location')
  const view = location ? new URL(location, infinityDataOrigin) : null
  if (![302, 303].includes(response.status) || !view || view.origin !== infinityDataOrigin || !viewPath.test(view.pathname)) return new Map()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } })
  try {
    await page.goto(view.href, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.locator('.card[data-info^="combinedId:"]').first().waitFor({ timeout: 30_000 })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    await page.waitForFunction(() => [...document.querySelectorAll('img.unit-img')].every((image) => image.complete), null, { timeout: 20_000 }).catch(() => {})
    const cards = await page.locator('.card[data-info^="combinedId:"]').evaluateAll((nodes) => nodes.map((card) => { const image = card.querySelector('img.unit-img'); return { combinedId: card.getAttribute('data-info')?.replace(/^combinedId:/, ''), url: image?.complete && image.naturalWidth > 0 ? image.src : null, key: image?.src?.split('/').pop() || null } }))
    const result = new Map()
    for (const card of cards) if (card.url && !result.has(card.combinedId)) result.set(card.combinedId, card)
    return result
  } finally { await page.close() }
}
