#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const rendererOrigin = 'https://infinity.2nirwana.de'
const rendererPath = '/cards/generate'
const rendererViewPattern = /^\/cards\/view\/[A-Za-z0-9-]+$/
const officialArmyOrigin = 'https://infinitytheuniverse.com'
const officialArmyAppOrigins = new Set([
  officialArmyOrigin,
  'https://infinityuniverse.com',
])
const officialArmyPanelSelector = '#panel_lista'
const profilePageWidth = 1150
const profilePageStyles = `
  body { margin: 0 !important; background: #e5e7eb !important; }
  .readable-profile-page {
    column-count: 1 !important;
    width: ${profilePageWidth}px !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 6px !important;
    box-sizing: border-box !important;
    background: #e5e7eb !important;
    color: #111827 !important;
    font-size: 13px !important;
    line-height: 1.3 !important;
  }
  .readable-profile-page > div {
    width: 100% !important;
    margin-bottom: 7px !important;
    break-inside: avoid !important;
  }
  .readable-profile-page .card {
    height: auto !important;
    min-height: 0 !important;
    border: 2px solid #475569 !important;
    background: #f8fafc !important;
  }
  .readable-profile-page .card-content {
    height: auto !important;
    min-height: 0 !important;
    background: #f8fafc !important;
    color: #111827 !important;
  }
  .readable-profile-page .text-background,
  .readable-profile-page .typ-and-category {
    min-height: 24px !important;
    padding-top: 3px !important;
    padding-bottom: 3px !important;
    box-sizing: border-box !important;
    font-size: 14px !important;
    line-height: 1.35 !important;
    background: #f8fafc !important;
    color: #111827 !important;
  }
  .readable-profile-page .equipments-and-skills-column,
  .readable-profile-page .attribut-equipment-skill-column,
  .readable-profile-page .max-meight {
    height: auto !important;
    min-height: 30px !important;
    overflow: visible !important;
    font-size: 14px !important;
    line-height: 1.35 !important;
  }
  .readable-profile-page .equipments-and-skills-column {
    display: grid !important;
    grid-template-columns: minmax(220px, 1fr) minmax(0, 2fr) !important;
    align-items: start !important;
  }
  .readable-profile-page .equipments-and-skills-column > *,
  .readable-profile-page .equipments-and-skills-column .flex,
  .readable-profile-page .attribut-equipment-skill-column > * {
    width: auto !important;
    min-width: 0 !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    white-space: normal !important;
    flex-wrap: wrap !important;
    align-items: flex-start !important;
  }
  .readable-profile-page .unit-header {
    min-height: 34px !important;
    padding: 4px 7px !important;
    box-sizing: border-box !important;
    background: #7f1d1d !important;
    border-color: #7f1d1d !important;
  }
  .readable-profile-page .card-header {
    min-height: 34px !important;
    padding: 4px 8px !important;
    box-sizing: border-box !important;
    background: #1f2937 !important;
    border-color: #1f2937 !important;
  }
  .readable-profile-page .card-header-title {
    font-size: 21px !important;
    line-height: 1.2 !important;
    font-weight: 700 !important;
    background: transparent !important;
    color: #ffffff !important;
    border-color: #ffffff !important;
  }
  .readable-profile-page .card-header-title-text,
  .readable-profile-page .card-header-title-text.light {
    padding: 0 !important;
    font-size: 21px !important;
    line-height: 1.2 !important;
    font-weight: 700 !important;
    background: transparent !important;
    color: #ffffff !important;
    border-color: #ffffff !important;
  }
  .readable-profile-page table {
    font-size: 14px !important;
    line-height: 1.25 !important;
  }
  .readable-profile-page th {
    height: 27px !important;
    padding: 3px 5px !important;
    box-sizing: border-box !important;
    font-size: 14px !important;
    line-height: 1.2 !important;
    font-weight: 700 !important;
    background: #334155 !important;
    color: #ffffff !important;
    border-color: #94a3b8 !important;
  }
  .readable-profile-page td {
    min-height: 27px !important;
    padding: 3px 5px !important;
    box-sizing: border-box !important;
    font-size: 14px !important;
    line-height: 1.2 !important;
    border-color: #94a3b8 !important;
  }
  .readable-profile-page .weapon th,
  .readable-profile-page .weapon td {
    height: 29px !important;
    font-size: 15px !important;
    line-height: 1.2 !important;
    font-weight: 600 !important;
  }
  .readable-profile-page .weapon-table-name-header {
    font-size: 15px !important;
    font-weight: 600 !important;
  }
  .readable-profile-page .range-plus-6,
  .readable-profile-page .range-plus-3,
  .readable-profile-page .range-0,
  .readable-profile-page .range-minus-3,
  .readable-profile-page .range-minus-6 {
    font-size: 16px !important;
    line-height: 1.2 !important;
    font-weight: 700 !important;
    color: #111827 !important;
  }
  .readable-profile-page .army-list-row,
  .readable-profile-page .army-group-title {
    height: auto !important;
    min-height: 0 !important;
    font-size: 17px !important;
    line-height: 1.4 !important;
  }
  .readable-profile-page .army-code {
    height: auto !important;
    min-height: 0 !important;
    font-size: 14px !important;
    line-height: 1.35 !important;
    overflow-wrap: anywhere !important;
  }
  .readable-profile-page .army-list-footer,
  .readable-profile-page .two-columns {
    height: auto !important;
    min-height: 0 !important;
    font-size: 15px !important;
    line-height: 1.35 !important;
  }
  .readable-profile-page .ft-allowed {
    font-size: 17px !important;
    line-height: 1.35 !important;
  }
  .readable-profile-page .ft-team-name,
  .readable-profile-page .ft-member {
    font-size: 18px !important;
    line-height: 1.4 !important;
  }
  .readable-profile-page .ft-member {
    display: flex !important;
    justify-content: flex-start !important;
    align-items: baseline !important;
    gap: 10px !important;
  }
  .readable-profile-page .ft-member > :first-child {
    flex: 0 0 4em !important;
  }
  .readable-profile-page .two-columns {
    gap: 18px !important;
  }
  .readable-profile-page tr { color: #111827 !important; }
`
export const MAX_ARMY_CODE_LENGTH = 4096

