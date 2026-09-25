#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { buildArmyListOptions, availableProfiles, ListBuilderError, optimizeCombatGroups,
  projectedRegularOrders, proposedFireteams, resolveRequiredProfile } from '../bot/build-list-generator.mjs'
import { BUILD_LIST_COMMAND_DEFINITION, buildListResponses, createBuildListAutocompleteHandler,
  createBuildListInteractionHandler, ensureBuildListCommand, getCurrentArmySource,
  searchBuildListFactions, searchBuildListMissions, searchBuildListUnits } from '../bot/build-list-command.mjs'
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
assert.ok(profiles.some(item => item.tacticalOrders > 0) && profiles.some(item => item.nco)
  && profiles.some(item => item.lieutenantOrders > 0), 'Tactical Awareness, NCO and Lieutenant orders are identified')

const input = { payload, metadata: source.metadata, sectorialId: 502, rosterSlugs: roster,
  gunfighterCatalog: catalog, aroCatalog, closeCombatCatalog, mobilityCatalog,
  mission: 'Hardlock', mustInclude: ['Jazz', 'Iguana'], points: 300 }
const results = buildArmyListOptions(input)
assert.equal(results.length, 3)
assert.equal(new Set(results.map(item => item.profiles.map(profile => `${profile.combatGroup}:${profile.id}`).sort().join('|'))).size, 3)
assert.ok(results.some(result => result.legality.totals.troopers === 15), 'prefer 15 models when the roster can support them')
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
  assert.ok([1, 2].every(group => result.profiles.filter(item => item.combatGroup === group)
    .reduce((sum, item) => sum + item.slots, 0) <= 10), 'each group has at most 10 trooper slots')
  assert.ok(projectedRegularOrders(result.profiles, 1) >= projectedRegularOrders(result.profiles, 2))
  const assignedMembers = new Set()
  for (const team of result.fireteams) for (const label of team.members) {
    const index = result.profiles.findIndex((item, index) => item.combatGroup === team.combatGroup
      && item.label === label && !assignedMembers.has(index))
    assert.ok(index >= 0, 'even identical Fireteam members must occupy distinct slots in the same group')
    assignedMembers.add(index)
  }
  const decoded = decodeArmyCode(result.code)
  assert.equal(decoded.sectorialId, 502)
  assert.equal(decoded.combatGroups.flatMap(group => group.members).length, result.profiles.length)
  assert.equal(encodeArmyCode({ ...decoded, combatGroups: decoded.combatGroups }), result.code, 'Army code must round-trip')
}
assert.ok(results.some(result => projectedRegularOrders(result.profiles, 1) === 9
  && projectedRegularOrders(result.profiles, 2) === 6), 'a useful 9–6 Regular Order split is considered')
assert.throws(() => buildArmyListOptions({ ...input, mustInclude: ['Jazz', 'Iguana', 'Evaders'] }), ListBuilderError)

const groupFixture = Array.from({ length: 15 }, (_, index) => ({
  id: String(index), label: `Trooper ${index}`, slots: 1, combatGroup: index < 10 ? 1 : 2,
  regular: true, startsOffTable: false, gunfighter: index === 0 ? 60 : index === 10 ? 45 : 8,
  specialist: index === 0 || index === 10, ccRating: 0, mobility: 0,
  nco: false, tacticalOrders: 0, lieutenantOrders: index === 1 ? 1 : 0,
}))
const split = profiles => [1, 2].map(group => projectedRegularOrders(
  optimizeCombatGroups(profiles, { teams: [], spec: {} }), group))
assert.deepEqual(split(groupFixture), [8, 7], 'two evenly active groups may deserve a balanced split')
assert.deepEqual(split(groupFixture.map((item, index) => index === 10 ? { ...item, tacticalOrders: 1 } : item)), [9, 6],
  'Tactical Awareness makes a six-order secondary group useful')
assert.deepEqual(split(groupFixture.map((item, index) => index === 10 ? { ...item, nco: true } : item)), [9, 6],
  'NCO can use the Lieutenant Order even if the Lieutenant is in the other group')

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
  assert.match(message.content, /Group 1 · \d+ Regular/)
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

