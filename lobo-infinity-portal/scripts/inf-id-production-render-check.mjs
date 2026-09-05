#!/usr/bin/env node

import { rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { generateInfId } from '../bot/inf-id-service.mjs'

const code = 'gfYKY29ycmVnaWRvckFJcyB0aGF0IGFuIElndWFuYSBpbiB5b3VyIHBvY2tldCBvciBhcmUgeW91IGp1c3QgaGFwcHkgdG8gc2VlIG1lP4EsAgEBAAkAgaUBBAAAAIGlAQQAAACHaAEJAAAAgSgBAQAAAIYPAAEAAACBiwEGAAAAhisBAwAAAIGUAQMAAACBlAEDAAACAQAFAIGqAQEAAACBfwECAAAAh2UBAQAAAIEoAQoAAACBmgEBAAA%3D'
const outputDir = resolve('.tmp', 'inf-id-final-corregidor')
await rm(outputDir, { recursive: true, force: true })
const result = await generateInfId({ input: code, outputDir })
const audit = {
  armyCode: result.armyCode,
  pages: result.pages.map(({ path, name, width, height, buffer }) => ({ path, name, width, height, bytes: buffer.length })),
  pdf: { path: result.pdf.path, name: result.pdf.name, bytes: result.pdf.buffer.length },
  pageCount: result.pageCount,
  tileCount: result.tileCount,
  missingImageCount: result.missingImageCount,
  resolutionCounts: Object.groupBy(result.entries, (entry) => entry.image.resolutionSource),
  entries: result.entries.map(({ imageDataUrl, ...entry }) => entry),
  fireteams: { status: result.fireteams.status, cacheStatus: result.fireteams.cacheStatus, payloadVersion: result.fireteams.payloadVersion, definitionCount: result.fireteams.fireteamChart?.teams?.length || 0, relationshipCount: result.fireteams.fireteamChart?.teams?.reduce((sum, team) => sum + team.units.length, 0) || 0 },
  fireteamMatches: result.fireteamMatches,
  timings: result.timings,
}
await writeFile(resolve(outputDir, 'production-audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(audit, null, 2))