export class InfListRenderError extends Error {
  constructor(code, message, options = {}) {
    super(message, options)
    this.name = 'InfListRenderError'
    this.code = code
  }
}

export function validateArmyCode(input) {
  if (input === undefined || input === null) {
    throw new InfListRenderError('missing_army_code', 'Provide one Infinity Army code.')
  }

  const trimmed = String(input).trim()
  if (!trimmed) {
    throw new InfListRenderError('missing_army_code', 'Provide one Infinity Army code.')
  }
  if (trimmed.length > MAX_ARMY_CODE_LENGTH) {
    throw new InfListRenderError('army_code_too_long', `Army code exceeds ${MAX_ARMY_CODE_LENGTH} characters.`)
  }
  if (/^https?:\/\//i.test(trimmed)) {
    throw new InfListRenderError('url_not_allowed', 'Submit a raw Infinity Army code, not a URL.')
  }
  if (/%(?!2B|2F|3D)/i.test(trimmed)) {
    throw new InfListRenderError('invalid_army_code', 'Army code contains unsupported URL encoding.')
  }

  let decoded
  try {
    decoded = decodeURIComponent(trimmed)
  } catch (error) {
    throw new InfListRenderError('invalid_army_code', 'Army code contains malformed URL encoding.', { cause: error })
  }

  if (!/^[A-Za-z0-9+/_=-]+$/.test(decoded)) {
    throw new InfListRenderError('invalid_army_code', 'Army code contains invalid characters.')
  }

  return decoded
}

export function buildOfficialArmyUrl(armyCode) {
  const url = new URL('/army/list/', officialArmyOrigin)
  url.pathname += encodeURIComponent(armyCode)
  return url.href
}

export function buildRendererUrl(armyCode) {
  const url = new URL(rendererPath, rendererOrigin)
  url.searchParams.set('armyData', armyCode)
  url.searchParams.set('unit', 'inch')
  url.searchParams.set('style', 'a4_overview')
  url.searchParams.set('showEquipmentWeapons', 'on')
  url.searchParams.set('showSkillWeapon', 'on')
  return url
}

export async function requestRendererView(armyCode, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(buildRendererUrl(armyCode), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    })

    if (response.status !== 302 && response.status !== 303) {
      throw new InfListRenderError('renderer_rejected', 'Infinity-Data could not render that Army code.')
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new InfListRenderError('renderer_invalid_redirect', 'Infinity-Data returned no rendered-list location.')
    }

    const viewUrl = new URL(location, rendererOrigin)
    if (viewUrl.origin !== rendererOrigin || !rendererViewPattern.test(viewUrl.pathname)) {
      throw new InfListRenderError('renderer_invalid_redirect', 'Infinity-Data returned an unexpected redirect.')
    }

    return viewUrl
  } catch (error) {
    if (error instanceof InfListRenderError) throw error
    if (error?.name === 'AbortError') {
      throw new InfListRenderError('renderer_timeout', 'Infinity-Data timed out.', { cause: error })
    }
    throw new InfListRenderError('renderer_unavailable', 'Infinity-Data is temporarily unavailable.', { cause: error })
  } finally {
    clearTimeout(timeout)
  }
}

