import assert from 'node:assert/strict'
import { buildTacticalAnalysis } from '../src/services/armyIntelligenceTacticalAnalysis.ts'

const entry = (combinedId: string, unit: string, profile: string, fields: Record<string, unknown> = {}) => ({
  combatGroup: 1, chainOfCommand: false, combinedId, doctor: false, engineer: false,
  equipment: [], forwardObserver: false, hacker: false, lieutenant: false, orderTypes: ['regular'],
  points: 20, profile, skills: [], specialist: false, structure: null, swc: 0, troopType: 'LI',
  unit, weapons: [], wounds: 1, ...fields,
})
const decodedList = (name: string, entries: unknown[]) => ({
  armyCode: '', armyCodeHash: name, date: '', decodedAt: '', error: '', event: '', faction: 'Fixture',
  gameType: 'League', knownArmyLists: 1, mission: '', opponent: '', player: name, result: 'Win', results: ['win'],
  sectorial: 'Fixture', snapshotKey: name, sourceId: name, sourcePlayer: name, sourceType: 'League', status: 'decoded' as const,
  decoded: { combatGroups: [{ combatGroup: 1, entries }], decoderVersion: 'fixture', faction: 'Fixture', listName: name,
    orderCounts: { impetuous: 0, irregular: 0, lieutenant: 0, regular: entries.length }, sectorial: 'Fixture',
    totals: { combatGroups: 1, points: 300, swc: 6 } },
})

const canonicalBurst = (name: string, burst: number | null, burstStatus = burst === null ? 'unknown' : 'canonical') => ({ name, burst, burstStatus })
const apex = entry('1', 'APEX', 'HMG', { bs: 13, skills: ['Mimetism (-3)', 'Multispectral Visor L2', 'BS Attack (-3)'], weapons: ['HMG'], weaponProfiles: [canonicalBurst('HMG', 4)] })
const boundaryFailBs = entry('2', 'LOW BS', 'HMG', { bs: 12, weapons: ['HMG'], weaponProfiles: [canonicalBurst('HMG', 4)] })
const burstBonus = entry('bonus', 'BONUS', 'AP Spitfire', { bs: 13, skills: ['BS Attack (+1B)'], weapons: ['AP Spitfire'], weaponProfiles: [canonicalBurst('AP Spitfire', 3)] })
const boundaryFailBurst = entry('3', 'LOW BURST', 'Rifle', { bs: 14, weapons: ['Rifle'], weaponProfiles: [canonicalBurst('Rifle', 3)] })
const malformed = entry('4', 'UNKNOWN', 'Unknown', { bs: null, weaponProfiles: [canonicalBurst('HMG', null)] })
const hacker = entry('5', 'HACKER', 'KHD + Pitcher', { hacker: true, equipment: ['Killer Hacking Device', 'Fast-Panda'], weapons: ['Pitcher'] })
const deployable = entry('6', 'OBSERVER', 'Deployable Repeater', { equipment: ['Deployable   Repeater'] })
const falsePositive = entry('7', 'REPEATER PANDA TROOP', 'TinBot', { equipment: ['Repeater', 'TinBot', 'ECM'] })
const aro = entry('8', 'ARO', 'MULTI Sniper', { bs: 13, skills: ['Total Reaction'], weapons: ['MULTI Sniper Rifle'], weaponProfiles: [canonicalBurst('MULTI Sniper Rifle', 2)], fireteamEligibility: { state: 'verified', verified: true, teams: ['Core'] } })
const disposable = entry('cheap', 'CHEAP ARO', 'Flash Pulse', { points: 8, weapons: ['Flash Pulse'], weaponProfiles: [canonicalBurst('Flash Pulse', 1)] })
const alternative = entry('9', 'RAIDER', 'Airborne', { skills: ['Parachutist (Deployment Zone)', 'Combat Jump (+3)', 'Hidden Deployment', 'Impersonation (-6)'], weapons: ['Combi Rifle'] })
const netrod = entry('netrod', 'NETROD', 'Combat Jump', { skills: ['Combat Jump (PH=12)'] })
const imetron = entry('imetron', 'IMETRON', 'Parachutist', { skills: ['Parachutist'] })
const defensive = entry('10', 'SCOUT', 'Minelayer', { skills: ['Camouflage (-3)', 'Decoy (2)', 'Minelayer'], weapons: ['Shock Mines'] })
const mimetismOnly = entry('11', 'NOT CAMO', 'Mimetism', { skills: ['Mimetism (-6)'] })
const separateLoadout = entry('12', 'SCOUT', 'Rifle', { skills: [], weapons: ['Rifle'] })

const analysis = buildTacticalAnalysis([
  decodedList('One', [apex, apex, hacker, aro, disposable, alternative, netrod, imetron, defensive, falsePositive]),
  decodedList('Two', [apex, deployable, aro, defensive, boundaryFailBs, burstBonus]),
  decodedList('Three', [boundaryFailBurst, malformed, mimetismOnly, separateLoadout]),
] as never)

