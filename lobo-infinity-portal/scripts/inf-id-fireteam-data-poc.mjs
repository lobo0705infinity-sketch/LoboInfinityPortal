#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'data', 'infinity-fireteams', 'corregidor.json')
const armyCode = decodeURIComponent('gfYKY29ycmVnaWRvckFJcyB0aGF0IGFuIElndWFuYSBpbiB5b3VyIHBvY2tldCBvciBhcmUgeW91IGp1c3QgaGFwcHkgdG8gc2VlIG1lP4EsAgEBAAkAgaUBBAAAAIGlAQQAAACHaAEJAAAAgSgBAQAAAIYPAAEAAACBiwEGAAAAhisBAwAAAIGUAQMAAACBlAEDAAACAQAFAIGqAQEAAACBfwECAAAAh2UBAQAAAIEoAQoAAACBmgEBAAA%3D')
const endpoint = 'https://api.corvusbelli.com/army/units/en/502'

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    let captured
    page.on('response', async (response) => {
      if (response.url() !== endpoint) return
      try {
        captured = { body: await response.json(), headers: await response.allHeaders() }
      } catch {}
    })
    await page.goto(`https://infinitytheuniverse.com/army/list/${encodeURIComponent(armyCode)}`, {
      waitUntil: 'commit',
      timeout: 60_000,
    }).catch(() => {})
    for (let elapsed = 0; !captured && elapsed < 60_000; elapsed += 1_000) await page.waitForTimeout(1_000)
    if (!captured?.body?.fireteamChart) throw new Error('Current official Corregidor Fireteam chart was not observed.')

    const unitBySlug = new Map(captured.body.units.map((unit) => [unit.slug, unit]))
    const chart = structuredClone(captured.body.fireteamChart)
    for (const team of chart.teams) {
      for (const unit of team.units) {
        const officialUnit = unitBySlug.get(unit.slug)
        unit.unitId = officialUnit?.id ?? null
        unit.officialUnitName = officialUnit?.name ?? null
      }
    }
    const output = {
      version: 1,
      faction: 'Nomads',
      sectorial: 'Corregidor Jurisdictional Command',
      sectorialId: 502,
      source: {
        authority: 'Corvus Belli Infinity Army',
        applicationUrl: 'https://infinitytheuniverse.com/army/',
        endpoint,
        payloadVersion: captured.body.version ?? null,
        retrievedAt: new Date().toISOString(),
        responseDate: captured.headers.date ?? null,
        etag: captured.headers.etag ?? null,
      },
      fireteamChart: chart,
    }
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ outputPath, payloadVersion: output.source.payloadVersion, teams: chart.teams.length }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
