#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { assessLieutenantPackage, buildArmyListOptions, availableProfiles, fireteamUsefulness, impactAnchorValue, ListBuilderError, matchingLieutenantDecoy, missionSpecialistPenalty, ncoCombatValue, optimizeCombatGroups,
  projectedRegularOrders, proposedFireteams, resolveRequiredProfile, roleCoverage,
  rosterConnections, rosterRedundancy, rosterSynergy } from '../bot/build-list-generator.mjs'
import { BUILD_LIST_COMMAND_DEFINITION, BUILD_LIST_EXTRA_MODEL_OPTIONS, buildListResponses, createBuildListAutocompleteHandler,
  createBuildListInteractionHandler, ensureBuildListCommand, formatBuiltList, getCurrentArmySource,
  searchBuildListFactions, searchBuildListMissions, searchBuildListUnits } from '../bot/build-list-command.mjs'
import { LIVE_ROSTER_UNIT_SLUGS } from '../bot/official-army-rosters.mjs'
import { deriveTeamTypeEvidence, loadTeamTypeEvidence, possibleFireteamTypes } from '../bot/build-list-team-evidence.mjs'
import { decodeArmyCode } from './infinity-army-decode.mjs'
import { encodeArmyCode } from './infinity-army-encode.mjs'
import { missionPlan } from '../bot/build-list-missions.mjs'
import { validateInfListLegality } from '../bot/inf-list-legality.mjs'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'

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
const transductor = profiles.find(item => item.slug === 'transductor-zonds' && item.points === 7)
const warcor = profiles.find(item => /warcor/i.test(item.slug))
assert.ok(transductor?.regular && transductor.flashPulse && transductor.repairable,
  'the 7-point Flash Pulse remote provides a Regular order')
assert.ok(warcor && warcor.irregular && !warcor.regular && warcor.flashPulse,
  'a Warcor provides cheap ARO utility but no Regular order')

const input = { payload, metadata: source.metadata, sectorialId: 502, rosterSlugs: roster,
  gunfighterCatalog: catalog, aroCatalog, closeCombatCatalog, mobilityCatalog,
  mission: 'Hardlock', mustInclude: ['Jazz', 'Iguana'], points: 300 }
const yuJingPayload = source.payloads.find(item => item.url?.endsWith('/units/en/201'))
const yuJingInput = { ...input, payload: yuJingPayload, sectorialId: 201,
  rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(201), mustInclude: [] }
const yuJingProfiles = availableProfiles(yuJingInput)
assert.equal(resolveRequiredProfile(yuJingProfiles, 'Kuang Shi')?.groupId, 1,
  'asking for Kuang Shi selects the fighter rather than its Celestial Guard Monitor')
assert.ok(yuJingProfiles.some(item => item.slug === 'kuang-shi' && item.groupId === 2
  && /Celestial Guard Monitor/i.test(item.optionName)), 'the Monitor is selectable from its separate Army profile group')
const reportedCode = 'gMkHeXUtamluZw1Mb2JvIEhhcmRsb2NrgSwCAQEACAB8AQoAAAB8AQEAAACE6QEDAAAAgI4BAQAAAIcwAQUAAACF2QEFAAAAhzIBAQAAAICKAQEAAAIBAAcAhtsBBAAAAIbbAQEAAACG3AEDAAAAhj8BAQAAAICNAQIAAACAkgEBAAAAMgECAAA%3D'
const reportedList = validateInfListLegality({ decoded: decodeArmyCode(decodeURIComponent(reportedCode)), payload: yuJingPayload })
assert.equal(reportedList.status, 'illegal', 'the exact reported Hardlock list has an uncontrolled Kuang Shi')
assert.ok(reportedList.violations.some(issue => /Combat Group 2.*Celestial Guard Monitor/.test(issue)))
const controlledKuangShi = buildArmyListOptions({ ...yuJingInput, mustInclude: ['Kuang Shi', 'Kuang Shi'], count: 1 })[0]
assert.ok(controlledKuangShi && controlledKuangShi.legality.status === 'legal')
const controlledGroup = controlledKuangShi.profiles.filter(item => item.slug === 'kuang-shi')
assert.equal(controlledGroup.filter(item => item.groupId === 1).length, 2,
  'two requested Kuang Shi can coexist under one Monitor')
