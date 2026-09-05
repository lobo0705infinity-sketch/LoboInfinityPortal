import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const width = 2480
const height = 3508
const tileCapacity = 15
export const A4_PDF_WIDTH_POINTS = (210 / 25.4) * 72
export const A4_PDF_HEIGHT_POINTS = (297 / 25.4) * 72
const PDF_ROUNDING_INSET_POINTS = 1

export function calculatePdfImagePlacement(imageWidth, imageHeight, pageWidth = A4_PDF_WIDTH_POINTS, pageHeight = A4_PDF_HEIGHT_POINTS) {
  const scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight)
  const renderedWidth = imageWidth * scale
  const renderedHeight = imageHeight * scale
  return {
    scale,
    renderedWidth,
    renderedHeight,
    x: (pageWidth - renderedWidth) / 2,
    y: (pageHeight - renderedHeight) / 2,
  }
}

export function calculateA4PdfImagePlacement(imageWidth, imageHeight) {
  const contained = calculatePdfImagePlacement(imageWidth, imageHeight, A4_PDF_WIDTH_POINTS - (PDF_ROUNDING_INSET_POINTS * 2), A4_PDF_HEIGHT_POINTS - (PDF_ROUNDING_INSET_POINTS * 2))
  return { ...contained, x: contained.x + PDF_ROUNDING_INSET_POINTS, y: contained.y + PDF_ROUNDING_INSET_POINTS }
}

export async function renderIdentificationSheet({ army, entries, fireteams, fireteamMatches, outputDir, browser }) {
  await mkdir(outputDir, { recursive: true })
  const chunks = []
  for (let index = 0; index < entries.length; index += tileCapacity) chunks.push(entries.slice(index, index + tileCapacity))
  const canShareFinalPage = chunks.at(-1)?.length <= 14 && (fireteams.status !== 'available' || fireteams.fireteamChart.teams.length <= 9)
  const pages = chunks.map((items, index) => ({ items, showFireteams: canShareFinalPage && index === chunks.length - 1 }))
  if (!canShareFinalPage) pages.push({ items: [], showFireteams: true })
  const html = documentMarkup({ army, pages, fireteams, fireteamMatches })
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  try {
    await page.setContent(html, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready)
    const outputPages = []
    for (let index = 0; index < pages.length; index += 1) {
      const buffer = await page.locator('.page').nth(index).screenshot({ type: 'png', animations: 'disabled' })
      const name = pages.length === 1 ? 'infinity-identification-sheet.png' : `infinity-identification-sheet-${index + 1}.png`
      const path = resolve(outputDir, name); await writeFile(path, buffer); outputPages.push({ path, name, buffer, width, height })
    }
    const pdfPath = resolve(outputDir, 'infinity-identification-sheet.pdf')
    await writeRasterPagesPdf({ browser, outputPages, pdfPath })
    const pdfBuffer = await readFile(pdfPath)
    const overflow = await page.locator('.page').evaluateAll((nodes) => nodes.map((node) => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth })))
    if (overflow.some((item) => item.scrollHeight - item.clientHeight > 1 || item.scrollWidth - item.clientWidth > 1)) throw new Error(`Identification sheet content overflowed its A4 page: ${JSON.stringify(overflow)}`)
    return { pages: outputPages, pdf: { path: pdfPath, name: 'infinity-identification-sheet.pdf', buffer: pdfBuffer }, pageCount: pages.length, tileCount: entries.length }
  } finally { await page.close() }
}

