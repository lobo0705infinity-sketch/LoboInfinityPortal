#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { buildArmyListOptions, availableProfiles, fireteamUsefulness, ListBuilderError, optimizeCombatGroups,
  projectedRegularOrders, proposedFireteams, resolveRequiredProfile, roleCoverage,
  rosterConnections, rosterRedundancy, rosterSynergy } from '../bot/build-list-generator.mjs'
import { BUILD_LIST_COMMAND_DEFINITION, buildListResponses, createBuildListAutocompleteHandler,
  createBuildListInteractionHandler, ensureBuildListCommand, formatBuiltList, getCurrentArmySource,
  searchBuildListFactions, searchBuildListMissions, searchBuildListUnits } from '../bot/build-list-command.mjs'
import { LIVE_ROSTER_UNIT_SLUGS } from '../bot/official-army-rosters.mjs'
import { deriveTeamTypeEvidence, loadTeamTypeEvidence, possibleFireteamTypes } from '../bot/build-list-team-evidence.mjs'
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
  assert.ok(result.quality.gunfighters >= 2 && result.quality.aro >= 2
    && result.quality.cc >= 2 && result.quality.specialists >= 4,
  'each 300-point Hardlock list should cover separate gun and ARO slots plus CC and mission specialists')
  assert.ok(result.legality.totals.troopers >= 12)
  assert.ok(!result.profiles.some(item => item.side === 'Deepspace'), 'Surface/Deepspace exclusivity')
  assert.ok(result.fireteams.some(team => ['DUO', 'HARIS'].includes(team.type) && team.level >= 2))
  assert.ok(result.fireteams.every(team => team.type === 'CORE'
    ? team.members.length >= 3 && team.members.length <= 5 : team.members.length === (team.type === 'DUO' ? 2 : 3)))
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
assert.ok(results.some(result => projectedRegularOrders(result.profiles, 1) === 8
  && projectedRegularOrders(result.profiles, 2) === 7
  && result.profiles.filter(item => item.combatGroup === 1).reduce((sum, item) => sum + item.tacticalOrders, 0) > 0
  || projectedRegularOrders(result.profiles, 1) === 9
  && projectedRegularOrders(result.profiles, 2) === 6
  || projectedRegularOrders(result.profiles, 1) === 10
  && projectedRegularOrders(result.profiles, 2) === 5
  && result.profiles.filter(item => item.combatGroup === 1).reduce((sum, item) => sum + item.tacticalOrders, 0)
    >= result.profiles.filter(item => item.combatGroup === 2).reduce((sum, item) => sum + item.tacticalOrders, 0)),
'keep Tactical Awareness supported in a capable primary group when it is the better order split')
assert.throws(() => buildArmyListOptions({ ...input, mustInclude: ['Jazz', 'Iguana', 'Evaders'] }), ListBuilderError)

const lowPointLists = buildArmyListOptions({ ...input, points: 200 })
assert.equal(lowPointLists.length, 3)
assert.ok(lowPointLists.some(list => list.legality.totals.troopers >= 13),
  'at 200 points the forced TAG should not cause the builder to give up on model count')
assert.ok(lowPointLists.every(list => list.legality.status === 'legal'
  && list.legality.totals.troopers >= 12))

const onyxPayload = source.payloads.find(item => item.url?.endsWith('/units/en/604'))
const onyxInput = { ...input, payload: onyxPayload, sectorialId: 604,
  rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(604), mission: 'Crossing Lines', mustInclude: [] }
const onyxProfiles = availableProfiles(onyxInput)
assert.ok(onyxProfiles.some(item => item.slug === 't-drones' && item.aro),
  'ARO coverage must recognize weapons as well as skills')
assert.ok(onyxProfiles.some(item => item.slug === 'm-drones' && item.repeater),
  'hacking support must recognize weapons and equipment')