assert.equal(controlledGroup.filter(item => item.groupId === 2).length, 1)
assert.ok(controlledGroup.every(item => item.combatGroup === controlledGroup[0].combatGroup),
  'the group optimizer keeps Kuang Shi and their Monitor together')
const results = buildArmyListOptions(input)
assert.equal(results.length, 3)
assert.ok(results.some(result => result.points >= 298 && result.profiles.some(item => item.id === transductor.id)
  && result.quality.gunfighters >= 2 && result.quality.aro >= 2),
'a cheap Regular Flash Pulse remote can release points for a strong, nearly full roster')
assert.ok(results.every(result => result.profiles.filter(item => /warcor/i.test(item.slug)).length <= 1),
  'do not fill spare slots with multiple Irregular Warcors')
assert.equal(new Set(results.map(item => item.profiles.map(profile => `${profile.combatGroup}:${profile.id}`).sort().join('|'))).size, 3)
assert.ok(results.some(result => result.legality.totals.troopers === 15), 'prefer 15 models when the roster can support them')
const alguacilLieutenant = profiles.find(item => item.slug === 'corregidor-alguaciles' && item.lieutenant)
const alguacilDecoy = profiles.find(item => item.slug === 'corregidor-alguaciles' && !item.lieutenant && item.optionId === 1)
const alguacilParamedic = profiles.find(item => item.slug === 'corregidor-alguaciles' && !item.lieutenant && item.paramedic)
assert.ok(matchingLieutenantDecoy(alguacilLieutenant, alguacilDecoy), 'the ordinary Alguacil has the Lieutenant’s exact loadout')
assert.ok(!matchingLieutenantDecoy(alguacilLieutenant, alguacilParamedic), 'a visible MediKit is not an identical decoy')
assert.ok(results.every(result => result.lieutenantPlan.kind === 'cheap-decoy'
  && matchingLieutenantDecoy(result.lieutenantPlan.lieutenant, result.lieutenantPlan.partner)),
'Corregidor must pair its cheap LI Lieutenant with a truly identical non-Lieutenant')
assert.ok(results.every(result => result.lieutenantPlan.nco && result.lieutenantPlan.nco.nco
  && ['A', 'B', 'S'].includes(result.lieutenantPlan.nco.gunfighterGrade)),
'a cheap Lieutenant with a decoy needs a capable NCO to spend the Lieutenant Order')
const wildcatPlusOne = profiles.find(item => item.slug === 'wildcats'
  && item.lieutenantOrders === 2)
const loboNco = profiles.find(item => item.nco && item.optionName === 'LOBO')
assert.ok(wildcatPlusOne && loboNco, 'Corregidor provides a +1 Order Lieutenant and a combat NCO')
assert.ok(assessLieutenantPackage([wildcatPlusOne, loboNco], [], missionPlan('Hardlock')).score
  > assessLieutenantPackage([wildcatPlusOne], [], missionPlan('Hardlock')).score,
  'Lieutenant (+1 Order) sharply rewards a combat NCO even without a cheap-LI decoy')
assert.ok(ncoCombatValue(loboNco) > ncoCombatValue({ ...loboNco, gunfighterGrade: 'F', gunfighter: 0,
  ccGrade: 'F', ccRating: 0 }), 'NCO gunfighting and close-combat ratings influence the pick')
