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
    const primary = await captureRenderedOverview(browser, rendererViewUrl, { deviceScaleFactor: 1 })
    let readable = null
    try {
      readable = await captureOfficialArmyList(browser, buildOfficialArmyUrl(armyCode))
    } catch {
      // The established full-list image remains usable if the additive official capture fails.
    }

    const finalOutputPath = outputPath ? resolve(outputPath) : null
    if (finalOutputPath) {
      await mkdir(dirname(finalOutputPath), { recursive: true })
      await writeFile(finalOutputPath, primary.imageBuffer)
    }

    return {
      bytes: primary.imageBuffer.length,
      height: primary.height,
      imageBuffer: primary.imageBuffer,
      officialArmyUrl: buildOfficialArmyUrl(armyCode),
      outputPath: finalOutputPath,
      readableBytes: readable?.imageBuffer.length ?? null,
      readableHeight: readable?.height ?? null,
      readableImageBuffer: readable?.imageBuffer ?? null,
      readableWidth: readable?.width ?? null,
      rendererViewUrl: rendererViewUrl.href,
      width: primary.width,
    }
  } finally {
    await browser.close()
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
    await page.goto(rendererViewUrl.href, { timeout: 30_000, waitUntil: 'networkidle' })
    if (new URL(page.url()).origin !== rendererOrigin) {
      throw new InfListRenderError('renderer_invalid_redirect', 'Rendered page left the trusted Infinity-Data origin.')
    }

    const overview = page.locator('.page').first()
    await overview.waitFor({ state: 'visible', timeout: 15_000 })
    await page.evaluate(async () => document.fonts?.ready)
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