const onyxLists = buildArmyListOptions(onyxInput)
assert.equal(onyxLists.length, 3)
assert.ok(onyxLists.some(list => list.fireteams.some(team =>
  new Set(team.members.map(label => label.split(' · ')[0])).size < team.members.length
  && new Set(team.members).size > 1)),
'mixed loadouts should be eligible for pure fireteams')
for (const list of onyxLists) {
  assert.equal(list.legality.status, 'legal')
  assert.equal(list.legality.totals.troopers, 15)
  assert.ok(list.quality.gunfighters >= 2 && list.quality.aro >= 2
    && list.quality.cc >= 2 && list.quality.specialists >= 3)
  const expensiveCopies = Object.values(Object.groupBy(list.profiles.filter(item => item.points >= 30), item => item.id))
  assert.ok(expensiveCopies.every(copies => copies.length <= 2),
    'do not fill the list with three identical expensive profiles when alternatives exist')
  assert.ok(list.fireteams.some(team => team.level >= 2))
  assert.ok(rosterConnections(list.profiles).some(link => link.startsWith('Hacking:')))
  assert.ok(rosterConnections(list.profiles).some(link => link.startsWith('Repairs:')))
  assert.ok(formatBuiltList(list, 1).length <= 1990)
}

const shasPayload = source.payloads.find(item => item.url?.endsWith('/units/en/603'))
const shasInput = { ...input, payload: shasPayload, sectorialId: 603,
  rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(603), mission: 'B-Pong', mustInclude: [] }
const shasProfiles = availableProfiles(shasInput)
const haiduk = shasProfiles.find(item => item.optionName === 'HAIDUK' && item.label.includes('MULTI Sniper Rifle'))
assert.deepEqual([haiduk.gunfighterGrade, haiduk.aroGrade, haiduk.linkedGunfighterGrade, haiduk.linkedAroGrade],
  ['B', 'C', 'A', 'A'], 'the linked Haiduk benchmark must not be confused with its unlinked grade')
const haidukPair = [{ ...haiduk, combatGroup: 1 }, { ...haiduk, combatGroup: 1 }]
const haidukDuo = proposedFireteams(haidukPair, shasPayload.fireteamChart)
assert.equal(haidukDuo[0]?.type, 'DUO')
assert.deepEqual([roleCoverage(haidukPair).gunfighters, roleCoverage(haidukPair).aro], [0, 0])
assert.deepEqual([roleCoverage(haidukPair, haidukDuo).gunfighters, roleCoverage(haidukPair, haidukDuo).aro], [2, 0],
  'two linked Haiduks fill gunfighter slots, but cannot simultaneously fill ARO slots')
const speculo = shasProfiles.find(item => item.optionName === 'SPECULO KILLER' && item.points === 29)
const jayth = shasProfiles.find(item => item.optionName === 'JAYTH CUTTHROATS FTO' && item.points === 24)
const plasmaDrone = shasProfiles.find(item => item.optionName === 'Q-DRONE' && item.label.includes('Plasma Rifle'))
assert.deepEqual([speculo.ccGrade, jayth.ccGrade, plasmaDrone.aroGrade], ['S', 'A', 'A'])
const pastedListCore = [...haidukPair, { ...speculo, combatGroup: 1 },
  { ...jayth, combatGroup: 1 }, { ...jayth, combatGroup: 1 }, { ...plasmaDrone, combatGroup: 1 }]
assert.deepEqual([roleCoverage(pastedListCore, haidukDuo).gunfighters,
  roleCoverage(pastedListCore, haidukDuo).cc, roleCoverage(pastedListCore, haidukDuo).aro], [2, 3, 1],
  'the posted Shasvastii roster still lacks a second separate A/S ARO piece')
const alternateAro = shasProfiles.find(item => item.aroGrade === 'A' && item.id !== plasmaDrone.id)
assert.ok(alternateAro, 'another A-tier ARO profile should be available for a distinct role')
const completeListCore = [...pastedListCore, { ...alternateAro, combatGroup: 1 }]
assert.deepEqual([roleCoverage(completeListCore, haidukDuo).gunfighters,
  roleCoverage(completeListCore, haidukDuo).aro], [2, 2],
  'two gunfighters and two other ARO models meet separate role requirements')
assert.equal(roleCoverage(completeListCore, haidukDuo).cc, 3,
  'CC specialists count independently from shooting and ARO roles')
