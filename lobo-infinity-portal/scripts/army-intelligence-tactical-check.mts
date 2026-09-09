import assert from 'node:assert/strict'
import { buildTacticalAnalysis } from '../src/services/armyIntelligenceTacticalAnalysis.ts'

const entry = (combinedId: string, unit: string, profile: string, fields: Record<string, unknown> = {}) => ({
  combatGroup: 1, chainOfCommand: false, combinedId, cc: 10, doctor: false, engineer: false,
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
const bs14Apex = entry('bs14', 'MAXIMUS', 'AP HMG', { bs: 14, weapons: ['AP HMG'], weaponProfiles: [canonicalBurst('AP HMG', 4)] })
const b5Apex = entry('b5', 'LOW BS B5', 'B5', { bs: 10, weapons: ['B5 Gun'], weaponProfiles: [canonicalBurst('B5 Gun', 5)] })
const boundaryFailBs = entry('2', 'LOW BS', 'HMG', { bs: 12, weapons: ['HMG'], weaponProfiles: [canonicalBurst('HMG', 4)] })
const burstBonus = entry('bonus', 'BONUS', 'AP Spitfire', { bs: 13, skills: ['BS Attack (+1B)'], weapons: ['AP Spitfire'], weaponProfiles: [canonicalBurst('AP Spitfire', 3)] })
const boundaryFailBurst = entry('3', 'LOW BURST', 'Rifle', { bs: 14, weapons: ['Rifle'], weaponProfiles: [canonicalBurst('Rifle', 3)] })
const malformed = entry('4', 'UNKNOWN', 'Unknown', { bs: null, weaponProfiles: [canonicalBurst('HMG', null)] })
const hacker = entry('5', 'HACKER', 'KHD + Pitcher', { hacker: true, equipment: ['Killer Hacking Device', 'Fast-Panda'], weapons: ['Pitcher'] })
const deployable = entry('6', 'OBSERVER', 'Deployable Repeater', { equipment: ['Deployable   Repeater'] })
const falsePositive = entry('7', 'REPEATER PANDA TROOP', 'TinBot', { equipment: ['Repeater', 'TinBot', 'ECM'] })
const aro = entry('8', 'ARO', 'MULTI Sniper', { bs: 13, skills: ['BS Attack (+1SD)'], weapons: ['MULTI Sniper Rifle'], weaponProfiles: [canonicalBurst('MULTI Sniper Rifle', 2)], fireteamEligibility: { state: 'verified', verified: true, teams: ['Core'] } })
const tankhunter = entry('tankhunter', 'TANKHUNTER', 'Portable Autocannon', { bs: 13, points: 36, weapons: ['Portable Autocannon'], weaponProfiles: [{ ...canonicalBurst('Portable Autocannon', 2), modifiers: ['+1SD'] }] })
const disposable = entry('cheap', 'CHEAP ARO', 'Flash Pulse', { points: 8, weapons: ['Flash Pulse'], weaponProfiles: [canonicalBurst('Flash Pulse', 1)] })
const pherowareProfile = entry('pheroware', 'PHA', 'Pheroware', { equipment: ['Pheroware Tactics'], skills: ['Total Reaction'] })
const ptProfile = entry('pt', 'PT USER', 'Pheroware', { equipment: ['PT'], skills: ['Neurocinetics'] })
const sdWeaponProfile = entry('sd-weapon', 'SD', 'Combi Rifle', { points: 30, weapons: ['Combi Rifle'], weaponProfiles: [{ ...canonicalBurst('Combi Rifle', 3), modifiers: ['+2SD'] }] })
const visionProfile = entry('vision', 'VISION', 'Control', { weapons: ['Smoke Grenade Launcher', 'Discoballer'], equipment: ['Pheroware Mirrorball'], skills: ['Eclipse'] })
const apexCcProfile = entry('apex-cc', 'DUELIST', 'Blade', { cc: 22, skills: ['Martial Arts L1'] })
const ccNearMiss = entry('cc-near', 'ALMOST', 'Blade', { cc: 21, skills: ['Natural Born Warrior'] })
const alternative = entry('9', 'RAIDER', 'Airborne', { skills: ['Parachutist (Deployment Zone)', 'Combat Jump (+3)', 'Hidden Deployment', 'Impersonation (-6)'], weapons: ['Combi Rifle'] })
const netrod = entry('netrod', 'NETROD', 'Combat Jump', { skills: ['Combat Jump (PH=12)'] })
const imetron = entry('imetron', 'IMETRON', 'Parachutist', { skills: ['Parachutist'] })
const defensive = entry('10', 'SCOUT', 'Minelayer', { skills: ['Camouflage (-3)', 'Decoy (2)', 'Minelayer'], weapons: ['Shock Mines'] })
const mimetismOnly = entry('11', 'NOT CAMO', 'Mimetism', { skills: ['Mimetism (-6)'] })
const separateLoadout = entry('12', 'SCOUT', 'Rifle', { skills: [], weapons: ['Rifle'] })

const analysis = buildTacticalAnalysis([
  decodedList('One', [apex, apex, bs14Apex, b5Apex, hacker, aro, tankhunter, disposable, alternative, netrod, imetron, defensive, falsePositive]),
  decodedList('Two', [apex, deployable, aro, defensive, boundaryFailBs, burstBonus, { ...hacker, combinedId: 'legacy-hacker', bs: null, fireteamEligibility: { state: 'unknown', verified: false, teams: [] } }]),
  decodedList('Three', [boundaryFailBurst, malformed, mimetismOnly, separateLoadout, pherowareProfile, ptProfile, sdWeaponProfile, visionProfile, apexCcProfile, ccNearMiss]),
] as never)

assert.equal(analysis.mode, 'Submitted-List Trends')
assert.equal(analysis.listCount, 3)
assert.equal(analysis.categories.find((item) => item.id === 'apex')?.profiles.length, 4)
assert.equal(analysis.categories.find((item) => item.id === 'valuableAro')?.profiles.some((profile) => profile.unit === 'PHA'), true)
assert.equal(analysis.categories.find((item) => item.id === 'valuableAro')?.profiles.some((profile) => profile.unit === 'PT USER'), true)
assert.equal(analysis.categories.find((item) => item.id === 'disposableAro')?.profiles.some((profile) => profile.unit === 'SD'), true)
assert.equal(analysis.categories.find((item) => item.id === 'vision')?.profiles.length, 1)
assert.equal(analysis.categories.find((item) => item.id === 'apexCc')?.profiles.some((profile) => profile.unit === 'DUELIST'), true)
assert.equal(analysis.categories.find((item) => item.id === 'apexCc')?.profiles.some((profile) => profile.unit === 'ALMOST'), false)
assert.equal(analysis.categories.find((item) => item.id === 'apex')?.profiles[0].listCount, 2, 'duplicate models count once per list')
assert.equal(Math.round(analysis.categories.find((item) => item.id === 'apex')!.profiles[0].percentage), 67)
assert.deepEqual(analysis.categories.find((item) => item.id === 'apex')!.profiles[0].badges, ['Mimetism (-3)', 'Multispectral Visor L2', 'BS Attack (-3)'])
assert.equal(analysis.hackerListCount, 2)
assert.equal(analysis.categories.find((item) => item.id === 'hacking')?.profiles.length, 3)
assert.equal(analysis.categories.find((item) => item.id === 'hacking')?.profiles.find((profile) => profile.unit === 'HACKER')?.listCount, 2, 'duplicate displayed profiles must consolidate and count unique lists')
assert.ok(analysis.categories.find((item) => item.id === 'hacking')?.profiles.some((profile) => profile.unit.includes('PANDA TROOP')), 'ordinary Repeaters must create hacking-network matches')
assert.equal(analysis.categories.find((item) => item.id === 'competent')?.profiles.length, 2)
assert.equal(analysis.categories.find((item) => item.id === 'competent')?.profiles.find((profile) => profile.unit === 'BONUS')?.weapons[0].effectiveBurst, 4)
assert.equal(analysis.categories.find((item) => item.id === 'valuableAro')?.profiles.length, 4)
assert.equal(analysis.categories.find((item) => item.id === 'valuableAro')?.profiles[0].linkability, 'verified')
assert.deepEqual(analysis.categories.find((item) => item.id === 'valuableAro')?.profiles.find((profile) => profile.unit === 'TANKHUNTER')?.badges, ['Portable Autocannon (+1SD)'])
assert.ok(!analysis.categories.find((item) => item.id === 'competent')?.profiles.some((profile) => profile.unit === 'TANKHUNTER'), 'B2 +1SD is only three dice')
assert.equal(analysis.categories.find((item) => item.id === 'disposableAro')?.profiles.length, 3)
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

const fireteam = { state: 'verified', verified: true, teams: ['Orcs'] }
const fireteamAnalysis = buildTacticalAnalysis([decodedList('Fireteam', [
  entry('orc', 'ORC', 'Feuerbach', { bs: 14, points: 35, weapons: ['Feuerbach'], weaponProfiles: [canonicalBurst('Feuerbach', 2)], fireteamEligibility: fireteam }),
  entry('hannibal', 'HANNIBAL', 'Marksman', { bs: 13, points: 33, skills: ['BS Attack (+1SD)'], weapons: ['MULTI Marksman Rifle'], weaponProfiles: [canonicalBurst('MULTI Marksman Rifle', 3)], fireteamEligibility: fireteam }),
  entry('moran', 'MORAN', 'Repeater Minelayer', { equipment: ['Repeater'], skills: ['Minelayer'] }),
])] as never)
assert.ok(!fireteamAnalysis.categories.find((item) => item.id === 'valuableAro')?.profiles.some((profile) => profile.unit === 'ORC'), 'Fireteam +1SD alone must not qualify Valuable ARO')
assert.ok(fireteamAnalysis.categories.find((item) => item.id === 'apex')?.profiles.some((profile) => profile.unit === 'HANNIBAL'))
assert.deepEqual(fireteamAnalysis.categories.find((item) => item.id === 'hacking')?.profiles.find((profile) => profile.unit === 'MORAN')?.roles, ['hacking', 'defensive'])

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

const duplicateLoadouts = buildTacticalAnalysis([decodedList('Duplicate loadouts', [
  entry('apsara-a', 'APSARA', 'APSARA', { bs: 13, points: 22, skills: ['Hacker'], equipment: ['Deployable Repeater'], weapons: ['Submachine Gun'], weaponProfiles: [canonicalBurst('Submachine Gun', 3)] }),
  entry('apsara-b', 'APSARA', 'APSARA', { bs: 13, points: 22, skills: ['Hacker', 'Courage'], equipment: ['Deployable Repeater', 'TinBot'], weapons: ['Submachine Gun'], weaponProfiles: [canonicalBurst('Submachine Gun', 3)] }),
  entry('yadu-hmg', 'YADU', 'YADU', { bs: 13, points: 40, weapons: ['Heavy Machine Gun'], weaponProfiles: [canonicalBurst('Heavy Machine Gun', 4)] }),
  entry('yadu-smg', 'YADU', 'YADU', { bs: 13, points: 32, skills: ['BS Attack (+1SD)'], weapons: ['Submachine Gun'], weaponProfiles: [canonicalBurst('Submachine Gun', 3)] }),
  entry('yadu-combi', 'YADU', 'YADU', { bs: 13, points: 34, skills: ['BS Attack (+1SD)'], weapons: ['Combi Rifle'], weaponProfiles: [canonicalBurst('Combi Rifle', 3)] }),
])] as never)
const duplicateHackingProfiles = duplicateLoadouts.categories.find((item) => item.id === 'hacking')?.profiles || []
assert.equal(duplicateHackingProfiles.filter((profile) => profile.unit === 'APSARA').length, 1, 'identical visible APSARA loadouts must consolidate despite hidden skill/equipment differences')
assert.equal(duplicateHackingProfiles.find((profile) => profile.unit === 'APSARA')?.profile, 'Submachine Gun')
const yaduProfiles = duplicateLoadouts.categories.flatMap((category) => category.profiles).filter((profile) => profile.unit === 'YADU')
assert.deepEqual([...new Set(yaduProfiles.map((profile) => profile.profile))].sort(), ['Combi Rifle', 'Heavy Machine Gun', 'Submachine Gun'], 'distinct YADU loadouts must remain separate and receive weapon labels')

const lamedhLists = Array.from({ length: 10 }, (_, index) => decodedList(`LAMEDH ${index}`, [
  entry(`lamedh-${index}`, 'LAMEDH Robot', index === 0 ? 'LAMEDH Robot' : 'Flash Pulse', {
    bs: 8,
    canonicalUnitId: 4242,
    canonicalOptionId: 1,
    canonicalProfile: 'LAMEDH Robot',
    equipment: ['Repeater'],
    points: 7,
    skills: ['Mimetism (-3)'],
    weapons: index === 0 ? [] : ['Flash Pulse'],
    weaponProfiles: index === 0 ? [] : [canonicalBurst('Flash Pulse', 1)],
  }),
]))
const lamedhAnalysis = buildTacticalAnalysis(lamedhLists as never)
const lamedhProfiles = lamedhAnalysis.categories.find((item) => item.id === 'hacking')?.profiles.filter((profile) => profile.unit === 'LAMEDH Robot') || []
assert.equal(lamedhProfiles.length, 1, 'one canonical LAMEDH profile must render once even when legacy and enriched labels differ')
assert.equal(lamedhProfiles[0].listCount, 10, 'one LAMEDH row must aggregate all ten unique submitted lists')
assert.equal(lamedhProfiles[0].percentage, 100)

console.log('Army Intelligence tactical analysis passed (classification, boundaries, variants, loadout isolation, prevalence, and sample behavior).')