const onlyPlusOneLieutenant = { ...payload, units: payload.units.map(unit => ({ ...unit,
  profileGroups: unit.profileGroups?.map(group => ({ ...group, options: group.options?.filter(option =>
    !(option.orders || []).some(order => order.type === 'LIEUTENANT')
      || unit.slug === 'wildcats' && option.id === wildcatPlusOne.optionId) })),
  options: unit.options?.filter(option => !(option.orders || []).some(order => order.type === 'LIEUTENANT')),
})) }
const plusOneList = buildArmyListOptions({ ...input, payload: onlyPlusOneLieutenant, mustInclude: [], count: 1 })[0]
assert.equal(plusOneList.lieutenantPlan.lieutenant.lieutenantOrders, 2)
assert.ok(plusOneList.lieutenantPlan.nco && !plusOneList.lieutenantPlan.nco.lieutenant
  && ncoCombatValue(plusOneList.lieutenantPlan.nco) >= ncoCombatValue(loboNco),
  'a +1 Order Lieutenant gets a separate, high-performing NCO in a legal generated list')
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
assert.ok(results.every(result => projectedRegularOrders(result.profiles, 1) >= projectedRegularOrders(result.profiles, 2)
  && [1, 2].every(group => !result.profiles.some(item => item.combatGroup === group && item.tacticalOrders)
    || projectedRegularOrders(result.profiles, group) >= 5)),
'Tactical Awareness belongs in a group with enough Regular orders to use its active pieces')
const nomadsPayload = source.payloads.find(item => item.url?.endsWith('/units/en/501'))
const nomadsInput = { ...input, payload: nomadsPayload, sectorialId: 501,
  rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(501), mission: 'Crossing Lines', mustInclude: [] }
const nomadsProfiles = availableProfiles(nomadsInput)
const taskmaster = nomadsProfiles.find(item => item.optionName === 'TASKMASTER'
  && item.label.includes('Heavy Machine Gun') && item.points === 40)
assert.ok(impactAnchorValue([taskmaster]) > 0, 'a proven 40-point attacker is a useful investment')
assert.equal(impactAnchorValue([{ ...taskmaster, gunfighterGrade: 'F', aroGrade: 'F', ccGrade: 'F' }]), 0,
  'a high price alone must not earn an impact bonus')
assert.equal(impactAnchorValue([taskmaster, taskmaster]), impactAnchorValue([taskmaster]),
  'duplicates do not become better just because they cost more')
const nomadsList = buildArmyListOptions({ ...nomadsInput, count: 1 })[0]
const nomadsAlternatives = buildArmyListOptions({ ...nomadsInput, count: 3 })
const nomadsFlashBots = nomadsList.profiles.filter(item => item.slug === 'transductor-zonds'
  && item.points === 7 && item.regular && item.flashPulse)
assert.ok(nomadsAlternatives.some(list => list.profiles.filter(item => item.slug === 'transductor-zonds'
  && item.points === 7 && item.regular && item.flashPulse).length === 2),
  'the Nomads builder still evaluates two cheap Regular Flash Pulse orders alongside linked infantry and Baggage')
assert.ok(nomadsFlashBots.length <= nomadsProfiles.find(item => item.slug === 'transductor-zonds')?.ava,
  'the second Flash Pulse remote still obeys its official availability')
assert.ok(nomadsList.profiles.filter(item => item.optionName === 'SECURITATE' && /Combi Rifle/i.test(item.label)).length < 2,
  'do not preserve a pair of basic Securitate Combi orders solely for a weak Duo')
assert.ok(nomadsList.profiles.some(item => impactAnchorValue([item]) > 0 && item.points >= 30),
  'a 300-point Nomads roster should consider at least one capable expensive model')
assert.ok(nomadsAlternatives.some(list => list.profiles.some(item => item.points === 7 && item.flashPulse && item.regular)
  && list.profiles.some(item => impactAnchorValue([item]) > 0 && item.points >= 30)),
  'an efficient Flash Pulse order can support expensive role pieces in a competitive alternative')
assert.ok(nomadsList.legality.status === 'legal' && nomadsList.quality.gunfighters >= 2
  && nomadsList.quality.aro >= 2 && nomadsList.quality.cc >= 2
  && nomadsList.profiles.filter(item => item.regular).length >= 13,
  'the expensive models must not displace the order base or separate combat coverage')
assert.ok(nomadsProfiles.some(item => item.slug === 'salyut-zonds' && item.baggage),
  'Army equipment identifies Baggage for zone scoring and item carriage')
