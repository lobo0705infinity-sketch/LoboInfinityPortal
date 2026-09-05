#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const rendererOrigin = 'https://infinity.2nirwana.de'
const rendererPath = '/cards/generate'
const rendererViewPattern = /^\/cards\/view\/[A-Za-z0-9-]+$/
const officialArmyOrigin = 'https://infinitytheuniverse.com'
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
    const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1200, height: 1600 } })
    await page.goto(rendererViewUrl.href, { timeout: 30_000, waitUntil: 'networkidle' })
    if (new URL(page.url()).origin !== rendererOrigin) {
      throw new InfListRenderError('renderer_invalid_redirect', 'Rendered page left the trusted Infinity-Data origin.')
    }

    const overview = page.locator('.page').first()
    await overview.waitFor({ state: 'visible', timeout: 15_000 })
    await page.evaluate(async () => document.fonts?.ready)
    const imageBuffer = await overview.screenshot({ animations: 'disabled', timeout: 15_000, type: 'png' })

    const box = await overview.boundingBox()
    if (!box || box.width < 400 || box.height < 400 || imageBuffer.length < 10_000) {
      throw new InfListRenderError('invalid_render', 'Rendered Army overview is unexpectedly small.')
    }

    const finalOutputPath = outputPath ? resolve(outputPath) : null
    if (finalOutputPath) {
      await mkdir(dirname(finalOutputPath), { recursive: true })
      await writeFile(finalOutputPath, imageBuffer)
    }

    return {
      bytes: imageBuffer.length,
      height: Math.round(box.height),
      imageBuffer,
      officialArmyUrl: buildOfficialArmyUrl(armyCode),
      outputPath: finalOutputPath,
      rendererViewUrl: rendererViewUrl.href,
      width: Math.round(box.width),
    }
  } finally {
    await browser.close()
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
