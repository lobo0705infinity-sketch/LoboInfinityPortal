#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { buildArmyListOptions, availableProfiles, ListBuilderError, proposedFireteams } from '../bot/build-list-generator.mjs'
import { buildListResponses, createBuildListInteractionHandler } from '../bot/build-list-command.mjs'
import { LIVE_ROSTER_UNIT_SLUGS } from '../bot/official-army-rosters.mjs'
import { decodeArmyCode } from './infinity-army-decode.mjs'
import { encodeArmyCode } from './infinity-army-encode.mjs'

const loadArchive = async name => JSON.parse(gunzipSync(Buffer.from(await readFile(new URL(`../data/infinity-army/${name}.json.gz.b64`, import.meta.url), 'utf8'), 'base64')))
const source = await loadArchive('benchmark-official-source')
const payload = source.payloads.find(item => item.url?.endsWith('/502'))
const catalog = await loadArchive('gunfighter-benchmark-catalog')
const aroCatalog = await loadArchive('aro-benchmark-catalog')
const closeCombatCatalog = await loadArchive('close-combat-benchmark')
const mobilityCatalog = JSON.parse(await readFile(new URL('../src/data/mobility-index.json', import.meta.url), 'utf8'))
assert.ok(payload?.fireteamChart?.teams?.length, 'bundled official Corregidor source is available')

const roster = LIVE_ROSTER_UNIT_SLUGS.get(502)
const profiles = availableProfiles({ payload, metadata: source.metadata, sectorialId: 502, rosterSlugs: roster,
  gunfighterCatalog: catalog, aroCatalog, closeCombatCatalog, mobilityCatalog })
assert.ok(profiles.some(item => item.slug === 'jazz-and-billie-tactical-hacking-team' && item.groupId === 0 && item.specialist))
assert.ok(profiles.some(item => item.slug === 'iguana-squadron' && !item.specialist), 'the dismounted TAG operator does not make the Iguana a console specialist')
assert.ok(profiles.every(item => roster.includes(item.slug)))
assert.ok(profiles.some(item => item.aroRating > 0 && item.ccRating > 0 && item.mobility > 0), 'existing ARO, CC, and mobility benchmarks contribute')

const input = { payload, metadata: source.metadata, sectorialId: 502, rosterSlugs: roster,
  gunfighterCatalog: catalog, aroCatalog, closeCombatCatalog, mobilityCatalog,
  mission: 'Hardlock', mustInclude: ['Jazz', 'Iguana'], points: 300 }
const results = buildArmyListOptions(input)
assert.equal(results.length, 3)
assert.equal(new Set(results.map(item => item.profiles.map(profile => `${profile.combatGroup}:${profile.id}`).sort().join('|'))).size, 3)
for (const result of results) {
  assert.equal(result.legality.status, 'legal')
  assert.ok(result.profiles.some(item => /jazz/i.test(item.optionName)))
  assert.ok(result.profiles.some(item => /iguana/i.test(item.optionName)))
  assert.ok(result.specialistCount >= 4)
  assert.ok(result.legality.totals.troopers >= 12)
  assert.ok(!result.profiles.some(item => item.side === 'Deepspace'), 'Surface/Deepspace exclusivity')
  assert.ok(result.fireteams.some(team => ['DUO', 'HARIS'].includes(team.type) && team.level >= 2))
  assert.ok(result.fireteams.every(team => team.members.length === (team.type === 'DUO' ? 2 : 3)))
  assert.ok(result.fireteams.every(team => team.members.every(label => result.profiles.some(profile => profile.combatGroup === team.combatGroup && profile.label === label))))
  const decoded = decodeArmyCode(result.code)
  assert.equal(decoded.sectorialId, 502)
  assert.equal(decoded.combatGroups.flatMap(group => group.members).length, result.profiles.length)
  assert.equal(encodeArmyCode({ ...decoded, combatGroups: decoded.combatGroups }), result.code, 'Army code must round-trip')
}
assert.throws(() => buildArmyListOptions({ ...input, mustInclude: ['Jazz', 'Iguana', 'Evaders'] }), ListBuilderError)

const wrongFtoChart = { spec: { HARIS: 1, DUO: 1 }, teams: [
  { name: 'Special Duo', type: ['DUO'], units: [
    { slug: 'jazz-and-billie-tactical-hacking-team', name: 'JAZZ', comment: 'FTO', required: true, min: 0, max: 1 },
    { slug: 'corregidor-alguaciles', name: 'ALGUACIL', comment: '', required: true, min: 0, max: 1 },
  ] },
] }
assert.deepEqual(proposedFireteams([
  { ...profiles.find(item => item.optionName === 'JAZZ FTO'), optionName: 'JAZZ', combatGroup: 1 },
  { ...profiles.find(item => item.slug === 'corregidor-alguaciles'), combatGroup: 1 },
], wrongFtoChart), [], 'a non-FTO Jazz option cannot enter an FTO-only Fireteam')

const vanilla = buildArmyListOptions({ ...input, payload: { ...payload, fireteamChart: { teams: [], spec: {} } }, count: 1 })
assert.equal(vanilla.length, 1)
assert.deepEqual(vanilla[0].fireteams, [], 'armies without a chart must still get a list')

const messages = await buildListResponses({ faction: 'Corregidor', mission: 'Hardlock', mustInclude: 'Jazz, Iguana',
  getSource: async () => ({ faction: source.metadata.factions.find(item => item.id === 502), payload, metadata: source.metadata }),
  getCatalog: async () => catalog, getAroCatalog: async () => aroCatalog,
  getCloseCombatCatalog: async () => closeCombatCatalog, getMobilityCatalog: async () => mobilityCatalog })
assert.equal(messages.length, 3)
for (const message of messages) {
  assert.ok(message.content.length <= 2000)
  assert.match(message.content, /Proposed fireteams[\s\S]*Level [23]/)
  assert.match(message.content, /BS Attack \(\+1 SD\)/)
  assert.match(message.content, /Open in Infinity Army/)
}
const calls = []
const handler = createBuildListInteractionHandler({ build: async () => messages, logger: { error() {} } })
const handled = await handler({
  isChatInputCommand: () => true, commandName: 'build-list',
  options: { getString: name => ({ faction: 'Corregidor', mission: 'Hardlock', 'must-include': 'Jazz, Iguana' })[name], getInteger: () => 300 },
  deferReply: async () => calls.push('defer'), editReply: async result => calls.push(result),
  followUp: async result => calls.push(result),
})
assert.equal(handled, true)
assert.equal(calls.length, 4, 'defer, initial result, and two follow-up list options')

console.log('PASS - build-list creates three legal, distinct Corregidor/Hardlock lists with explicit Level 2+ fireteams.')
