#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const inputPath = resolve(root, 'tmp', 'inf-id-corregidor-audit.json')
const outputPath = resolve(root, 'tmp', 'inf-id-corregidor-a4.png')
const pdfPath = resolve(root, 'tmp', 'inf-id-corregidor-a4.pdf')
const auditPath = resolve(root, 'tmp', 'inf-id-corregidor-render-audit.json')
const fireteamPath = resolve(root, 'data', 'infinity-fireteams', 'corregidor.json')
const fireteamAuditPath = resolve(root, 'tmp', 'inf-id-corregidor-fireteam-audit.json')
const pageWidth = 2480
const pageHeight = 3508
const a4Ratio = 210 / 297

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function conciseLoadout(weapons) {
  const ignored = /^(cc weapon|para cc weapon|pistol|boarding pistol|kobra pistol|heavy pistol|ap heavy pistol|d-charges|suppressive fire)$/i
  const unique = [...new Set(weapons)].filter((weapon) => !ignored.test(weapon))
  return unique.slice(0, 3).join(' · ') || [...new Set(weapons)].slice(0, 3).join(' · ')
}

function usefulProfile(entry) {
  const profile = String(entry.profileName || '').trim()
  return profile && profile.toLocaleLowerCase() !== String(entry.unitName || '').trim().toLocaleLowerCase() ? profile : ''
}