export async function renderInfListPng({ input, outputPath, browserType = chromium, fetchImpl } = {}) {
  const armyCode = validateArmyCode(input)
  const rendererViewUrl = await requestRendererView(armyCode, { fetchImpl })

  const browser = await browserType.launch({ headless: true })
  try {
    const profilePages = await captureRenderedProfilePages(browser, rendererViewUrl)
    let readable = null
    try {
      readable = await captureOfficialArmyList(browser, buildOfficialArmyUrl(armyCode))
    } catch {
      // The established full-list image remains usable if the additive official capture fails.
    }

    const finalOutputPath = outputPath ? resolve(outputPath) : null
    if (finalOutputPath) {
      await mkdir(dirname(finalOutputPath), { recursive: true })
      await writeFile(finalOutputPath, profilePages[0].imageBuffer)
    }

    return {
      bytes: profilePages[0].imageBuffer.length,
      height: profilePages[0].height,
      imageBuffer: profilePages[0].imageBuffer,
      officialArmyUrl: buildOfficialArmyUrl(armyCode),
      outputPath: finalOutputPath,
      profilePages,
      readableBytes: readable?.imageBuffer.length ?? null,
      readableHeight: readable?.height ?? null,
      readableImageBuffer: readable?.imageBuffer ?? null,
      readableWidth: readable?.width ?? null,
      rendererViewUrl: rendererViewUrl.href,
      width: profilePages[0].width,
    }
  } finally {
    await browser.close()
  }
}

async function captureRenderedProfilePages(browser, rendererViewUrl) {
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1200, height: 1600 } })
  try {
    await loadRendererPage(page, rendererViewUrl)
    await page.addStyleTag({ content: profilePageStyles })
    const pagination = await page.evaluate(() => {
      const source = document.querySelector('.page')
      if (!source) throw new Error('Infinity-Data profile page was not found.')

      source.classList.add('readable-profile-page')
      const children = [...source.children].filter((child) => (child.innerText || '').trim())
      const sourceTexts = children.map((child) => (child.innerText || '').replace(/\s+/g, ' ').trim())
      const supportIndex = children.findIndex((child) => {
        const text = (child.innerText || '').trim()
        return text.startsWith('Deployable Profiles')
          || text.startsWith('Army List:')
          || text.startsWith('Fireteam')
      })
      if (supportIndex < 1) throw new Error('Infinity-Data profile/support boundary was not found.')

      const profiles = children.slice(0, supportIndex)
      const supports = children.slice(supportIndex)
      const heights = children.map((child) => child.getBoundingClientRect().height + 4)
      const supportHeight = heights.slice(supportIndex).reduce((sum, height) => sum + height, 0)
      let best = null
      for (let split = 1; split < profiles.length; split += 1) {
        const pageOneHeight = heights.slice(0, split).reduce((sum, height) => sum + height, 0)
        const pageTwoHeight = heights.slice(split, supportIndex).reduce((sum, height) => sum + height, 0) + supportHeight
        const profileBalancePenalty = Math.abs(split - profiles.length / 2) * 40
        const score = Math.abs(pageOneHeight - pageTwoHeight) + profileBalancePenalty
        if (!best || score < best.score) best = { pageOneHeight, pageTwoHeight, score, split }
      }

      const pages = [document.createElement('div'), document.createElement('div')]
      for (const pageElement of pages) pageElement.className = 'page readable-profile-page'
      for (const child of profiles.slice(0, best.split)) pages[0].appendChild(child)
      for (const child of [...profiles.slice(best.split), ...supports]) pages[1].appendChild(child)
      source.replaceWith(...pages)

      const pagedTexts = pages.flatMap((pageElement) => [...pageElement.children]
        .map((child) => (child.innerText || '').replace(/\s+/g, ' ').trim()))
      if (sourceTexts.length !== pagedTexts.length || sourceTexts.some((text, index) => text !== pagedTexts[index])) {
        throw new Error('Infinity-Data content changed during pagination.')
      }

      return {
        profileCount: profiles.length,
        split: best.split,
        pages: pages.map((pageElement) => [...pageElement.children].map((child) => {
          const cardTitle = child.querySelector('.card-header-title')?.textContent
            || child.querySelector('.unit-header')?.textContent
            || child.innerText
            || ''
          return cardTitle.replace(/\s+/g, ' ').trim().slice(0, 100)
        })),
      }
    })

    const pageLocators = page.locator('.readable-profile-page')
    if (await pageLocators.count() !== 2) {
      throw new InfListRenderError('invalid_render', 'Infinity-Data did not produce exactly two profile pages.')
    }

    return await Promise.all([0, 1].map(async (index) => {
      const pageLocator = pageLocators.nth(index)
      const imageBuffer = await pageLocator.screenshot({ animations: 'disabled', timeout: 30_000, type: 'png' })
      const box = await pageLocator.boundingBox()
      if (!box || box.width < 600 || box.height < 400 || imageBuffer.length < 10_000) {
        throw new InfListRenderError('invalid_render', `Infinity-Data profile page ${index + 1} is unexpectedly small.`)
      }
      return {
        bytes: imageBuffer.length,
        height: imageBuffer.readUInt32BE(20),
        imageBuffer,
        sections: pagination.pages[index],
        width: imageBuffer.readUInt32BE(16),
      }
    }))
  } finally {
    await page.close()
  }
}