async function writeRasterPagesPdf({ browser, outputPages, pdfPath }) {
  const pdfPage = await browser.newPage()
  try {
    const placement = calculateA4PdfImagePlacement(width, height)
    const images = outputPages.map(({ buffer }) => `<section class="pdf-page"><img src="data:image/png;base64,${buffer.toString('base64')}" alt=""></section>`).join('')
    const pdfMarkup = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:210mm 297mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}.pdf-page{position:relative;width:${A4_PDF_WIDTH_POINTS}pt;height:${A4_PDF_HEIGHT_POINTS}pt;overflow:hidden;break-after:page;page-break-after:always}.pdf-page:last-child{break-after:auto;page-break-after:auto}.pdf-page img{position:absolute;left:${placement.x}pt;top:${placement.y}pt;width:${placement.renderedWidth}pt;height:${placement.renderedHeight}pt;display:block}</style></head><body>${images}</body></html>`
    await pdfPage.setContent(pdfMarkup, { waitUntil: 'load' })
    await pdfPage.pdf({ path: pdfPath, width: '210mm', height: '297mm', preferCSSPageSize: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  } finally {
    await pdfPage.close()
  }
}

function documentMarkup({ army, pages, fireteams, fireteamMatches }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styles()}</style></head><body>${pages.map((page, index) => `<main class="page"><header><div><div class="brand">Lobo's Little Helper</div><h1>Miniature Identification Sheet</h1></div><div class="army">${esc(army.sectorial || army.faction || 'Infinity Army')}<small>${esc(army.listName || '')}</small></div></header>${groupsMarkup(page.items)}${page.showFireteams ? fireteamMarkup(fireteams, fireteamMatches) : ''}<div class="page-number">Page ${index + 1} of ${pages.length}</div></main>`).join('')}</body></html>`
}

function groupsMarkup(entries) {
  return [...new Set(entries.map((entry) => entry.combatGroup))].map((group) => { const items = entries.filter((entry) => entry.combatGroup === group); return `<section class="group group-${group}"><h2><span>Combat Group ${group}</span><small>${items.length} models</small></h2><div class="grid">${items.map(tileMarkup).join('')}</div></section>` }).join('')
}

function tileMarkup(entry) {
  const profile = distinctProfile(entry)
  return `<article class="tile"><div class="tile-top">${esc(entry.rosterPosition)}</div><div class="photo">${entry.imageDataUrl ? `<img src="${entry.imageDataUrl}" alt="">` : '<div class="missing">No verified<br>miniature image</div>'}</div><div class="identity"><h3>${esc(entry.unitName)}</h3>${profile ? `<p class="profile">${esc(profile)}</p>` : ''}<p class="loadout">${esc(conciseLoadout(entry.weapons))}</p>${entry.image.matchType === 'representative-official-sculpt' ? '<p class="representative">Representative sculpt</p>' : ''}</div></article>`
}

function fireteamMarkup(reference, matches) {
  if (reference.status === 'unavailable') return '<section class="fireteams state"><h2>Fireteam Reference Unavailable</h2><p>The miniature identification sheet is otherwise complete.</p></section>'
  if (reference.status !== 'available') return '<section class="fireteams state"><h2>No Fireteam Reference for This Army</h2></section>'
  const byTeam = new Map(matches.map((match) => [`${match.team}:${match.unit}`, match.matches.length]))
  const cards = reference.fireteamChart.teams.map((team) => { const types = team.type.length ? team.type.join(' / ') : 'WILDCARD'; const units = team.units.map((unit) => `${unit.name} ${unit.min ? `${unit.min}–${unit.max}` : `≤${unit.max}`}${unit.comment ? ` ${unit.comment}` : ''}`).join(' · '); const eligible = team.units.map((unit) => [unit.name, byTeam.get(`${team.name}:${unit.name}`)]).filter(([, count]) => count).map(([name, count]) => `${name} ×${count}`).join(' · '); return `<article><h4>${esc(team.name)} <span>${esc(types)}</span></h4><p>${esc(units)}</p><p class="eligible">${eligible ? `<b>Eligible in this list:</b> ${esc(eligible)}` : 'No directly matched roster troops'}</p></article>` }).join('')
  return `<section class="fireteams"><div class="fireteam-heading"><div><h2>Fireteam Reference</h2><p>Current Corvus Belli Infinity Army chart</p></div><strong>Eligibility only — this list does not declare a Fireteam.</strong></div><div class="fireteam-grid">${cards}</div></section>`
}

