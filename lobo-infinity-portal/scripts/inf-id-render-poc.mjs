#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import {
  decodeArmyCode,
  decodeArmyList,
  normalizeArmyCodeInput,
} from './infinity-army-decode.mjs'

const canonicalArmyCode = 'gfYKY29ycmVnaWRvckFJcyB0aGF0IGFuIElndWFuYSBpbiB5b3VyIHBvY2tldCBvciBhcmUgeW91IGp1c3QgaGFwcHkgdG8gc2VlIG1lP4EsAgEBAAkAgaUBBAAAAIGlAQQAAACHaAEJAAAAgSgBAQAAAIYPAAEAAACBiwEGAAAAhisBAwAAAIGUAQMAAACBlAEDAAACAQAFAIGqAQEAAACBfwECAAAAh2UBAQAAAIEoAQoAAACBmgEBAAA%3D'
const infinityDataOrigin = 'https://infinity.2nirwana.de'
const rendererPathPattern = /^\/cards\/view\/[A-Za-z0-9-]+$/
const portalRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(portalRoot, 'tmp', 'inf-id-corregidor-audit.json')
const supplementalCatalogPath = resolve(portalRoot, 'data', 'infinity-miniatures', 'supplemental-images.json')
const allowedMatchTypes = new Set([
  'exact-profile-sculpt',
  'exact-troop-sculpt',
  'representative-official-sculpt',
])

async function requestImageRenderer(armyCode) {
  const url = new URL('/cards/generate', infinityDataOrigin)
  url.searchParams.set('armyData', armyCode)
  url.searchParams.set('unit', 'inch')
  url.searchParams.set('style', 'a4_image')
  url.searchParams.set('showUnitImages', 'true')
  url.searchParams.set('showEquipmentWeapons', 'true')
  url.searchParams.set('showSkillWeapon', 'true')

  const response = await fetch(url, { redirect: 'manual' })
  if (response.status !== 302 && response.status !== 303) {
    throw new Error(`Infinity-Data image renderer returned HTTP ${response.status}.`)
  }
  const viewUrl = new URL(response.headers.get('location'), infinityDataOrigin)
  if (viewUrl.origin !== infinityDataOrigin || !rendererPathPattern.test(viewUrl.pathname)) {
    throw new Error('Infinity-Data image renderer returned an unexpected location.')
  }
  return viewUrl
}

async function inspectRenderedImages(armyCode) {
  const viewUrl = await requestImageRenderer(armyCode)
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } })
    await page.goto(viewUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
    await page.locator('.card[data-info^="combinedId:"]').first().waitFor({ timeout: 30_000 })

    const cards = await page.locator('.card[data-info^="combinedId:"]').evaluateAll((nodes) => nodes.map((card) => {
      const combinedId = card.getAttribute('data-info')?.replace(/^combinedId:/, '') || null
      const image = card.querySelector('img.unit-img')
      return {
        combinedId,
        image: image
          ? {
              key: image.getAttribute('src')?.split('/').pop() || null,
              naturalHeight: image.naturalHeight,
              naturalWidth: image.naturalWidth,
              resolves: image.complete && image.naturalWidth > 0,
              url: image.src || null,
            }
          : null,
      }
    }))

    const byCombinedId = new Map()
    for (const card of cards) {
      if (!byCombinedId.has(card.combinedId)) byCombinedId.set(card.combinedId, card.image)
    }
    return { byCombinedId, viewUrl: viewUrl.href }
  } finally {
    await browser.close()
  }
}

function flattenRaw(codeData) {
  return codeData.combatGroups.flatMap((group) => group.members.map((member, index) => ({
    combatGroup: group.combatGroup,
    position: index + 1,
    ...member,
  })))
}

function flattenNormalized(list) {
  return list.combatGroups.flatMap((group) => group.entries.map((entry, index) => ({
    position: index + 1,
    ...entry,
  })))
}

function fidelityDiscrepancies(rawEntries, normalizedEntries) {
  const discrepancies = []
  if (rawEntries.length !== normalizedEntries.length) {
    discrepancies.push(`entry count: raw ${rawEntries.length}, normalized ${normalizedEntries.length}`)
  }
  const count = Math.min(rawEntries.length, normalizedEntries.length)
  for (let index = 0; index < count; index += 1) {
    const raw = rawEntries[index]
    const normalized = normalizedEntries[index]
    if (raw.combatGroup !== normalized.combatGroup) discrepancies.push(`entry ${index + 1}: combat group differs`)
    if (raw.position !== normalized.position) discrepancies.push(`entry ${index + 1}: position differs`)
    if (raw.combinedId !== normalized.combinedId) discrepancies.push(`entry ${index + 1}: combined ID differs`)
  }
  return discrepancies
}