assert.equal(BUILD_LIST_COMMAND_DEFINITION.options[0].autocomplete, true)
assert.ok(BUILD_LIST_COMMAND_DEFINITION.options.slice(0, 3).every(option => option.autocomplete))
const suggestions = await searchBuildListFactions('corr')
assert.deepEqual(suggestions, [{ name: 'Jurisdictional Command of Corregidor', value: '502' }])
assert.equal((await searchBuildListFactions('nomads'))[0].value, '501')
const initialSuggestions = await searchBuildListFactions('')
assert.equal(initialSuggestions.length, 25, 'Discord limits autocomplete results to 25')
assert.ok(initialSuggestions.every(choice => LIVE_ROSTER_UNIT_SLUGS.has(Number(choice.value))))
assert.deepEqual(searchBuildListMissions('hard'), [{ name: 'Hardlock', value: 'Hardlock' }])
assert.deepEqual(await searchBuildListUnits('Jazz, iguana', 'Corregidor'),
  [{ name: "IGUANA · 'Iguana' Squadron", value: 'Jazz, IGUANA' }])
assert.ok((await searchBuildListUnits('jaz', '502')).some(choice => choice.value === 'JAZZ'))
assert.deepEqual(await searchBuildListUnits('Jazz', ''), [], 'choose a faction before suggesting its units')
const panoPayload = source.payloads.find(item => item.url?.endsWith('/units/en/101'))
const panoProfiles = availableProfiles({ payload: panoPayload, metadata: source.metadata,
  sectorialId: 101, rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(101) })
assert.equal(resolveRequiredProfile(panoProfiles, 'FUSILIER')?.slug, 'fusiliers',
  'an exact unit alias takes precedence over a similarly named paired profile')
assert.ok((await searchBuildListUnits('fusiliers', '101')).some(choice => choice.value === 'FUSILIER'))
assert.deepEqual(await searchBuildListUnits('indigo-spec-ops', '101'), [],
  'autocomplete must not offer a unit with no selectable profile')

let repliedChoices
const autocomplete = createBuildListAutocompleteHandler({ logger: { error() {} } })
assert.equal(await autocomplete({ isAutocomplete: () => true, commandName: 'build-list',
  options: { getFocused: () => ({ name: 'faction', value: 'corr' }) },
  respond: async choices => { repliedChoices = choices } }), true)
assert.deepEqual(repliedChoices, suggestions)
assert.equal(await autocomplete({ isAutocomplete: () => true, commandName: 'build-list',
  options: { getFocused: () => ({ name: 'mission', value: 'hard' }) },
  respond: async choices => { repliedChoices = choices } }), true)
assert.deepEqual(repliedChoices, [{ name: 'Hardlock', value: 'Hardlock' }])
assert.equal(await autocomplete({ isAutocomplete: () => true, commandName: 'build-list',
  options: { getFocused: () => ({ name: 'must-include', value: 'Jazz, iguana' }), getString: () => '502' },
  respond: async choices => { repliedChoices = choices } }), true)
assert.equal(repliedChoices[0].value, 'Jazz, IGUANA')

const chosenFaction = await getCurrentArmySource('502', async url => ({ ok: true,
  json: async () => url.endsWith('/metadata') ? source.metadata : payload }))
assert.equal(chosenFaction.faction.id, 502, 'the selected autocomplete ID must resolve against live metadata')
assert.equal(chosenFaction.payload, payload)

let edited = false
const existing = { name: 'build-list', description: BUILD_LIST_COMMAND_DEFINITION.description,
  options: BUILD_LIST_COMMAND_DEFINITION.options.map(option => ({ name: option.name, autocomplete: false })),
  edit: async definition => { edited = true; return { ...existing, options: definition.options, applicationId: 'app', guildId: 'guild', id: 'cmd' } } }
await ensureBuildListCommand({ guilds: { cache: new Map([['guild', { id: 'guild', commands: { fetch: async () => [existing] } }]]) },
  application: { commands: { fetch: async () => [] } } })
assert.ok(edited, 'an existing slash command must be re-registered to enable autocomplete')

console.log('PASS - build-list targets 15 models, balances orders and fireteams, and autocompletes faction, mission and units.')
