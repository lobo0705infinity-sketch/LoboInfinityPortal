import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import {
  ARMY_INTELLIGENCE_DECODER_VERSION,
  decodeArmyCode,
  decodeArmyListToFiles,
  hasExactSkillToken,
  normalizeArmyCodeForInfinityDataTransport,
} from './infinity-army-decode.mjs'

const forWorkCode =
  'gr8Kb3BlcmF0aW9ucwhGb3IgV29ya4EsAgEBAAUAhK0BAgAAhusBAgAAh2oBBQAAgkgBBgAAh1IBAQACAQAKAIJQAQEAAIJTAQEAAIJTAQEAADIBAQAAh28CAQAAh28CAQAAh28BAgAAh0YBAgAAglQBAQAAh2YBAgA%3D'
const defuserCode =
  'gTAJdXNhcmlhZG5hDUJhbGQgQnVyZ2VycyCBLAIBAQAKAIDoAQQAAACA5gEFAAAAgOYBCQAAAIDmAQEAAACA%2FwEBAAAAhiIBBwAAAIMHAYsuAAAAgwcBiy8AAACA9AECAAAAh1IBAgAAAgEABQCA7AECAAAAgwkBBAAAAIDoAQYAAACBAQEBAAAAgQEBAQAA'
const loboCode =
  'hE4Mc2hpbmRlbmJ1dGFpDFNoaW5kZW5idXRhaYEsAgEBAAkAhx8BBAAAAIcdAQIAAACHHgECAAAAh5QBAgAAAIcbAQMAAACHGwEFAAAAhykBAQAAAIcgAQMAAACHIAEDAAACAQAGAICfAQIAAACHGwEBAAAAgKIBAQAAAICHAQcAAAAyAQEAAACHIwECAAA%3D'
const snakesCode =
  'gMkHeXUtamluZwEggSwCAQEACQCAggEEAAAAgI0BAQAAAICiAQEAAACG3AEDAAAAhzIBAQAAAIcxAQQAAACHMQEEAAAAh3EBAgAAAIYiAQUAAAIBAAYAh3EBAgAAAICDAQcAAACHLgEDAAAAhNwBBQAAAICOAQEAAACAiAEBAAA%3D'
const legacyCompatibleSteelPhalanxCode =
  'gr4Nc3RlZWwtcGhhbGFueACBLAEBAAoBgtEBAQACglwBAgADglkBAQAEgkwBBAAFgkwBAgAGgkwBBgAHgkwBAwAIgmEBAQAJhjkBBAAKgmABAgA%3D'
const tartaryPercentEncodedCode =
  'gTEHdGFydGFyeRtUYWNrc3NzIHRlYW1zICAzIG1vcmUgZGlzY2%2BBLAIBAAcBhH4BBAAChzYBAwADhfQBAQAEgPIBg0UABYDuAQUABoRuAZBWAAeA5QEDAAIACAGA5wECAAKA8AECAAOA8AECAASA8QEBAAWHNQEEAAaBCQECAAeA8gGDRQAIh1IBAQA%3D7'

const require = createRequire(import.meta.url)
const CanonicalArmyCodeResolver = require('../backend/CanonicalArmyCodeResolver.gs')
const outputDir = await mkdtemp(join(tmpdir(), 'lobo-army-decode-'))

// Historical fixture: its container remains a required local-parser regression,
// while profile 703-1874-1-1 is no longer resolvable by current Infinity-Data.
const historical = decodeArmyCode(forWorkCode)
assert.equal(historical.byteLength, 122)
assert.equal(historical.sectorialId, 703)
assert.equal(historical.sectorialSlug, 'operations')
assert.equal(historical.listName, 'For Work')
assert.deepEqual(historical.combatGroups.map((group) => group.members.length), [5, 10])
assert.equal(historical.combatGroups.flatMap((group) => group.members).length, 15)
assert.equal(
  historical.combatGroups.flatMap((group) => group.members).some((member) => member.combinedId === '703-1874-1-1-1'),
  true,
)