assert.ok(!transductor.civEvacEligible && nomadsProfiles.some(item => item.civEvacEligible),
  'a Flash Pulse REM is an order source, not an eligible CivEvac escort')
assert.ok(nomadsProfiles.some(item => item.slug === 'perseus-rogue-myrmidon' && item.essentialPersonnel),
  'a Character can fulfill Panic Room Essential Personnel requirements')
const outbreakList = buildArmyListOptions({ ...nomadsInput, mission: 'Outbreak', count: 1 })[0]
const annihilationList = buildArmyListOptions({ ...nomadsInput, mission: 'Annihilation', count: 1 })[0]
const cutthroatList = buildArmyListOptions({ ...nomadsInput, mission: 'Cutthroat', count: 1 })[0]
const akialList = buildArmyListOptions({ ...nomadsInput, mission: 'Akial Interference', count: 1 })[0]
assert.equal(nomadsList.lieutenantPlan.kind, 'cheap-decoy', 'an objective mission may favor an economical LI Lieutenant and decoy')
assert.equal(annihilationList.lieutenantPlan.kind, 'apex-coc', 'Lieutenant-kill scoring favors an S gunfighter Lieutenant with Chain of Command')
assert.equal(annihilationList.lieutenantPlan.lieutenant.gunfighterGrade, 'S')
assert.ok(annihilationList.lieutenantPlan.partner.chainOfCommand)
assert.equal(cutthroatList.lieutenantPlan.kind, 'apex-open', 'Tactical Link favors an S gunfighter Lieutenant without a dedicated decoy')
assert.ok(!cutthroatList.profiles.some(item => item.chainOfCommand), 'Tactical Link removes the need to pay for Loss of Lieutenant protection')
assert.ok(!cutthroatList.profiles.some(item => matchingLieutenantDecoy(cutthroatList.lieutenantPlan.lieutenant, item)),
  'an openly identified Lieutenant gains nothing from an identical non-Lieutenant')
assert.equal(assessLieutenantPackage(cutthroatList.profiles, cutthroatList.fireteams, missionPlan('Cutthroat')).kind, 'apex-open')
assert.equal(missionPlan('Annihilation').lieutenantKills, true)
assert.equal(missionPlan('Cutthroat').tacticalLink, true)
assert.equal(missionPlan('Firefight').tacticalLink, true)
const lowCombatObserver = { forwardObserver: true, specialistOperative: false,
  gunfighterGrade: 'B', linkedGunfighterGrade: 'A', ccGrade: 'B' }
for (const name of ['Annihilation', 'Battleground', 'Cutthroat']) {
  const plan = missionPlan(name)
  assert.equal(missionSpecialistPenalty(lowCombatObserver, plan), 6,
    `${name} should prefer a better combat or support use of this roster slot`)
  assert.equal(missionSpecialistPenalty({ ...lowCombatObserver, forwardObserver: false, specialistOperative: true }, plan), 6)
  for (const role of ['paramedic', 'doctor', 'engineer', 'hacker']) {
    assert.equal(missionSpecialistPenalty({ ...lowCombatObserver, [role]: true }, plan), 0,
      `${name} should not penalize a ${role} who is also a Forward Observer`)
  }
  assert.equal(missionSpecialistPenalty({ ...lowCombatObserver, gunfighterGrade: 'A' }, plan), 0)
  assert.equal(missionSpecialistPenalty({ ...lowCombatObserver, ccGrade: 'S' }, plan), 0)
  assert.equal(missionSpecialistPenalty(lowCombatObserver, plan, true), 0,
    'an actually linked A-tier gunfighter keeps its combat exception')
}
for (const name of ['Crossing Lines', 'Outbreak', 'Superiority', 'Uplink Center', 'Firefight']) {
  assert.equal(missionSpecialistPenalty(lowCombatObserver, missionPlan(name)), 0,
    `${name} still uses its own specialist priorities`)
}
assert.ok(akialList.legality.status === 'legal' && akialList.quality.specialistTarget === 5
  && akialList.specialistCount >= 5 && akialList.quality.gunfighters >= 2
  && akialList.quality.aro >= 2 && akialList.quality.cc >= 2,
  'Akial requires at least five specialists while retaining separate combat roles')
