import assert from 'node:assert/strict'
import { evaluateAroProfile, STANDARD_RANGE_BANDS } from '../bot/gunfighter-rating.mjs'
import { buildAroBenchmarkCatalog, rankArmyAros, selectBenchmarkAttackers } from '../bot/aro-benchmark-catalog.mjs'

const ranges = STANDARD_RANGE_BANDS.map((range) => ({ min: range.min, max: range.max, modifier: range.id === '16-24' ? 3 : -3 }))
const weapon = (name = 'Rifle', overrides = {}) => ({ name, modes: [{ name: 'Normal', ammo: 'N', attackType: 'bs', burst: 3, power: 13, save: 'ARM', ranges, ...overrides }] })
const profile = (id, overrides = {}) => ({ id, name: id, bs: 12, ph: 11, arm: 1, bts: 0, vitality: 1, skills: [], equipment: [], fireteamCapable: false, weapons: [weapon()], ...overrides })

const attacker = profile('attacker', { bs: 14, weapons: [weapon('HMG', { burst: 4, power: 15 })] })
const weak = evaluateAroProfile(profile('weak'), [{ profile: attacker, specialDice: 0 }])
const totalReaction = evaluateAroProfile(profile('tr', { skills: ['Total Reaction'], weapons: [weapon('HMG', { burst: 4, power: 15 })] }), [{ profile: attacker, specialDice: 0 }])
assert.ok(totalReaction.states[0].rating > weak.states[0].rating, 'Total Reaction must improve the ARO rating through full reactive Burst')

const linkable = evaluateAroProfile(profile('linkable', { fireteamCapable: true }), [{ profile: attacker, specialDice: 0 }])
assert.deepEqual(linkable.states.map((state) => state.id), ['normal', 'fireteam'])
assert.ok(linkable.states[1].rating > linkable.states[0].rating, 'legal linked +1SD must improve the reactive state')

const smoke = evaluateAroProfile(profile('smoke', { weapons: [{ name: 'Smoke Grenade', modes: [{ name: 'Smoke', ammo: 'SMOKE', attackType: 'bs', burst: 1, power: 0, save: 'ARM', smoke: true, ranges }] }] }), [{ profile: attacker, specialDice: 0 }])
assert.equal(smoke.states[0].rating, 0, 'Smoke may be the safest ARO but cannot score as damaging or neutralizing the attacker')
const mine = evaluateAroProfile(profile('mine', { weapons: [weapon('E/M Mine', { attackType: 'direct-template', deployable: true, nonLethal: true, states: ['isolated'] })] }), [{ profile: attacker, specialDice: 0 }])
assert.equal(mine.states[0].rating, 0, 'a Deployable Mine cannot be selected as the model’s direct ARO')

const disposable = evaluateAroProfile(profile('panzerfaust', { weapons: [weapon('Panzerfaust', { burst: 1, power: 14, ammo: 'AP+EXP', saves: 3, disposableUses: 2 })] }), [{ profile: attacker, specialDice: 0 }])
const unlimited = evaluateAroProfile(profile('unlimited', { weapons: [weapon('Launcher', { burst: 1, power: 14, ammo: 'AP+EXP', saves: 3 })] }), [{ profile: attacker, specialDice: 0 }])
assert.ok(disposable.states[0].rating < unlimited.states[0].rating, 'Disposable uses must discount otherwise identical ARO performance')

const profiles = Array.from({ length: 30 }, (_, index) => ({ ...profile(`p${index}`, { weapons: [weapon(`Rifle ${index}`)] }), id: `502:${index + 1}:1:1:1`, sectorialId: 502, unitId: index + 1, groupId: 1, optionId: 1, profileId: 1, bs: 12 + (index % 3) }))
const gunfighterCatalog = { entries: profiles.map((item, index) => ({ key: item.id, result: { states: [{ id: 'normal', fireteamSpecialDice: 0, rating: 100 - index }] } })) }
const attackers = selectBenchmarkAttackers(profiles, gunfighterCatalog)
assert.equal(attackers.length, 30)
const reactiveVariant = { ...profiles[0], id: '503:1:1:1:1', sectorialId: 503, skills: ['Total Reaction'] }
const dedupedAttackers = selectBenchmarkAttackers(
  [profiles[0], reactiveVariant, ...profiles.slice(1)],
  { entries: [
    gunfighterCatalog.entries[0],
    { key: reactiveVariant.id, result: { states: [{ id: 'normal', fireteamSpecialDice: 0, rating: 99.5 }] } },
    ...gunfighterCatalog.entries.slice(1),
  ] },
)
assert.equal(dedupedAttackers.length, 30)
assert.equal(dedupedAttackers.filter((item) => item.profile.unitId === profiles[0].unitId).length, 1, 'reactive-only skill variants must not consume multiple active-attacker slots')
const catalog = buildAroBenchmarkCatalog({ profiles: [profiles[0]], attackers, officialDataVersion: 'test' })
assert.equal(catalog.entryCount, 1)
assert.equal(catalog.benchmarkAttackers.length, 30)
const ranked = rankArmyAros(catalog, { sectorialId: 502, combatGroups: [{ members: [{ unitId: 1, groupId: 1, optionId: 1, combinedId: '502-1-1-1-1' }] }] })
assert.equal(ranked[0].status, 'matched')
assert.equal(ranked[0].normal, catalog.entries[0].result.states[0].rating)

const sharedProfiles = [
  { ...profiles[0], id: '502:101:1:1:1', unitId: 101, bs: 11, fireteamCapable: true },
  { ...profiles[1], id: '502:102:1:1:1', unitId: 102, bs: 13, fireteamCapable: false },
  { ...profiles[2], id: '502:103:1:1:1', unitId: 103, bs: 15, fireteamCapable: true, weapons: [weapon('Feuerbach', { burst: 2, power: 14, ammo: 'AP+DA', saves: 2 })] },
]
const sharedCatalog = buildAroBenchmarkCatalog({ profiles: sharedProfiles, attackers, officialDataVersion: 'test-shared' })
const sharedStates = sharedCatalog.entries.flatMap((entry) => entry.result.states).sort((a, b) => a.rating - b.rating)
for (let index = 1; index < sharedStates.length; index += 1) {
  assert.ok(sharedStates[index].percentile >= sharedStates[index - 1].percentile, 'shared ARO grading must never assign a lower percentile to a higher raw rating')
  const grades = ['F', 'D', 'C', 'B', 'A', 'S']
  assert.ok(grades.indexOf(sharedStates[index].grade) >= grades.indexOf(sharedStates[index - 1].grade), 'shared ARO grading must never assign a worse grade to a higher raw rating')
}

console.log('PASS - ARO benchmark uses the top 30 attackers, optimal legal responses, linked +1SD, shared-state monotonic grading, meaningful enemy effect, and disposable-use limits.')
