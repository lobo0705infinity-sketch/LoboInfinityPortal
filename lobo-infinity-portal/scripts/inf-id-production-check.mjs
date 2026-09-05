#!/usr/bin/env node

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { INF_ID_COMMAND_DEFINITION, INF_ID_OPTION, createInfIdInteractionHandler } from '../bot/inf-id-command.mjs'
import { chooseMiniature, supplementalKey } from '../bot/inf-id-miniatures.mjs'
import { matchFireteamRoster, normalizeOfficialPayload, relationshipMatchesEntry } from '../bot/inf-id-fireteams.mjs'
import { renderIdentificationSheet } from '../bot/inf-id-renderer.mjs'
import { createInfIdOutputDir, InfIdError } from '../bot/inf-id-service.mjs'

assert.equal(INF_ID_COMMAND_DEFINITION.name, 'inf-id')
assert.equal(INF_ID_COMMAND_DEFINITION.options[0].name, INF_ID_OPTION)
assert.equal(INF_ID_COMMAND_DEFINITION.options[0].required, true)
assert.notEqual(createInfIdOutputDir(), createInfIdOutputDir())

const rosterEntry = { rosterPosition: 'G1.1', combatGroup: 1, position: 1, unitName: 'COYOTE FTO', profileName: 'COYOTE FTO', weapons: ['E/Mitter'], unitId: 1896, profileGroupId: 1, optionId: 9, profileId: 1, combinedId: '502-1896-1-9-1' }
const catalogEntry = { ...rosterEntry, image: { url: 'https://example.invalid/coyote.png', matchType: 'representative-official-sculpt' } }
const catalog = new Map([[supplementalKey(rosterEntry), catalogEntry]])
assert.equal(chooseMiniature({ rosterEntry, infinityDataImage: { url: 'https://infinity.2nirwana.de/primary.png' }, supplementalCatalog: catalog }).resolutionSource, 'infinity-data')
assert.equal(chooseMiniature({ rosterEntry, infinityDataImage: null, supplementalCatalog: catalog }).resolutionSource, 'supplemental-catalog')
assert.equal(chooseMiniature({ rosterEntry: { ...rosterEntry, unitName: 'BAMBADROID' }, infinityDataImage: null, supplementalCatalog: catalog }).resolves, false)

const officialFixture = { body: { version: 'fixture', units: [{ id: 1896, slug: 'coyotes' }], fireteamChart: { spec: {}, teams: [{ name: 'Surface', type: ['CORE'], units: [{ min: 0, max: 2, name: 'COYOTE', slug: 'coyotes' }, { min: 0, max: 2, name: 'BAMBADROID', slug: 'coyotes' }] }] } }, headers: { etag: 'fixture' } }
const reference = normalizeOfficialPayload(officialFixture, 1, 502)
assert.equal(relationshipMatchesEntry(reference.fireteamChart.teams[0].units[0], rosterEntry), true)
assert.equal(relationshipMatchesEntry(reference.fireteamChart.teams[0].units[1], rosterEntry), false)
assert.deepEqual(matchFireteamRoster(reference, [rosterEntry]).map((item) => item.unit), ['COYOTE'])

let cleanupCalls = 0
const generated = { pages: [{ buffer: Buffer.from('png'), name: 'sheet.png' }], pdf: { buffer: Buffer.from('pdf'), name: 'sheet.pdf' }, missingImageCount: 1, outputDir: 'fixture' }
const interaction = mockInteraction('CODE')
assert.equal(await createInfIdInteractionHandler({ generate: async () => generated, cleanup: async () => { cleanupCalls += 1 } })(interaction), true)
assert.equal(interaction.deferred, true)
assert.equal(interaction.edits.length, 1)
assert.match(interaction.edits[0].content, /1 model does not yet have a verified miniature image/)
assert.equal(cleanupCalls, 1)

const failed = mockInteraction('BAD')
await createInfIdInteractionHandler({ generate: async () => { throw new Error('private trace') }, cleanup: async () => {} , logger: { error() {} } })(failed)
assert.equal(failed.edits[0], "I couldn't generate that miniature identification sheet right now.")
const invalid = mockInteraction('BAD')
await createInfIdInteractionHandler({ generate: async () => { throw new InfIdError('invalid_army_code', 'private') }, cleanup: async () => {}, logger: { error() {} } })(invalid)
assert.equal(invalid.edits[0], "That doesn't look like a valid Infinity Army code.")

const output = await mkdtemp(join(tmpdir(), 'inf-id-check-'))
const browser = await chromium.launch({ headless: true })
try {
  const onePixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg=='
  const placeholderEntries = Array.from({ length: 16 }, (_, index) => ({ ...rosterEntry, rosterPosition: `G${index < 9 ? 1 : 2}.${index < 9 ? index + 1 : index - 8}`, combatGroup: index < 9 ? 1 : 2, position: index < 9 ? index + 1 : index - 8, unitName: index === 0 ? 'NO IMAGE TEST' : `UNIT ${index + 1}`, image: { resolves: index !== 0, matchType: null }, imageDataUrl: index === 0 ? null : onePixel }))
  const rendered = await renderIdentificationSheet({ army: { faction: 'Fixture', sectorial: 'Fixture Sectorial', listName: 'Pagination' }, entries: placeholderEntries, fireteams: { status: 'unavailable' }, fireteamMatches: [], outputDir: output, browser })
  assert.equal(rendered.pageCount, 2)
  assert.equal(rendered.tileCount, 16)
  assert.equal(rendered.pages[0].buffer.subarray(0, 4).toString('hex'), '89504e47')
  assert.equal(rendered.pdf.buffer.subarray(0, 4).toString(), '%PDF')
  const vanilla = await renderIdentificationSheet({ army: { faction: 'Fixture Vanilla', sectorial: '', listName: 'No teams' }, entries: [placeholderEntries[0]], fireteams: { status: 'none' }, fireteamMatches: [], outputDir: join(output, 'vanilla'), browser })
  assert.equal(vanilla.pageCount, 1)
} finally { await browser.close(); await rm(output, { recursive: true, force: true }) }

console.log('PASS - /inf-id command lifecycle, ID-priority resolution, Coyote/Bambadroid disambiguation, placeholder rendering, Fireteam failure, and pagination.')

function mockInteraction(value) {
  return { commandName: 'inf-id', deferred: false, replied: false, edits: [], isChatInputCommand: () => true, options: { getString: () => value }, async deferReply() { this.deferred = true }, async editReply(value) { this.edits.push(value) }, async reply(value) { this.replied = true; this.edits.push(value) } }
}