const outbreakMedics = outbreakList.profiles.filter(item => item.doctor || item.paramedic || item.specialistOperative)
assert.ok(outbreakList.legality.status === 'legal' && outbreakMedics.length >= 2
  && outbreakMedics.length > annihilationList.profiles.filter(item => item.doctor || item.paramedic || item.specialistOperative).length,
  'Outbreak should select capable scanning and stabilizing models over the combat mission roster')
assert.equal(annihilationList.quality.specialistTarget, 0,
  'Annihilation has no compulsory specialist target')
assert.match(formatBuiltList(outbreakList, 1), /Mission plan.*scan and stabilize.*medical specialists/,
  'Discord lists explain the selected mission plan and its available models')
const doubleBind = buildArmyListOptions({ ...nomadsInput, mission: 'Double Bind' })
assert.deepEqual(doubleBind.map(list => list.missionPlan.variant), [0, 1, 2],
  'Double Bind offers a distinct list for each of its three selectable objectives')
assert.ok(doubleBind.every(list => list.legality.status === 'legal')
  && doubleBind[1].profiles.some(item => item.demolition),
  'the Sabotage plan has an eligible way to attack an Antenna')
assert.equal(missionPlan("Dead Man's Switch").verified, false,
  'unverified scenarios must not claim invented mission objectives')
assert.deepEqual(CANONICAL_MISSIONS.filter(mission => !missionPlan(mission).verified), ["Dead Man's Switch"],
  'every other selectable mission has a verified scoring plan')
assert.throws(() => buildArmyListOptions({ ...input, mustInclude: ['Jazz', 'Iguana', 'Evaders'] }), ListBuilderError)
const repeatedModels = buildArmyListOptions({ ...input, mustInclude: ['ALGUACIL', 'ALGUACIL'], count: 1 })
assert.equal(repeatedModels[0].profiles.filter(profile => profile.id === resolveRequiredProfile(profiles, 'ALGUACIL').id).length, 2,
  'selecting the same model twice requests two actual copies when its availability allows it')
assert.throws(() => buildArmyListOptions({ ...input, mustInclude: ['Jazz', 'Jazz'] }), ListBuilderError,
  'repeated models still obey Army availability')
const warcorList = buildArmyListOptions({ ...input, mustInclude: ['Jazz', 'Iguana', 'Warcor'], count: 1 })[0]
assert.equal(warcorList.legality.status, 'legal')
assert.equal(warcorList.profiles.filter(item => /warcor/i.test(item.slug)).length, 1)
assert.match(formatBuiltList(warcorList, 1), /WARCOR[^\n]*Irregular/,
  'show the Warcor as Irregular even though it fills a trooper slot')

const lowPointLists = buildArmyListOptions({ ...input, points: 200 })
assert.equal(lowPointLists.length, 3)
assert.ok(lowPointLists.some(list => list.legality.totals.troopers >= 11),
  'at 200 points the forced TAG should still allow at least 11 actual Troopers')
assert.ok(lowPointLists.every(list => list.legality.status === 'legal'
  && list.legality.totals.troopers >= 10), 'Peripherals do not inflate the 200-point Trooper count')

const onyxPayload = source.payloads.find(item => item.url?.endsWith('/units/en/604'))
const onyxInput = { ...input, payload: onyxPayload, sectorialId: 604,
  rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(604), mission: 'Crossing Lines', mustInclude: [] }
const onyxProfiles = availableProfiles(onyxInput)
const imetron = onyxProfiles.find(item => item.optionName === 'ÍMETRON')
assert.ok(imetron && !imetron.aroGrade && !imetron.linkedAroGrade,
  'a weaponless Imetron cannot occupy an ARO slot even if the benchmark assigns a grade')
const alephPayload = source.payloads.find(item => item.url?.endsWith('/units/en/703'))
const alephProfiles = availableProfiles({ ...input, payload: alephPayload, sectorialId: 703,
  rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(703) })