async function captureOfficialArmyList(browser, officialArmyUrl) {
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1920, height: 1080 } })
  try {
    await page.goto(officialArmyUrl, { timeout: 60_000, waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
    if (!officialArmyAppOrigins.has(new URL(page.url()).origin)) {
      throw new InfListRenderError('renderer_invalid_redirect', 'Official Infinity Army left the trusted application origin.')
    }

    const rejectConsent = page.getByRole('button', { name: 'Reject All' })
    if (await rejectConsent.isVisible().catch(() => false)) {
      await rejectConsent.click()
    }

    const armyPanel = page.locator(officialArmyPanelSelector)
    await armyPanel.waitFor({ state: 'visible', timeout: 60_000 })
    await waitForStableArmyPanel(page, armyPanel)
    const imageBuffer = await armyPanel.screenshot({ animations: 'disabled', timeout: 30_000, type: 'png' })
    const box = await armyPanel.boundingBox()
    if (!box || box.width < 500 || box.height < 300 || imageBuffer.length < 10_000) {
      throw new InfListRenderError('invalid_render', 'Official Infinity Army list panel is unexpectedly small.')
    }

    return {
      height: imageBuffer.readUInt32BE(20),
      imageBuffer,
      width: imageBuffer.readUInt32BE(16),
    }
  } finally {
    await page.close()
  }
}

async function waitForStableArmyPanel(page, armyPanel) {
  const deadline = Date.now() + 45_000
  let previousText = ''
  let stableReads = 0

  while (Date.now() < deadline) {
    const text = (await armyPanel.innerText()).replace(/\s+/g, ' ').trim()
    if (text.includes('Main Section') && text.length > 200 && text === previousText) {
      stableReads += 1
      if (stableReads >= 2) return
    } else {
      stableReads = 0
    }
    previousText = text
    await page.waitForTimeout(500)
  }

  throw new InfListRenderError('renderer_timeout', 'Official Infinity Army list panel did not finish rendering.')
}

async function captureRenderedOverview(browser, rendererViewUrl, { deviceScaleFactor }) {
  const page = await browser.newPage({ deviceScaleFactor, viewport: { width: 1200, height: 1600 } })
  try {
    await loadRendererPage(page, rendererViewUrl)
    const overview = page.locator('.page').first()
    const imageBuffer = await overview.screenshot({ animations: 'disabled', timeout: 15_000, type: 'png' })
    const box = await overview.boundingBox()
    const width = box ? Math.round(box.width * deviceScaleFactor) : 0
    const height = box ? Math.round(box.height * deviceScaleFactor) : 0

    if (!box || box.width < 400 || box.height < 400 || imageBuffer.length < 10_000) {
      throw new InfListRenderError('invalid_render', 'Rendered Army overview is unexpectedly small.')
    }

    return { height, imageBuffer, width }
  } finally {
    await page.close()
  }
}

async function loadRendererPage(page, rendererViewUrl) {
  await page.goto(rendererViewUrl.href, { timeout: 30_000, waitUntil: 'networkidle' })
  if (new URL(page.url()).origin !== rendererOrigin) {
    throw new InfListRenderError('renderer_invalid_redirect', 'Rendered page left the trusted Infinity-Data origin.')
  }
  await page.locator('.page').first().waitFor({ state: 'visible', timeout: 15_000 })
  await page.evaluate(async () => document.fonts?.ready)
}

async function runCli() {
  const args = new Map()
  for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1])
  }

  try {
    const result = await renderInfListPng({
      input: args.get('--input'),
      outputPath: args.get('--output'),
    })
    const { imageBuffer: _imageBuffer, ...report } = result
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } catch (error) {
    const code = error instanceof InfListRenderError ? error.code : 'unexpected_failure'
    process.stderr.write(`${JSON.stringify({ error: code, message: error.message })}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await runCli()
}