function percentage(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0
}

function supplementalKey({ unitId, profileGroupId, optionId, profileId }) {
  return `${unitId}:${profileGroupId}:${optionId}:${profileId}`
}

async function loadSupplementalCatalog() {
  const catalog = JSON.parse(await readFile(supplementalCatalogPath, 'utf8'))
  if (catalog.version !== 1 || !Array.isArray(catalog.entries)) {
    throw new Error('Unsupported supplemental miniature catalog.')
  }

  const byId = new Map()
  for (const entry of catalog.entries) {
    if (![entry.unitId, entry.profileGroupId, entry.optionId, entry.profileId].every(Number.isInteger)) {
      throw new Error(`Supplemental catalog entry has incomplete stable IDs: ${entry.unitName || 'unknown'}`)
    }
    if (!allowedMatchTypes.has(entry.image?.matchType)) {
      throw new Error(`Supplemental catalog entry has an invalid match type: ${entry.unitName || 'unknown'}`)
    }
    const key = supplementalKey(entry)
    if (byId.has(key)) throw new Error(`Duplicate supplemental catalog ID key: ${key}`)
    byId.set(key, entry)
  }
  return byId
}

async function imageUrlResolves(url) {
  try {
    const response = await fetch(url, { headers: { range: 'bytes=0-1023' } })
    return response.ok && /^image\//i.test(response.headers.get('content-type') || '')
  } catch {
    return false
  }
}

