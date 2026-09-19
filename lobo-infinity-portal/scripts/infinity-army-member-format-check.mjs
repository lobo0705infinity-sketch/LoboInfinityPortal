import assert from 'node:assert/strict'
import {
  ARMY_INTELLIGENCE_DECODER_VERSION,
  decodeArmyCode,
} from './infinity-army-decode.mjs'

const forWorkCode =
  'gr8Kb3BlcmF0aW9ucwhGb3IgV29ya4EsAgEBAAUAhK0BAgAAhusBAgAAh2oBBQAAgkgBBgAAh1IBAQACAQAKAIJQAQEAAIJTAQEAAIJTAQEAADIBAQAAh28CAQAAh28CAQAAh28BAgAAh0YBAgAAglQBAQAAh2YBAgA%3D'
const defuserCode =
  'gTAJdXNhcmlhZG5hDUJhbGQgQnVyZ2VycyCBLAIBAQAKAIDoAQQAAACA5gEFAAAAgOYBCQAAAIDmAQEAAACA%2FwEBAAAAhiIBBwAAAIMHAYsuAAAAgwcBiy8AAACA9AECAAAAh1IBAgAAAgEABQCA7AECAAAAgwkBBAAAAIDoAQYAAACBAQEBAAAAgQEBAQAA'
const loboCode =
  'hE4Mc2hpbmRlbmJ1dGFpDFNoaW5kZW5idXRhaYEsAgEBAAkAhx8BBAAAAIcdAQIAAACHHgECAAAAh5QBAgAAAIcbAQMAAACHGwEFAAAAhykBAQAAAIcgAQMAAACHIAEDAAACAQAGAICfAQIAAACHGwEBAAAAgKIBAQAAAICHAQcAAAAyAQEAAACHIwECAAA%3D'
const snakesCode =
  'gMkHeXUtamluZwEggSwCAQEACQCAggEEAAAAgI0BAQAAAICiAQEAAACG3AEDAAAAhzIBAQAAAIcxAQQAAACHMQEEAAAAh3EBAgAAAIYiAQUAAAIBAAYAh3EBAgAAAICDAQcAAACHLgEDAAAAhNwBBQAAAICOAQEAAACAiAEBAAA%3D'

// Infinity-Data ArmyCodeLoaderTest.java, SpecOps fixture added by upstream PR #264.
const upstreamSpecOpsCode =
  'gl0JbmV4dC13YXZlASCBLAEBAQAEAIePAQYAAQFyW3sidHlwZSI6InN0YXQiLCJzdGF0IjoibW92ZTAiLCJxIjoxNX0seyJ0eXBlIjoic3RhdCIsInN0YXQiOiJtb3ZlMSIsInEiOjEwfSx7InR5cGUiOiJza2lsbCIsImlkIjo0MCwiZXh0cmEiOls2XX1dAIePAgIAAQEbW3sidHlwZSI6InNraWxsIiwiaWQiOjIxM31dAIePAwEAAQEbW3sidHlwZSI6IndlYXBvbiIsImlkIjo4MX1dAIeBAQMAAQIjW3sidHlwZSI6InN0YXQiLCJzdGF0IjoiYnMiLCJxIjoxfV0mW3sidHlwZSI6InNraWxsIiwiaWQiOjI4LCJleHRyYSI6WzZdfV0%3D'

const fixtures = [
  { code: defuserCode, bytes: 144, groups: [10, 5], members: 15, sectorialId: 304, slug: 'usariadna', name: 'Bald Burgers ' },
  { code: loboCode, bytes: 143, groups: [9, 6], members: 15, sectorialId: 1102, slug: 'shindenbutai', name: 'Shindenbutai' },
  { code: snakesCode, bytes: 128, groups: [9, 6], members: 15, sectorialId: 201, slug: 'yu-jing', name: ' ' },
]

for (const fixture of fixtures) {
  const decoded = decodeArmyCode(fixture.code)
  assert.equal(decoded.byteLength, fixture.bytes)
  assert.equal(decoded.sectorialId, fixture.sectorialId)
  assert.equal(decoded.sectorialSlug, fixture.slug)
  assert.equal(decoded.listName, fixture.name)
  assert.deepEqual(decoded.combatGroups.map((group) => group.members.length), fixture.groups)
  assert.equal(decoded.combatGroups.flatMap((group) => group.members).length, fixture.members)
  assert.equal(decoded.combatGroups.flatMap((group) => group.members).every((member) => member.modifiers.length === 0), true)
}

const legacy = decodeArmyCode(forWorkCode)
assert.equal(legacy.byteLength, 122)
assert.equal(legacy.sectorialId, 703)
assert.equal(legacy.sectorialSlug, 'operations')
assert.equal(legacy.listName, 'For Work')
assert.deepEqual(legacy.combatGroups.map((group) => group.members.length), [5, 10])
assert.equal(legacy.combatGroups.flatMap((group) => group.members).length, 15)

const specOps = decodeArmyCode(upstreamSpecOpsCode)
const specOpsMembers = specOps.combatGroups.flatMap((group) => group.members)
assert.equal(specOps.byteLength, 299)
assert.equal(specOps.sectorialId, 605)
assert.equal(specOps.sectorialSlug, 'next-wave')
assert.deepEqual(specOps.combatGroups.map((group) => group.members.length), [4])
assert.deepEqual(specOpsMembers.map((member) => member.modifiers.length), [1, 1, 1, 2])
assert.deepEqual(JSON.parse(specOpsMembers[0].modifiers[0]), [
  { type: 'stat', stat: 'move0', q: 15 },
  { type: 'stat', stat: 'move1', q: 10 },
  { type: 'skill', id: 40, extra: [6] },
])
assert.deepEqual(JSON.parse(specOpsMembers[3].modifiers[1]), [
  { type: 'skill', id: 28, extra: [6] },
])

assert.equal(ARMY_INTELLIGENCE_DECODER_VERSION, 'army-intelligence-decoder-v5')

console.log('Infinity Army member framing regression passed.')