assert.equal(analysis.mode, 'Submitted-List Trends')
assert.equal(analysis.listCount, 3)
assert.equal(analysis.categories.find((item) => item.id === 'apex')?.profiles.length, 1)
assert.equal(analysis.categories.find((item) => item.id === 'apex')?.profiles[0].listCount, 2, 'duplicate models count once per list')
assert.equal(Math.round(analysis.categories.find((item) => item.id === 'apex')!.profiles[0].percentage), 67)
assert.deepEqual(analysis.categories.find((item) => item.id === 'apex')!.profiles[0].badges, ['Mimetism (-3)', 'Multispectral Visor L2', 'BS Attack (-3)'])
assert.equal(analysis.hackerListCount, 1)
assert.equal(analysis.categories.find((item) => item.id === 'hacking')?.profiles.length, 2)
assert.ok(!analysis.categories.find((item) => item.id === 'hacking')?.profiles.some((profile) => profile.unit.includes('PANDA TROOP')), 'names and ordinary Repeaters must not create delivery matches')
assert.equal(analysis.categories.find((item) => item.id === 'competent')?.profiles.length, 3)
assert.equal(analysis.categories.find((item) => item.id === 'competent')?.profiles.find((profile) => profile.unit === 'BONUS')?.weapons[0].effectiveBurst, 4)
assert.equal(analysis.categories.find((item) => item.id === 'valuableAro')?.profiles.length, 1)
assert.equal(analysis.categories.find((item) => item.id === 'valuableAro')?.profiles[0].linkability, 'verified')
assert.equal(analysis.categories.find((item) => item.id === 'disposableAro')?.profiles.length, 1)
assert.equal(analysis.categories.find((item) => item.id === 'alternative')?.profiles.length, 1)
assert.equal(analysis.categories.find((item) => item.id === 'alternative')?.profiles[0].badges.filter((badge) => /Parachutist|Combat Jump|Hidden Deployment|Impersonation/.test(badge)).length, 4)
assert.ok(!analysis.categories.find((item) => item.id === 'alternative')?.profiles.some((profile) => /netrod|imetron/i.test(profile.unit)))
assert.equal(analysis.categories.find((item) => item.id === 'defensive')?.profiles.length, 1)
assert.ok(!analysis.categories.find((item) => item.id === 'defensive')?.profiles.some((profile) => profile.unit === 'NOT CAMO'))
assert.equal(analysis.categories.find((item) => item.id === 'defensive')?.profiles.filter((profile) => profile.unit === 'SCOUT').length, 1, 'capabilities must not leak into a separate loadout')

const observedListName = 'Arbitrary private list label 91f04d'
const observed = buildTacticalAnalysis([decodedList(observedListName, [hacker, defensive])] as never)
assert.equal(observed.mode, 'Observed Capabilities')
assert.equal(observed.perListNetworks.length, 1)
assert.deepEqual(observed.perListNetworks[0], { components: ['Fast-Panda', 'Hacker', 'Killer Hacking Device', 'Pitcher'] })
assert.ok(!JSON.stringify(observed).includes(observedListName), 'player-entered list names must not enter tactical capability presentation data')

const privateListName = 'Don\u2019t hurt me daddy'
const dartok = entry('morat-dartok-fto', 'DARTOK FTO', 'Hacker · Pitcher', {
  bs: 11,
  equipment: [],
  fireteamEligibility: { state: 'verified', verified: true, teams: ['Core'] },
  hacker: true,
  weapons: ['Pitcher'],
})
const morat = buildTacticalAnalysis([decodedList(privateListName, [dartok])] as never)
const dartokProfile = morat.categories.find((item) => item.id === 'hacking')?.profiles[0]
assert.equal(dartokProfile?.unit, 'DARTOK FTO')
assert.equal(dartokProfile?.profile, 'Hacker · Pitcher')
assert.equal(dartokProfile?.bs, 11)
assert.equal(dartokProfile?.linkability, 'verified')
assert.equal(dartokProfile?.listCount, 1)
assert.equal(dartokProfile?.percentage, 100)
assert.deepEqual(morat.perListNetworks, [{ components: ['Hacker', 'Pitcher'] }])
assert.ok(!JSON.stringify(morat).includes(privateListName), 'arbitrary player-entered list names must not appear in capability cards')

const variants = ['FastPanda', 'fast panda', 'FAST-PANDA', 'Deployable-Repeater', 'deployable repeater', 'PITCHER']
for (const [index, value] of variants.entries()) {
  const result = buildTacticalAnalysis([decodedList(`Variant ${index}`, [entry(`v${index}`, 'VARIANT', value, { equipment: [value] })])] as never)
  assert.equal(result.categories.find((item) => item.id === 'hacking')?.profiles.length, 1, `${value} must normalize exactly`)
}

console.log('Army Intelligence tactical analysis passed (classification, boundaries, variants, loadout isolation, prevalence, and sample behavior).')