const allRounder = { ...haiduk, gunfighterGrade: 'A', ccGrade: 'S', aroGrade: 'A' }
assert.deepEqual([roleCoverage([allRounder]).gunfighters, roleCoverage([allRounder]).cc,
  roleCoverage([allRounder]).aro], [1, 1, 0],
  'a gunfighter may double as CC but cannot simultaneously fill an ARO slot')
assert.ok(rosterRedundancy(haidukPair) > 0,
  'two identical mid-cost sniper profiles should still pay a redundancy cost')
const shasLists = buildArmyListOptions(shasInput)
assert.ok(shasLists.every(list => list.quality.gunfighters >= 2 && list.quality.cc >= 2
  && list.quality.aro >= 2 && list.quality.specialists >= 3),
'all offered 300-point Shasvastii B-Pong builds should fill two separate gun and ARO slots')
assert.ok(shasLists[0].fireteams.some(team => ['DUO', 'HARIS'].includes(team.type) && team.level >= 2),
  'the coverage target should keep a useful pure Duo or Haris when a comparably good build exists')
assert.match(formatBuiltList(shasLists[0], 1), /\*\*A\/S coverage \(separate Guns\/ARO\)\*\* Guns \d+\/2 · CC \d+\/2 · ARO \d+\/2 · Specialists \d+\/3/)
assert.ok(formatBuiltList(shasLists[0], 1).length <= 1990)
const cheapTeam = Array.from({ length: 5 }, () => ({ specialist: false, gunfighterGrade: 'D', aroGrade: 'C' }))
const workingDuo = [{ gunfighterGrade: 'A', specialist: true }, cheapTeam[0]]
const workingCore = [
  { gunfighterGrade: 'A', specialist: true }, { gunfighterGrade: 'A', ccGrade: 'S' },
  { aroGrade: 'A', specialist: true }, { aroGrade: 'A' }, cheapTeam[0],
]
assert.ok(fireteamUsefulness({ type: 'DUO', level: 2 }, workingDuo)
  > fireteamUsefulness({ type: 'CORE', level: 5 }, cheapTeam),
'a productive Duo should outrank a pure Core of five low-impact members')
assert.ok(fireteamUsefulness({ type: 'HARIS', level: 3 }, [...workingDuo, cheapTeam[0]])
  > fireteamUsefulness({ type: 'CORE', level: 5 }, cheapTeam),
'a productive Haris should outrank a pure Core of five low-impact members')
assert.ok(fireteamUsefulness({ type: 'CORE', level: 5 }, workingCore)
  > fireteamUsefulness({ type: 'DUO', level: 2 }, workingDuo),
'a Core with multiple useful roles should still beat a weaker Duo')
const pairFixture = [
  { id: 'hacker', unitId: 1, hacker: true, specialist: true, mobility: 45, points: 25 },
  { id: 'repeater', unitId: 2, repeater: true, mobility: 55, points: 10 },
  { id: 'engineer', unitId: 3, engineer: true, specialist: true, mobility: 45, points: 20 },
  { id: 'remote', unitId: 4, repairable: true, points: 45 },
]
assert.ok(rosterSynergy(pairFixture) > rosterSynergy([pairFixture[0], pairFixture[2]]),
  'the complete support network must beat isolated specialists')
assert.ok(rosterRedundancy([pairFixture[0], pairFixture[0], pairFixture[0]]) > 0,
  'a third copy of the same premium profile must carry an opportunity cost')
assert.ok(rosterRedundancy([{ id: 'tag-a', unitId: 5, points: 68 }, { id: 'tag-b', unitId: 5, points: 64 }])
  > rosterRedundancy([{ id: 'line-a', unitId: 6, points: 14 }, { id: 'line-b', unitId: 6, points: 15 }]),
'two different loadouts of the same expensive unit must still carry a cost')

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

const evidenceTeam = { name: 'Line Fireteams', type: ['DUO', 'HARIS', 'CORE'], units: [
  { slug: 'line', name: 'LINE', required: true, min: 0, max: 5 },
] }
const evidencePayload = { url: 'https://api.corvusbelli.com/army/units/en/777',
  units: [{ id: 1, slug: 'line', name: 'LINE', profileGroups: [{ id: 1, options: [{ id: 1, name: 'LINE Rifle' }] }] }],
  fireteamChart: { teams: [evidenceTeam], spec: { CORE: 1, HARIS: 1, DUO: 1 } } }
