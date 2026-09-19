import assert from 'node:assert/strict'
import { classifyTacticalBrief } from '../bot/inf-list-tactical.mjs'
import { buildTacticalAnalysis, type TacticalCategoryId } from '../src/services/armyIntelligenceTacticalAnalysis.ts'

const membership = (memberName: string) => ({
  team: 'Caledonian Fireteam', minSize: 3, required: false, requiredNames: [], memberName, countsAs: '',
})
const weapon = (name: string, burst: number, modifiers: string[] = []) => ({ name, mode: '', type: 'WEAPON', burst, burstStatus: 'canonical', modifiers })
const source = [
  { combinedId: 'mormaer', unit: 'CALEDONIAN MORMAER', profile: 'Heavy Machine Gun', bs: 13, cc: 14, points: 40, skills: ['BS Attack (-3)'], equipment: [], weapons: [weapon('Heavy Machine Gun', 4)], memberships: [] },
  { combinedId: 'isobel', unit: 'ISOBEL McGREGOR', profile: 'T2 Rifle', bs: 12, cc: 18, points: 25, skills: [], equipment: [], weapons: [weapon('T2 Rifle', 3)], memberships: [membership('ISOBEL McGREGOR')] },
  { combinedId: 'uxia', unit: 'UXÍA McNEILL', profile: 'Boarding Shotgun', bs: 11, cc: 22, points: 27, skills: ['BS Attack (+1B)', 'Martial Arts L2', 'Camouflage', 'Mimetism (-3)'], equipment: [], weapons: [weapon('Assault Pistol', 4), weapon('Smoke Grenades', 1)], memberships: [] },
  { combinedId: 'wallace', unit: 'WILLIAM WALLACE', profile: 'T2 Rifle', bs: 13, cc: 24, points: 30, skills: ['BS Attack (+1SD)', 'Natural Born Warrior'], equipment: [], weapons: [weapon('T2 Rifle', 3), weapon('Smoke Grenades', 1)], memberships: [] },
  { combinedId: 'firststrike', unit: 'CADIN FIRSTSTRIKE DONN', profile: 'FIRSTSTRIKE DONN', bs: 12, cc: 23, points: 30, skills: ['Martial Arts L1'], equipment: [], weapons: [weapon('Flammenspeer', 1)], memberships: [membership('FIRSTSTRIKE DONN')] },
  { combinedId: 'beast-fto', unit: 'BEASTHUNTERS FREE GUILD', profile: 'BEASTHUNTER FTO', bs: 11, cc: 18, points: 17, skills: ['Camouflage'], equipment: [], weapons: [weapon('Panzerfaust', 1)], memberships: [membership('BEASTHUNTER FTO')] },
  { combinedId: 'beast-non-fto', unit: 'BEASTHUNTERS FREE GUILD', profile: 'BEASTHUNTERS', bs: 11, cc: 18, points: 17, skills: ['Camouflage'], equipment: [], weapons: [weapon('Panzerfaust', 1)], memberships: [] },
]

const botProfiles = source.map((item) => ({
  bs: item.bs, cc: item.cc, combinedId: item.combinedId, equipment: item.equipment,
  fireteamMemberships: item.memberships, fireteamTeams: item.memberships.map((row) => row.team),
  linkability: item.memberships.length ? 'verified-linkable' : 'verified-not-linkable',
  profileName: item.profile, points: item.points, skills: item.skills, unitId: 1,
  unitName: item.unit, weapons: item.weapons,
}))
const portalEntries = source.map((item) => ({
  combatGroup: 1, chainOfCommand: false, combinedId: item.combinedId, cc: item.cc, doctor: false,
  engineer: false, equipment: item.equipment, forwardObserver: false, hacker: false, lieutenant: false,
  orderTypes: ['regular'], points: item.points, profile: item.profile, skills: item.skills, specialist: false,
  structure: null, swc: 0, troopType: 'LI', unit: item.unit, weapons: item.weapons.map((row) => row.name),
  wounds: 1, bs: item.bs, weaponProfiles: item.weapons,
  fireteamEligibility: { state: item.memberships.length ? 'verified' : 'verified-false', verified: Boolean(item.memberships.length), teams: item.memberships.map((row) => row.team), memberships: item.memberships },
}))
const portalList = {
  armyCode: '', armyCodeHash: 'parity', date: '', decodedAt: '', error: '', event: '', faction: 'Ariadna',
  gameType: 'League', knownArmyLists: 1, mission: '', opponent: '', player: 'Fixture', result: 'Win', results: ['win'],
  sectorial: 'Caledonian Highlander Army', snapshotKey: 'parity', sourceId: 'parity', sourcePlayer: 'Fixture',
  sourceType: 'League', status: 'decoded' as const,
  decoded: { combatGroups: [{ combatGroup: 1, entries: portalEntries }], decoderVersion: 'fixture', faction: 'Ariadna', listName: 'Parity', orderCounts: { impetuous: 0, irregular: 0, lieutenant: 0, regular: portalEntries.length }, sectorial: 'Caledonian Highlander Army', totals: { combatGroups: 1, points: 300, swc: 6 } },
}

const bot = classifyTacticalBrief(botProfiles, { faction: 'Ariadna', sectorial: 'Caledonian Highlander Army' })
const portal = buildTacticalAnalysis([portalList] as never)
const categoryIds: TacticalCategoryId[] = ['apex', 'competent', 'apexCc', 'hacking', 'vision', 'valuableAro', 'disposableAro', 'alternative', 'defensive']
for (const id of categoryIds) {
  const botIds = bot.categories[id].map((item) => item.combinedId).sort()
  const portalIds = (portal.categories.find((item) => item.id === id)?.profiles || []).map((item) => item.profileId.split('::')[0]).sort()
  assert.deepEqual(portalIds, botIds, `${id} must match /inf-list exactly`)
}
assert.deepEqual(bot.categories.apex.map((item) => item.combinedId), ['mormaer'])
assert.equal(bot.categories.valuableAro.some((item) => item.combinedId === 'beast-fto'), true)
assert.equal(bot.categories.valuableAro.some((item) => item.combinedId === 'beast-non-fto'), false)
console.log('Army Intelligence and /inf-list tactical classifiers passed exact Caledonian parity.')
