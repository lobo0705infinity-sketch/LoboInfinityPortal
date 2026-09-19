import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'
import { decodeArmyCode, normalizeArmyCodeInput, normalizeArmyCodeForInfinityDataTransport } from './infinity-army-decode.mjs'
import { renderIdentificationSheet } from '../bot/inf-id-renderer.mjs'
import { generateInfId } from '../bot/inf-id-service.mjs'

const encoded = 'gS4aY2FsZWRvbmlhbi1oaWdobGFuZGVyLWFybXkBIIEsAgEBAAoAgP4BAQAAAIEbAQEAAACBAwECAAAAgPUBBwAAAID1AQcAAACGIgEDAAAAgPsBAgAAAIEHAQIAAACBCAECAAAAhiIBBwAAAgEABQCCqAGJIwAAAIDvAQIAAACA7QEEAAAAgO8BAgAAAIDvAQIAAA%3D%3D'
const decoded = decodeURIComponent(encoded)
const encodedStructure = decodeArmyCode(normalizeArmyCodeInput(encoded))
const decodedStructure = decodeArmyCode(normalizeArmyCodeInput(decoded))
assert.equal(encodedStructure.sectorialId, 302)
assert.equal(encodedStructure.sectorialSlug, 'caledonian-highlander-army')
assert.equal(encodedStructure.combatGroups.flatMap((group) => group.members).length, 15)
assert.deepEqual(encodedStructure.combatGroups.map((group) => group.members.length), [10, 5])
assert.deepEqual(decodedStructure.combatGroups.flatMap((group) => group.members).map((member) => member.combinedId), encodedStructure.combatGroups.flatMap((group) => group.members).map((member) => member.combinedId))
assert.equal(normalizeArmyCodeForInfinityDataTransport(encoded), normalizeArmyCodeForInfinityDataTransport(decoded))
assert.throws(() => decodeArmyCode('%%%'), URIError)
await assert.rejects(generateInfId({ input: '' }), (error) => error.code === 'decode_failed')

const output = await mkdtemp(join(tmpdir(), 'inf-id-caledonian-check-'))
const browser = await chromium.launch({ headless: true })
try {
  const entries = encodedStructure.combatGroups.flatMap((group) => group.members.map((member, index) => ({
    combinedId: member.combinedId,
    combatGroup: group.combatGroup,
    image: { resolves: false, matchType: null },
    imageDataUrl: null,
    position: index + 1,
    profileName: `Profile ${member.combinedId}`,
    rosterPosition: `G${group.combatGroup}.${index + 1}`,
    unitName: `Unit ${member.unitId}`,
    weapons: ['Combi Rifle'],
  })))
  const rendered = await renderIdentificationSheet({ army: { faction: 'Ariadna', sectorial: 'Caledonian Highlander Army', listName: 'Overflow fixture' }, entries, fireteams: { status: 'unavailable' }, fireteamMatches: [], outputDir: output, browser })
  assert.equal(rendered.pageCount, 2)
  assert.equal(rendered.tileCount, 15)
  assert.equal(rendered.pages.every((page) => page.width === 2480 && page.height === 3508), true)
  assert.equal(rendered.pdf.buffer.subarray(0, 4).toString(), '%PDF')
  console.log(JSON.stringify({ result: 'PASS', sectorialId: encodedStructure.sectorialId, modelCount: 15, groupCounts: [10, 5], pageCount: rendered.pageCount, pngDimensions: rendered.pages.map((page) => [page.width, page.height]), pdf: { header: '%PDF', bytes: rendered.pdf.buffer.length }, normalization: 'encoded and decoded forms resolve to identical combinedId profiles' }, null, 2))
} finally {
  await browser.close()
  await rm(output, { recursive: true, force: true })
}