const netrod = alephProfiles.find(item => item.optionName === 'NETROD')
assert.ok(netrod && !netrod.aroGrade && !netrod.linkedAroGrade,
  'a weaponless Netrod cannot occupy an ARO slot')
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
assert.equal(fireteamUsefulness({ type: 'DUO', level: 2 }, cheapTeam.slice(0, 2)), 0,
  'two low-impact line infantry do not earn a Fireteam usefulness bonus')
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
  combatGroup: 1, slots: 1, points: 10, specialist: index === 0, gunfighter: 0 }))
assert.deepEqual(proposedFireteams(evidenceMembers.map(member => ({ ...member, specialist: false })),
  evidencePayload.fireteamChart), [], 'a Fireteam of basic order providers is not proposed just for its composition')
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
assert.equal(messages.length, 1, '/build-list sends one ranked army')
for (const message of messages) {
  assert.ok(message.content.length <= 2000)
  assert.doesNotMatch(message.content, /· option \d+/)
  assert.match(message.content, /Proposed fireteams[\s\S]*Level [2345]/)
  assert.match(message.content, /A\/S coverage.*Guns \d+\/2.*CC \d+\/2.*ARO \d+\/2/)
  assert.match(message.content, /Support links/)
  assert.match(message.content, /BS Attack \(\+1 SD\)/)
  assert.match(message.content, /Group 1 · \d+ Regular/)
  assert.match(message.content, /Open in Infinity Army/)
  assert.equal(message.embeds.length, 1)
  assert.equal(message.embeds[0].fields.length, 20, 'all current Operations Deck cards appear in the reply')
  assert.match(message.embeds[0].fields[8].value, /JAZZ/i, 'the Jazz component of the required Jazz & Billie team can do HVT: Espionage')
  assert.ok(message.embeds[0].fields.every(field => !/Secure HVT/i.test(field.name)))
}
const calls = []
let selectedModels
const handler = createBuildListInteractionHandler({ build: async options => { selectedModels = options.mustInclude; return messages }, logger: { error() {} } })
const handled = await handler({
  isChatInputCommand: () => true, commandName: 'build-list',
  options: { getString: name => ({ faction: 'Corregidor', mission: 'Hardlock', 'must-include': 'Jazz, Iguana',
    'model-2': 'ALGUACIL', 'model-3': 'ALGUACIL', 'model-4': 'SOMBRA' })[name], getInteger: () => 300 },
  deferReply: async () => calls.push('defer'), editReply: async result => calls.push(result),
  followUp: async () => { throw Error('a second list must not be sent') },
})
assert.equal(handled, true)
assert.equal(calls.length, 2, 'defer and the one generated list')
assert.deepEqual(selectedModels, ['Jazz', 'Iguana', 'ALGUACIL', 'ALGUACIL', 'SOMBRA'],
  'independent model slots combine with the original comma input and preserve requested copies')

assert.equal(BUILD_LIST_COMMAND_DEFINITION.options[0].autocomplete, true)
assert.deepEqual(BUILD_LIST_EXTRA_MODEL_OPTIONS, ['model-2', 'model-3', 'model-4', 'model-5'])
assert.ok(BUILD_LIST_COMMAND_DEFINITION.options.slice(0, 7).every(option => option.autocomplete))
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
assert.equal(await autocomplete({ isAutocomplete: () => true, commandName: 'build-list',
  options: { getFocused: () => ({ name: 'model-2', value: 'iguana' }), getString: () => '502' },
  respond: async choices => { repliedChoices = choices } }), true)
assert.equal(repliedChoices[0].value, 'IGUANA', 'an extra slot selects only its own model')
assert.equal(await autocomplete({ isAutocomplete: () => true, commandName: 'build-list',
  options: { getFocused: () => ({ name: 'model-3', value: 'iguana' }), getString: () => '502' },
  respond: async choices => { repliedChoices = choices } }), true)
assert.equal(repliedChoices[0].value, 'IGUANA', 'the same model may be selected again when Army availability allows')

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