function distinctProfile(entry) { const profile = String(entry.profileName || '').trim(); return profile && normalize(profile) !== normalize(entry.unitName) ? profile : '' }
function conciseLoadout(weapons = []) { const ignored = /^(cc weapon|para cc weapon|pistol|boarding pistol|kobra pistol|heavy pistol|ap heavy pistol|d-charges|suppressive fire)$/i; const unique = [...new Set(weapons)].filter((item) => !ignored.test(item)); return (unique.length ? unique : [...new Set(weapons)]).slice(0, 3).join(' · ') }
function normalize(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim() }
function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

function styles() { return `@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#f1f3f5;color:#17202a;font-family:Arial,sans-serif}.page{position:relative;width:${width}px;height:${height}px;padding:76px 84px 36px;overflow:hidden;background:#f5f6f7;break-after:page}header{height:190px;border-bottom:8px solid #9f2027;display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:28px}.brand{font-size:34px;font-weight:800;letter-spacing:5px;color:#9f2027;text-transform:uppercase}h1{margin:10px 0 0;font-size:58px;line-height:1;text-transform:uppercase}.army{max-width:700px;text-align:right;font-size:27px;font-weight:700;text-transform:uppercase;color:#46505a}.army small{display:block;margin-top:8px;font-size:20px;font-weight:400;text-transform:none;color:#66717c}.group{margin-top:28px}.group h2{height:55px;margin:0 0 14px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;background:#252e38;color:#fff;font-size:30px;letter-spacing:2px;text-transform:uppercase}.group-2 h2{background:#9f2027}.group h2 small{font-size:20px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.tile{height:496px;display:grid;grid-template-rows:42px 326px 128px;overflow:hidden;border:3px solid #aeb5bc;border-radius:10px;background:#fff}.tile-top{padding:10px 14px;background:#e4e8eb;color:#48535d;font-size:18px;font-weight:800}.photo{padding:10px 14px 4px;display:flex;align-items:center;justify-content:center}.photo img{width:100%;height:100%;object-fit:contain}.missing{text-align:center;color:#747d85;font-size:28px;font-weight:800;line-height:1.2;text-transform:uppercase}.identity{position:relative;padding:9px 14px;border-top:2px solid #d1d6db;text-align:center}.identity h3{margin:0;font-size:32px;line-height:1.05;text-transform:uppercase}.profile{margin:4px 0 0;font-size:20px;font-weight:700;color:#9f2027;text-transform:uppercase}.loadout{margin:6px auto 0;max-width:97%;font-size:20px;line-height:1.18;color:#3d4852;overflow-wrap:anywhere}.representative{position:absolute;right:9px;bottom:7px;margin:0;padding:4px 8px;border:1px solid #9f2027;color:#9f2027;font-size:13px;font-weight:800;text-transform:uppercase}.fireteams{margin-top:12px;border-top:7px solid #9f2027;padding-top:10px}.fireteam-heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:8px}.fireteam-heading h2,.state h2{margin:0;font-size:31px;text-transform:uppercase}.fireteam-heading p{margin:4px 0 0;font-size:17px;font-weight:700;text-transform:uppercase}.fireteam-heading strong{max-width:760px;color:#6a2428;font-size:17px;text-align:right}.fireteam-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px 14px}.fireteam-grid article{min-height:80px;padding:6px 10px;border:2px solid #b9c0c6;border-left:7px solid #46515d;background:#fff}.fireteam-grid h4{margin:0 0 3px;font-size:20px;line-height:1.05;text-transform:uppercase}.fireteam-grid h4 span{color:#9f2027;font-size:18px}.fireteam-grid p{margin:0;font-size:17px;line-height:1.06}.fireteam-grid .eligible{margin-top:3px;color:#8e1d24;font-size:16px}.state{padding:30px}.state p{font-size:22px}.page-number{position:absolute;right:30px;bottom:6px;color:#747d85;font-size:15px}` }