async function main() {
  const armyCode = normalizeArmyCodeInput(canonicalArmyCode)
  const [codeData, normalized] = await Promise.all([
    Promise.resolve(decodeArmyCode(armyCode)),
    decodeArmyList({ input: armyCode }),
  ])
  const renderedImages = await inspectRenderedImages(armyCode)
  const supplementalCatalog = await loadSupplementalCatalog()
  const rawEntries = flattenRaw(codeData)
  const normalizedEntries = flattenNormalized(normalized)
  const discrepancies = fidelityDiscrepancies(rawEntries, normalizedEntries)
  const firstImageUse = new Map()

  const entries = await Promise.all(normalizedEntries.map(async (entry, index) => {
    const raw = rawEntries[index]
    const renderedImage = renderedImages.byCombinedId.get(raw.combinedId) || null
    const profileId = Number(raw.combinedId.split('-').at(-1)) || null
    const supplemental = supplementalCatalog.get(supplementalKey({
      unitId: raw.unitId,
      profileGroupId: raw.groupId,
      optionId: raw.optionId,
      profileId,
    })) || null
    if (supplemental && supplemental.unitName !== entry.unit) {
      throw new Error(`Supplemental ID match failed defensive name validation for ${raw.combinedId}.`)
    }
    const supplementalResolves = !renderedImage?.resolves && supplemental
      ? await imageUrlResolves(supplemental.image.url)
      : false
    const resolutionSource = renderedImage?.resolves
      ? 'infinity-data'
      : supplementalResolves
        ? 'supplemental-catalog'
        : 'unresolved'
    const selected = renderedImage?.resolves ? renderedImage : supplementalResolves ? supplemental.image : null
    const imageUrl = selected?.url || null
    const imageKey = renderedImage?.resolves
      ? renderedImage.key
      : imageUrl
        ? new URL(imageUrl).pathname.split('/').pop()
        : null
    const duplicateImageOf = imageUrl && firstImageUse.has(imageUrl) ? firstImageUse.get(imageUrl) : null
    if (imageUrl && !firstImageUse.has(imageUrl)) {
      firstImageUse.set(imageUrl, `combat-group-${entry.combatGroup}-position-${entry.position}`)
    }

    return {
      combatGroup: entry.combatGroup,
      position: entry.position,
      unitName: entry.unit || null,
      profileName: entry.profile || null,
      weapons: entry.weapons || [],
      unitId: raw.unitId ?? null,
      profileId,
      otherIds: {
        sectorialId: codeData.sectorialId ?? null,
        profileGroupId: raw.groupId ?? null,
        optionId: raw.optionId ?? null,
        combinedProfileId: raw.combinedId ?? null,
      },
      image: {
        url: imageUrl,
        key: imageKey,
        resolutionSource,
        source: renderedImage?.resolves
          ? 'Infinity-Data a4_image .unit-img selected from Corvus Belli miniature data by unit/profile-group/option IDs'
          : supplementalResolves
            ? supplemental.image.source
            : null,
        sourceUrl: renderedImage?.resolves ? renderedImages.viewUrl : supplementalResolves ? supplemental.image.sourceUrl : null,
        matchType: supplementalResolves ? supplemental.image.matchType : null,
        resolves: Boolean(imageUrl),
      },
      duplicateImageOf,
    }
  }))

  const uniqueUnitIds = new Set(entries.map((entry) => entry.unitId).filter((value) => value !== null))
  const imagedUnitIds = new Set(entries.filter((entry) => entry.image.resolves).map((entry) => entry.unitId))
  const uniqueImages = new Set(entries.map((entry) => entry.image.url).filter(Boolean))
  const entriesWithImage = entries.filter((entry) => entry.image.resolves).length
  const infinityDataCount = entries.filter((entry) => entry.image.resolutionSource === 'infinity-data').length
  const supplementalCount = entries.filter((entry) => entry.image.resolutionSource === 'supplemental-catalog').length
  const audit = {
    army: {
      faction: normalized.faction || null,
      sectorial: normalized.sectorial || null,
      listName: normalized.listName || null,
      armyCode,
    },
    entries,
    summary: {
      rosterEntries: entries.length,
      uniqueTroopTypes: uniqueUnitIds.size,
      entriesWithImage,
      entriesWithoutImage: entries.length - entriesWithImage,
      uniqueImages: uniqueImages.size,
    },
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8')

  console.log(`Army: ${audit.army.sectorial} — ${audit.army.listName}`)
  console.log(`Infinity-Data image audit: ${renderedImages.viewUrl}`)
  console.log('\nComplete decoded roster:')
  for (const entry of entries) {
    console.log(`G${entry.combatGroup}.${entry.position} ${entry.unitName} / ${entry.profileName}`)
    console.log(`  weapons: ${entry.weapons.join(', ') || '(none)'}`)
    console.log(`  IDs: unit=${entry.unitId ?? 'null'}, profile=${entry.profileId ?? 'null'}, group=${entry.otherIds.profileGroupId ?? 'null'}, option=${entry.otherIds.optionId ?? 'null'}, combined=${entry.otherIds.combinedProfileId ?? 'null'}`)
    console.log(`  image [${entry.image.resolutionSource}]: ${entry.image.url || '(unavailable)'}${entry.duplicateImageOf ? `; duplicate of ${entry.duplicateImageOf}` : ''}`)
  }

  console.log('\nAudit 1 — Roster fidelity')
  console.log(discrepancies.length ? `FAIL: ${discrepancies.join('; ')}` : `PASS: ${entries.length} entries retain identical group/order/combined-profile alignment with the normalized pipeline.`)
  console.log('Names, selected profiles, and weapons are copied directly from the existing normalized decodeArmyList result.')

  console.log('\nAudit 2 — Source traceability')
  console.log('A: unit/profile names and weapons; combinedProfileId (existing normalized /inf-list data).')
  console.log('B: sectorialId, unitId, profileGroupId, and optionId (canonical Army-code decode; discarded from normalized entries).')
  console.log('C: profileId (final component of Infinity-Data combined profile ID); Infinity-Data image URL/key from a loaded .unit-img; supplemental match from an exact four-ID catalog key.')
  console.log('D: image URL/key for cards where Infinity-Data rendered no successfully loaded .unit-img.')

  console.log('\nAudit 3 — Image coverage')
  console.log(`Roster entries: ${entries.length}`)
  console.log(`Unique troop types: ${uniqueUnitIds.size}`)
  console.log(`Entries with images: ${entriesWithImage}/${entries.length} (${percentage(entriesWithImage, entries.length)}%)`)
  console.log(`Infinity-Data resolved entries: ${infinityDataCount}`)
  console.log(`Supplemental-catalog resolved entries: ${supplementalCount}`)
  console.log(`Unique troop types with images: ${imagedUnitIds.size}/${uniqueUnitIds.size} (${percentage(imagedUnitIds.size, uniqueUnitIds.size)}%)`)
  console.log(`Unique images: ${uniqueImages.size}`)
  console.log(`Unresolved: ${entries.filter((entry) => !entry.image.resolves).map((entry) => `G${entry.combatGroup}.${entry.position} ${entry.unitName}`).join('; ') || '(none)'}`)
  console.log(`\nRecommendation: ${entriesWithImage === entries.length ? 'READY FOR A4 RENDERER — Infinity-Data first, stable-ID supplemental fallback second.' : uniqueUnitIds.size ? 'NOT READY — Stable IDs are available, but image coverage remains incomplete.' : 'NOT READY — Stable identifiers are insufficient.'}`)
  console.log(`\nWrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