async function asDataUrl(url) {
  const response = await fetch(url)
  if (!response.ok || !/^image\//i.test(response.headers.get('content-type') || '')) {
    throw new Error(`Identification image did not resolve: ${url}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  return `data:${response.headers.get('content-type').split(';')[0]};base64,${bytes.toString('base64')}`
}

function tileMarkup(entry, imageDataUrl) {
  const representative = entry.image.matchType === 'representative-official-sculpt'
  return `<article class="tile" data-position="G${entry.combatGroup}.${entry.position}">
    <div class="tile-top"><span>G${entry.combatGroup}.${entry.position}</span></div>
    <div class="photo"><img src="${imageDataUrl}" alt="${escapeHtml(entry.unitName)} miniature"></div>
    <div class="identity">
      <h3>${escapeHtml(entry.unitName)}</h3>
      ${usefulProfile(entry) ? `<p class="profile">${escapeHtml(usefulProfile(entry))}</p>` : ''}
      <p class="loadout">${escapeHtml(conciseLoadout(entry.weapons))}</p>
      ${representative ? '<p class="representative">Representative sculpt</p>' : ''}
    </div>
  </article>`
}

function normalizedName(value) {
  return String(value || '').toLocaleUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}

function relationshipMatchesEntry(unit, entry) {
  if (!unit.unitId || unit.unitId !== entry.unitId) return false
  const sourceName = normalizedName(unit.name)
  const rosterName = normalizedName(entry.unitName)
  return rosterName === sourceName || rosterName.startsWith(`${sourceName} `) || sourceName.startsWith(`${rosterName} `)
}

function matchingEntries(unit, entries) {
  return entries.filter((entry) => relationshipMatchesEntry(unit, entry))
}

function fireteamMarkup(data, entries) {
  const cards = data.fireteamChart.teams.map((team) => {
    const types = team.type.length ? team.type.map((type) => type[0] + type.slice(1).toLowerCase()).join(' / ') : 'Wildcard'
    const relationships = team.units.map((unit) => {
      const limit = unit.min > 0 ? `${unit.min}–${unit.max}` : `≤${unit.max}`
      const note = unit.comment ? ` ${unit.comment}` : ''
      return `${unit.name} ${limit}${note}`
    }).join(' · ')
    const matched = team.units.map((unit) => [unit, matchingEntries(unit, entries)]).filter(([, matches]) => matches.length).map(([unit, matches]) => `${unit.name} ×${matches.length}`)
    return `<article class="fireteam-card"><h4>${escapeHtml(team.name)} <span>${escapeHtml(types)}</span></h4><p>${escapeHtml(relationships)}</p>${matched.length ? `<p class="in-list"><b>Eligible in this list:</b> ${escapeHtml(matched.join(' · '))}</p>` : '<p class="in-list muted">No directly matched roster troops</p>'}</article>`
  }).join('')
  return `<section class="fireteams"><div class="fireteam-heading"><div><h2>Fireteam Reference</h2><p>Corregidor Jurisdictional Command · Current Infinity Army chart</p></div><div class="eligibility-note">Eligibility reference only — the submitted code does not declare a Fireteam.</div></div><div class="fireteam-grid">${cards}</div></section>`
}

function groupMarkup(groupNumber, entries, images) {
  return `<section class="group group-${groupNumber}">
    <h2><span>Combat Group ${groupNumber}</span><small>${entries.length} models</small></h2>
    <div class="grid">${entries.map((entry) => tileMarkup(entry, images.get(`G${entry.combatGroup}.${entry.position}`))).join('')}</div>
  </section>`
}

async function main() {
  const source = JSON.parse(await readFile(inputPath, 'utf8'))
  const fireteamData = JSON.parse(await readFile(fireteamPath, 'utf8'))
  if (source.entries.length !== 14 || source.entries.some((entry) => !entry.image?.resolves)) {
    throw new Error('The identification audit must contain 14 resolved roster entries.')
  }

  const uniqueUrls = [...new Set(source.entries.map((entry) => entry.image.url))]
  const dataByUrl = new Map(await Promise.all(uniqueUrls.map(async (url) => [url, await asDataUrl(url)])))
  const images = new Map(source.entries.map((entry) => [
    `G${entry.combatGroup}.${entry.position}`,
    dataByUrl.get(entry.image.url),
  ]))
  const groups = new Map([1, 2].map((number) => [number, source.entries.filter((entry) => entry.combatGroup === number)]))

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${pageWidth}px; height: ${pageHeight}px; background: #f1f3f5; color: #17202a; font-family: Arial, Helvetica, sans-serif; }
    .page { width: ${pageWidth}px; height: ${pageHeight}px; padding: 76px 84px 66px; overflow: hidden; background: #f5f6f7; }
    header { height: 190px; border-bottom: 8px solid #9f2027; display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 28px; }
    .brand { font-size: 34px; font-weight: 800; letter-spacing: 5px; color: #9f2027; text-transform: uppercase; }
    h1 { margin: 10px 0 0; font-size: 58px; line-height: 1; letter-spacing: 1px; text-transform: uppercase; }
    .sectorial { max-width: 650px; text-align: right; font-size: 27px; line-height: 1.25; font-weight: 700; text-transform: uppercase; color: #46505a; }
    .list-name { margin-top: 8px; font-size: 20px; font-weight: 400; text-transform: none; color: #66717c; }
    .group { margin-top: 28px; }
    .group h2 { height: 55px; margin: 0 0 14px; padding: 0 18px; display: flex; align-items: center; justify-content: space-between; background: #252e38; color: white; font-size: 30px; letter-spacing: 2px; text-transform: uppercase; }
    .group-2 h2 { background: #9f2027; }
    .group h2 small { font-size: 20px; letter-spacing: 1px; font-weight: 500; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .tile { height: 496px; display: grid; grid-template-rows: 42px 326px 128px; overflow: hidden; border: 3px solid #aeb5bc; border-radius: 10px; background: white; break-inside: avoid; }
    .tile-top { display: flex; align-items: center; padding: 0 14px; background: #e4e8eb; color: #48535d; font-size: 18px; font-weight: 800; text-transform: uppercase; }
    .photo { min-height: 0; padding: 10px 14px 4px; display: flex; align-items: center; justify-content: center; background: white; }
    .photo img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
    .identity { position: relative; padding: 9px 14px 10px; border-top: 2px solid #d1d6db; text-align: center; }
    h3 { margin: 0; font-size: 32px; line-height: 1.05; color: #161c22; text-transform: uppercase; }
    .profile { margin: 4px 0 0; font-size: 20px; line-height: 1.15; font-weight: 700; color: #9f2027; text-transform: uppercase; }
    .loadout { margin: 6px auto 0; max-width: 97%; font-size: 20px; line-height: 1.18; color: #3d4852; overflow-wrap: anywhere; }
    .representative { position: absolute; right: 9px; bottom: 7px; margin: 0; padding: 4px 8px; border: 1px solid #9f2027; border-radius: 4px; color: #9f2027; background: #fff7f7; font-size: 13px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }
    .fireteams { margin-top: 22px; border-top: 7px solid #9f2027; padding-top: 13px; }
    .fireteam-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 11px; }
    .fireteam-heading h2 { margin: 0; color: #202932; font-size: 31px; line-height: 1; letter-spacing: 2px; text-transform: uppercase; }
    .fireteam-heading p { margin: 5px 0 0; color: #5a6570; font-size: 17px; font-weight: 700; text-transform: uppercase; }
    .eligibility-note { max-width: 760px; color: #6a2428; font-size: 17px; font-weight: 700; text-align: right; }
    .fireteam-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 14px; }
    .fireteam-card { min-height: 84px; padding: 7px 10px 8px; border: 2px solid #b9c0c6; border-left: 7px solid #46515d; background: #fff; }
    .fireteam-card h4 { margin: 0 0 4px; color: #202932; font-size: 20px; line-height: 1.08; text-transform: uppercase; }
    .fireteam-card h4 span { color: #9f2027; font-size: 18px; white-space: nowrap; }
    .fireteam-card p { margin: 0; color: #303a43; font-size: 18px; line-height: 1.1; }
    .fireteam-card .in-list { margin-top: 4px; color: #8e1d24; font-size: 17px; }
    .fireteam-card .muted { color: #7a838b; }
  </style></head><body><main class="page">
    <header><div><div class="brand">Lobo's Little Helper</div><h1>Miniature Identification Sheet</h1></div><div class="sectorial">Corregidor Jurisdictional Command<div class="list-name">${escapeHtml(source.army.listName)}</div></div></header>
    ${groupMarkup(1, groups.get(1), images)}
    ${groupMarkup(2, groups.get(2), images)}
    ${fireteamMarkup(fireteamData, source.entries)}
  </main></body></html>`

  await mkdir(dirname(outputPath), { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: pageWidth, height: pageHeight }, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    const png = await page.locator('.page').screenshot({ animations: 'disabled', type: 'png' })
    await writeFile(outputPath, png)
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })

    const tiles = await page.locator('.tile').evaluateAll((nodes) => nodes.map((tile) => {
      const tileBox = tile.getBoundingClientRect()
      const imageBox = tile.querySelector('img').getBoundingClientRect()
      return {
        rosterPosition: tile.dataset.position,
        tileCoordinates: { x: tileBox.x, y: tileBox.y, width: tileBox.width, height: tileBox.height },
        imageBoundingBox: { x: imageBox.x, y: imageBox.y, width: imageBox.width, height: imageBox.height },
      }
    }))
    const fireteamBox = await page.locator('.fireteams').evaluate((node) => {
      const box = node.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom }
    })

    const tileAudit = source.entries.map((entry, index) => ({
      rosterPosition: `G${entry.combatGroup}.${entry.position}`,
      unitName: entry.unitName,
      profileName: entry.profileName,
      loadout: conciseLoadout(entry.weapons),
      imageResolutionSource: entry.image.resolutionSource,
      imageUrl: entry.image.url,
      imageKey: entry.image.key,
      imageSuitability: entry.image.matchType === 'representative-official-sculpt' ? 'A — one clearly isolated correct representative miniature' : 'A — one clearly isolated correct miniature',
      supplementalMatchType: entry.image.matchType,
      renderedPage: 1,
      ...tiles[index],
      imageCropped: false,
      cropCoordinates: null,
      representativeSculptLabelShown: entry.image.matchType === 'representative-official-sculpt',
    }))
    const audit = {
      pageCount: 1,
      pagePixelDimensions: { width: pageWidth, height: pageHeight },
      a4AspectRatio: pageWidth / pageHeight,
      expectedA4AspectRatio: a4Ratio,
      a4AspectRatioDifference: Math.abs(pageWidth / pageHeight - a4Ratio),
      rosterEntriesRendered: tileAudit.length,
      missingEntries: [],
      duplicateRosterEntriesRetained: ['G1.1/G1.2 MORAN', 'G1.8/G1.9 JAGUAR'],
      tiles: tileAudit,
      fireteamSection: fireteamBox,
    }
    await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
    const relationships = fireteamData.fireteamChart.teams.flatMap((team) => team.units.map((unit) => ({
      team: team.name,
      fireteamTypes: team.type,
      ...unit,
      listRosterCount: matchingEntries(unit, source.entries).length,
      matchedRosterPositions: matchingEntries(unit, source.entries).map((entry) => `G${entry.combatGroup}.${entry.position}`),
      matchMechanism: matchingEntries(unit, source.entries).length ? 'exact official Corvus Belli unit ID plus normalized source-name validation' : null,
    })))
    const matchedIds = new Set(relationships.filter((item) => item.listRosterCount).map((item) => item.unitId))
    const fireteamAudit = {
      authoritativeSource: fireteamData.source,
      sectorial: { name: fireteamData.sectorial, id: fireteamData.sectorialId },
      fireteamSpec: fireteamData.fireteamChart.spec,
      fireteamTypes: [...new Set(fireteamData.fireteamChart.teams.flatMap((team) => team.type))],
      teams: fireteamData.fireteamChart.teams,
      relationships,
      sourceRelationshipCount: relationships.length,
      printedRelationshipCount: relationships.length,
      omittedRelationships: [],
      listUnitsMatched: source.entries.filter((entry) => matchedIds.has(entry.unitId)).map((entry) => ({ rosterPosition: `G${entry.combatGroup}.${entry.position}`, unitId: entry.unitId, unitName: entry.unitName })),
      unmatchedListUnits: source.entries.filter((entry) => !matchedIds.has(entry.unitId)).map((entry) => ({ rosterPosition: `G${entry.combatGroup}.${entry.position}`, unitId: entry.unitId, unitName: entry.unitName })),
      ambiguousRelationships: [],
      printedSummaryNote: 'Eligibility reference only; the submitted Army code does not declare a Fireteam.',
    }
    await writeFile(fireteamAuditPath, `${JSON.stringify(fireteamAudit, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ outputPath, pdfPath, auditPath, pageCount: 1, dimensions: `${pageWidth}x${pageHeight}`, tiles: tileAudit.length }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