const currentFixtures = await Promise.all([
  decodeArmyListToFiles({ input: defuserCode, outputDir }),
  decodeArmyListToFiles({ input: loboCode, outputDir }),
  decodeArmyListToFiles({ input: snakesCode, outputDir }),
])
const [defuserResult, loboResult, snakesResult] = currentFixtures

for (const result of currentFixtures) {
  assert.equal(result.list.decoderVersion, 'army-intelligence-decoder-v5')
  assert.equal(result.list.combatGroups.flatMap((group) => group.entries).length, 15)
  assert.equal(result.list.totals.points > 0, true)
}

assert.equal(defuserResult.list.sectorialId, 304)
assert.equal(defuserResult.list.sectorial, 'Usariadna')
assert.equal(defuserResult.list.listName, 'Bald Burgers ')
assert.deepEqual(defuserResult.list.combatGroups.map((group) => group.entries.length), [10, 5])
assert.equal(defuserResult.list.incomplete, true)
assert.equal(defuserResult.list.warnings.length, 2)
assert.equal(defuserResult.list.warnings.every((warning) => warning.combinedId === '304-257-1-1-1'), true)
assert.equal(loboResult.list.sectorialId, 1102)
assert.equal(loboResult.list.sectorial, 'Shindenbutai')
assert.deepEqual(loboResult.list.combatGroups.map((group) => group.entries.length), [9, 6])
assert.equal(loboResult.list.incomplete, false)
assert.deepEqual(loboResult.list.warnings, [])
assert.equal(snakesResult.list.sectorialId, 201)
assert.equal(snakesResult.list.sectorial, 'Yu Jing')
assert.deepEqual(snakesResult.list.combatGroups.map((group) => group.entries.length), [9, 6])
assert.equal(snakesResult.list.incomplete, false)
assert.deepEqual(snakesResult.list.warnings, [])

const legacyCompatibleResult = await decodeArmyListToFiles({ input: legacyCompatibleSteelPhalanxCode, outputDir })
assert.equal(legacyCompatibleResult.list.sectorial, 'Steel Phalanx')
assert.equal(legacyCompatibleResult.list.combatGroups.flatMap((group) => group.entries).length, 10)
assert.equal(legacyCompatibleResult.list.incomplete, false)

const tartaryStructure = decodeArmyCode(tartaryPercentEncodedCode)
assert.equal(tartaryStructure.sectorialSlug, 'tartary')
assert.equal(normalizeArmyCodeForInfinityDataTransport(tartaryPercentEncodedCode).endsWith('=7'), false)
assert.equal(normalizeArmyCodeForInfinityDataTransport('ordinaryArmyCode'), 'ordinaryArmyCode')
assert.equal(normalizeArmyCodeForInfinityDataTransport('%252B'), '%2B')
assert.throws(() => normalizeArmyCodeForInfinityDataTransport('%invalid'), URIError)
assert.equal(
  CanonicalArmyCodeResolver.buildArmyCodeId(tartaryPercentEncodedCode, (value) => String(value || '').trim()),
  4304763863,
)

assert.equal(hasExactSkillToken('Forward Deployment (+8â€³), Specialist Operative', 'Forward Observer'), false)
assert.equal(hasExactSkillToken('Forward Observer, Mimetism [-3]', 'Forward Observer'), true)
assert.equal(hasExactSkillToken('Number 2, Specialist Operative, Tactical Awareness', 'Chain of Command'), false)
assert.equal(hasExactSkillToken('Chain of Command, Courage', 'Chain of Command'), true)
assert.equal(ARMY_INTELLIGENCE_DECODER_VERSION, 'army-intelligence-decoder-v5')

console.log(JSON.stringify({
  current: currentFixtures.map(({ list }) => ({
    combatGroups: list.totals.combatGroups,
    listName: list.listName,
    points: list.totals.points,
    sectorial: list.sectorial,
    swc: list.totals.swc,
  })),
  historical: { bytes: historical.byteLength, members: 15, status: 'structural-only' },
  result: 'PASS',
}, null, 2))
