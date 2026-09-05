#!/usr/bin/env node

import assert from 'node:assert/strict'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInfIdInteractionHandler } from '../bot/inf-id-command.mjs'
import { generateInfId } from '../bot/inf-id-service.mjs'

const code = 'gfYKY29ycmVnaWRvckFJcyB0aGF0IGFuIElndWFuYSBpbiB5b3VyIHBvY2tldCBvciBhcmUgeW91IGp1c3QgaGFwcHkgdG8gc2VlIG1lP4EsAgEBAAkAgaUBBAAAAIGlAQQAAACHaAEJAAAAgSgBAQAAAIYPAAEAAACBiwEGAAAAhisBAwAAAIGUAQMAAACBlAEDAAACAQAFAIGqAQEAAACBfwECAAAAh2UBAQAAAIEoAQoAAACBmgEBAAA%3D'
const reviewDir = resolve('.tmp', 'inf-id-final-production-discord')
await rm(reviewDir, { recursive: true, force: true }); await mkdir(reviewDir, { recursive: true })
let generated
const interaction = { commandName: 'inf-id', deferred: false, replied: false, edits: [], isChatInputCommand: () => true, options: { getString: () => code }, async deferReply() { this.deferred = true }, async editReply(payload) { this.edits.push(payload) }, async reply(payload) { this.replied = true; this.edits.push(payload) } }
const handler = createInfIdInteractionHandler({ generate: async (options) => { generated = await generateInfId(options); return generated } })
assert.equal(await handler(interaction), true)
assert.equal(interaction.deferred, true)
assert.equal(interaction.edits.length, 1)
assert.equal(generated.tileCount, 14)
assert.equal(generated.missingImageCount, 0)
assert.equal(interaction.edits[0].files.length, generated.pageCount + 1)
for (const file of interaction.edits[0].files) await writeFile(resolve(reviewDir, file.name), file.attachment)
await assert.rejects(access(generated.outputDir), /ENOENT/)
await writeFile(resolve(reviewDir, 'interaction-audit.json'), `${JSON.stringify({ deferred: interaction.deferred, content: interaction.edits[0].content, filenames: interaction.edits[0].files.map((file) => file.name), sizes: interaction.edits[0].files.map((file) => file.attachment.length), pageCount: generated.pageCount, tileCount: generated.tileCount, missingImageCount: generated.missingImageCount, resolutionCounts: Object.fromEntries(Object.entries(Object.groupBy(generated.entries, (entry) => entry.image.resolutionSource)).map(([key, value]) => [key, value.length])), fireteamDefinitions: generated.fireteams.fireteamChart.teams.length, fireteamRelationships: generated.fireteams.fireteamChart.teams.reduce((sum, team) => sum + team.units.length, 0), fireteamCacheStatus: generated.fireteams.cacheStatus, fireteamMatches: generated.fireteamMatches, timings: generated.timings, temporaryDirectoryRemoved: true }, null, 2)}\n`)
console.log(`PASS - production /inf-id interaction generated ${generated.pageCount} PNG page(s) and PDF, then removed ${generated.outputDir}`)
console.log(reviewDir)