const evidenceEntry = () => ({ combinedId: '777-1-1-1-1',
  fireteamEligibility: { state: 'verified', teams: ['Line Fireteams'] } })
const evidenceList = (result, count = 3, split = false) => ({ status: 'decoded', result, results: [result.toLowerCase()],
  decoded: { combatGroups: [{ combatGroup: 1, entries: Array.from({ length: split ? 1 : count }, evidenceEntry) },
    { combatGroup: 2, entries: split ? Array.from({ length: count - 1 }, evidenceEntry) : [] }] } })
assert.deepEqual(possibleFireteamTypes(evidenceList('Win'), evidencePayload), ['DUO', 'HARIS', 'CORE'],
  'a same-group pure trio can choose any legal type in the chart')
assert.deepEqual(possibleFireteamTypes(evidenceList('Win', 2, true), evidencePayload), [],
  'entries split across combat groups cannot form a team')
assert.deepEqual(possibleFireteamTypes(evidenceList('Win', 2), evidencePayload), ['DUO'],
  'two matching members cannot form Haris or Core')
const evidenceSnapshot = { snapshotId: 'test', data: [{ lists: [
  evidenceList('Win'), evidenceList('Win'), evidenceList('Win'), evidenceList('Loss'),
  evidenceList('Loss', 1), evidenceList('Loss', 1),
  { ...evidenceList('Win'), results: ['win', 'loss'] },
] }] }
const evidence = deriveTeamTypeEvidence(evidenceSnapshot, { payloads: [evidencePayload] })
assert.equal(evidence.decisiveLists, 6, 'mixed and draw results cannot become definite wins')
assert.deepEqual([evidence.observations.CORE.wins, evidence.observations.CORE.losses], [3, 1])
assert.ok(evidence.preferences[777].CORE > 0 && evidence.preferences[777].CORE < .75,
  'a modest type preference is earned from the within-sectorial result difference')
const evidenceMembers = Array.from({ length: 3 }, (_, index) => ({ id: `line-${index}`, unitId: 1,
  slug: 'line', unitName: 'LINE', optionName: 'LINE Rifle', label: `LINE Rifle ${index}`,
  combatGroup: 1, slots: 1, points: 10, specialist: false, gunfighter: 0 }))
assert.equal(proposedFireteams(evidenceMembers, evidencePayload.fireteamChart)[0]?.type, 'HARIS')
assert.equal(proposedFireteams(evidenceMembers, evidencePayload.fireteamChart, null,
  { CORE: -20, DUO: 20 })[0]?.type, 'DUO', 'type evidence can change which overlapping legal team is selected')
assert.equal(await loadTeamTypeEvidence({ payloads: [evidencePayload] }, async () => ({ ok: false, status: 503 })), null,
  'if the public snapshot is unavailable, Fireteam generation retains its chart-only fallback')

const vanilla = buildArmyListOptions({ ...input, payload: { ...payload, fireteamChart: { teams: [], spec: {} } }, count: 1 })
assert.equal(vanilla.length, 1)
assert.deepEqual(vanilla[0].fireteams, [], 'armies without a chart must still get a list')

const messages = await buildListResponses({ faction: 'Corregidor', mission: 'Hardlock', mustInclude: 'Jazz, Iguana',
  getSource: async () => ({ faction: source.metadata.factions.find(item => item.id === 502), payload, metadata: source.metadata }),
  getCatalog: async () => catalog, getAroCatalog: async () => aroCatalog,
  getCloseCombatCatalog: async () => closeCombatCatalog, getMobilityCatalog: async () => mobilityCatalog,
  getTeamEvidence: async () => null })
assert.equal(messages.length, 3)
for (const message of messages) {
  assert.ok(message.content.length <= 2000)
  assert.match(message.content, /Proposed fireteams[\s\S]*Level [2345]/)
  assert.match(message.content, /A\/S coverage.*Guns \d+\/2.*CC \d+\/2.*ARO \d+\/2/)
  assert.match(message.content, /Support links/)
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
