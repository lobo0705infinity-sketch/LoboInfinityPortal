import assert from 'node:assert/strict'
import { buildAttackPool, evaluateGunfighterProfile, expectedEffectFromHits, resolveFaceToFace, STANDARD_RANGE_BANDS } from '../bot/gunfighter-rating.mjs'
import { buildGunfighterBenchmarkCatalog, lookupGunfighterRatings, rankArmyGunfighters } from '../bot/gunfighter-benchmark-catalog.mjs'

const ranges = STANDARD_RANGE_BANDS.map((range) => ({ ...range, modifier: range.id === '8-16' ? 3 : range.id === '48-96' ? null : -3 }))
const rifle = (overrides = {}) => ({ name: 'Rifle', modes: [{ name: 'Normal', ammo: 'N', attackType: 'bs', burst: 3, power: 13, save: 'ARM', ranges, ...overrides }] })
const profile = (id, overrides = {}) => ({ id, name: id, bs: 12, ph: 11, arm: 1, bts: 0, vitality: 1, skills: [], equipment: [], fireteamCapable: false, weapons: [rifle()], ...overrides })

const strong = resolveFaceToFace({ burst: 4, specialDice: 0, target: 14, criticalTarget: 14 }, { burst: 1, specialDice: 0, target: 11, criticalTarget: 11 })
assert.ok(strong.activeWin > strong.reactiveWin, 'high-Burst active shooter should outperform a weaker single-die ARO')
const withSd = resolveFaceToFace({ burst: 3, specialDice: 1, target: 12, criticalTarget: 12 }, { burst: 1, specialDice: 0, target: 12, criticalTarget: 12 })
const withoutSd = resolveFaceToFace({ burst: 3, specialDice: 0, target: 12, criticalTarget: 12 }, { burst: 1, specialDice: 0, target: 12, criticalTarget: 12 })
assert.ok(withSd.activeWin > withoutSd.activeWin, '+1SD must improve the active result without changing Burst')

const twoWound = expectedEffectFromHits({ expectedHits: 1, mode: { ammo: 'N', power: 3, save: 'ARM', saves: 1, states: [] }, defender: profile('two', { vitality: 2, arm: 0 }) })
const threeWound = expectedEffectFromHits({ expectedHits: 1, mode: { ammo: 'N', power: 3, save: 'ARM', saves: 1, states: [] }, defender: profile('three', { vitality: 3, arm: 0 }) })
assert.equal(twoWound.damageValue, 0.35, 'one expected wound is fractional value against two Vitality')
assert.ok(Math.abs(threeWound.damageValue - 0.2333333333333333) < 1e-12, 'one expected wound is fractional value against three Vitality')

const isolated = expectedEffectFromHits({ expectedHits: 1, mode: { ammo: 'E/M', power: 1, save: 'BTS', saves: 1, states: ['isolated'], ignoresCover: true }, defender: profile('target', { bts: 0 }) })
assert.ok(isolated.stateValue >= 0.85 && isolated.stateValue <= 0.9, 'Isolated uses the configured 0.9 utility before save probability')
const adhesive = expectedEffectFromHits({ expectedHits: 1, mode: { ammo: 'PARA', power: '-', save: 'PH', saveModifier: -6, saves: 1, states: ['immobilized'], nonLethal: true }, defender: profile('para-target', { ph: 12 }) })
assert.equal(adhesive.damageValue, 0, 'non-lethal ammunition cannot also score physical damage')
assert.ok(adhesive.stateValue > 0 && adhesive.stateValue <= 0.5, 'standalone Immobilized uses its 0.5 utility value')
const combinedStates = expectedEffectFromHits({ expectedHits: 10, mode: { ammo: 'E/M', power: 1, save: 'BTS', saves: 1, states: ['isolated', 'immobilized'], nonLethal: true }, defender: profile('combined-state-target', { bts: 0 }) })
assert.equal(combinedStates.stateValue, 0.9, 'combined Isolated and Immobilized is capped at 0.9')
const warhorseStates = expectedEffectFromHits({ expectedHits: 10, mode: { ammo: 'E/M', power: 1, save: 'BTS', saves: 1, states: ['isolated', 'immobilized'], nonLethal: true }, defender: profile('warhorse-state-target', { bts: 0, skills: ['Warhorse'] }) })
assert.equal(warhorseStates.stateValue, 0.5, 'Warhorse prevents Isolated while retaining standalone Immobilized value')

const shockTarget = profile('nwi', { vitality: 1, skills: ['No Wound Incapacitation'] })
const immuneShockTarget = profile('immune-nwi', { vitality: 1, skills: ['No Wound Incapacitation', 'Immunity (Shock)'] })
const shockMode = { ammo: 'SHOCK', power: 1, save: 'ARM', saves: 1, states: [] }
assert.ok(expectedEffectFromHits({ expectedHits: 1, mode: shockMode, defender: shockTarget }).damageValue > expectedEffectFromHits({ expectedHits: 1, mode: shockMode, defender: immuneShockTarget }).damageValue, 'Shock bypasses NWI only without Immunity (Shock)')

const normalSave = expectedEffectFromHits({ expectedHits: 1, mode: { ammo: 'N', power: 13, save: 'ARM', saves: 1, states: [] }, defender: profile('arm-three', { arm: 3 }) })
const srMinusOne = expectedEffectFromHits({ expectedHits: 1, mode: { ammo: 'N', power: 13, save: 'ARM', saves: 1, states: [], savingRollPenalty: 1 }, defender: profile('arm-three-sr', { arm: 3 }) })
assert.ok(srMinusOne.expectedDamage > normalSave.expectedDamage, 'BS Attack (SR-1) increases the chance that every affected Saving Roll fails')
const apHmgVsArmFive = expectedEffectFromHits({ expectedHits: 1, mode: { ammo: 'AP', power: 5, save: 'ARM', saveDivisor: 2, saves: 1, states: [], savingRollPenalty: 1 }, defender: profile('arm-five', { arm: 5 }) })
assert.equal(apHmgVsArmFive.expectedDamage, 0.5, 'AP HMG PS5 vs ARM5 in Cover with SR-1 fails on 11-20')
assert.equal(adhesive.expectedDamage, 0.7, 'PH12 with a PH-6 Saving Roll fails on 7-20')
assert.equal(adhesive.stateValue, 0.35, 'Immobilized applies its 0.5 value after the PH-6 failure chance')

const aroShooter = profile('aro-shooter')
const aroPool = buildAttackPool(aroShooter, profile('target-aro'), aroShooter.weapons[0], aroShooter.weapons[0].modes[0], 0, 0, { cover: true }, { aro: true })
assert.equal(aroPool.burst, 1, 'ordinary weapon AROs use Burst 1')
const totalReaction = profile('tr', { skills: ['Total Reaction'] })
const totalReactionPool = buildAttackPool(totalReaction, profile('target-tr'), totalReaction.weapons[0], totalReaction.weapons[0].modes[0], 0, 0, { cover: true }, { aro: true })
assert.equal(totalReactionPool.burst, 3, 'Total Reaction retains the weapon full Burst in ARO')
const hostileMinusThree = profile('hostile-minus-three', { skills: ['BS Attack (-3)'] })
const ordinaryVsMinusThree = evaluateGunfighterProfile(profile('ordinary-vs-minus-three'), [hostileMinusThree])
const warhorseVsMinusThree = evaluateGunfighterProfile(profile('warhorse-vs-minus-three', { skills: ['Warhorse'] }), [hostileMinusThree])
assert.ok(warhorseVsMinusThree.states[0].rating > ordinaryVsMinusThree.states[0].rating, 'Warhorse ignores an opponent BS Attack (-X) modifier')
const compositeShock = expectedEffectFromHits({ expectedHits: 1, mode: { ammo: 'AP+Shock', power: 1, save: 'ARM', saveDivisor: 2, saves: 1, states: [] }, defender: shockTarget })
assert.equal(compositeShock.damageValue, expectedEffectFromHits({ expectedHits: 1, mode: { ...shockMode, saveDivisor: 2 }, defender: shockTarget }).damageValue, 'Shock applies when combined with another ammunition effect')
const continuous = expectedEffectFromHits({ expectedHits: 1, mode: { ammo: 'N', power: 13, save: 'ARM', saves: 1, states: [], continuousDamage: true }, defender: profile('continuous-target', { vitality: 3, arm: 3 }) })
assert.ok(continuous.expectedDamage > normalSave.expectedDamage, 'Continuous Damage repeats failed Saving Rolls')

const attacker = profile('attacker', { fireteamCapable: true, equipment: ['X Visor'], weapons: [rifle()] })
const smokeDefender = profile('smoke-defender', { weapons: [rifle(), { name: 'Smoke Grenade', modes: [{ name: 'Smoke', ammo: 'SMOKE', attackType: 'bs', burst: 1, power: 0, save: 'ARM', smoke: true, ranges }] }] })
const normal = evaluateGunfighterProfile(attacker, [smokeDefender])
assert.deepEqual(normal.states.map((state) => state.id), ['normal', 'fireteam'], 'linkable profiles expose only Normal and Fireteam +1SD lines')
assert.equal(normal.states[1].fireteamSpecialDice, 1)
const longRange = normal.states[0].matchups.find((matchup) => matchup.range === '48-96')
assert.equal(longRange.candidates[0].status, 'unavailable', 'every weapon is recorded in every range, including unavailable results')
const expectedAllBandRating = Math.round(normal.states[0].matchups.reduce((sum, matchup) => sum + (matchup.selected?.score ?? 0), 0) / normal.states[0].matchups.length * 100) / 100
assert.equal(normal.states[0].rating, expectedAllBandRating, 'unavailable range bands contribute zero rather than disappearing from the rating')

const msvAttacker = profile('msv', { equipment: ['Multispectral Visor L1'] })
const msvResult = evaluateGunfighterProfile(msvAttacker, [smokeDefender])
for (const matchup of msvResult.states[0].matchups) for (const candidate of matchup.candidates.filter((item) => item.status === 'evaluated')) {
  assert.notEqual(candidate.optimalResponse.aroType, 'smoke', 'ordinary Smoke is excluded against MSV1-3')
}
const smokeOnly = evaluateGunfighterProfile(profile('smoke-only', { weapons: smokeDefender.weapons.slice(1) }), [profile('smoke-target')])
assert.equal(smokeOnly.states[0].rating, 0, 'active Smoke cannot damage or neutralize a benchmark target')

const catalogProfile = { ...attacker, sectorialId: 502, unitId: 10, groupId: 2, optionId: 3, profileId: 1 }
const catalog = buildGunfighterBenchmarkCatalog({ profiles: [catalogProfile], defenders: [smokeDefender], officialDataVersion: '7.test', benchmarkVersion: 'test-v1' })
assert.equal(catalog.entryCount, 1)
assert.match(catalog.fingerprint, /^[a-f0-9]{64}$/)
assert.equal('matchups' in catalog.entries[0].result.states[0], false, 'persisted catalogs contain ratings rather than enormous per-roll diagnostics')
const repeatedCatalog = buildGunfighterBenchmarkCatalog({ profiles: [catalogProfile], defenders: [smokeDefender], officialDataVersion: '7.test', benchmarkVersion: 'test-v1', generatedAt: '2099-01-01T00:00:00.000Z' })
assert.equal(repeatedCatalog.fingerprint, catalog.fingerprint, 'catalog fingerprints are deterministic and exclude generation time')
const lookup = lookupGunfighterRatings(catalog, { sectorialId: 502, combatGroups: [{ members: [{ unitId: 10, groupId: 2, optionId: 3, combinedId: '604-10-2-3-1' }, { unitId: 99, groupId: 1, optionId: 1, combinedId: '604-99-1-1-1' }] }] })
assert.deepEqual(lookup.map((item) => item.status), ['matched', 'missing'], 'submitted lists use exact precomputed profile lookup and fail closed on new profiles')
const ranked = rankArmyGunfighters(catalog, { sectorialId: 502, combatGroups: [{ members: [{ unitId: 10, groupId: 2, optionId: 3, combinedId: '604-10-2-3-1', unitName: 'Attacker' }] }] })
assert.equal(ranked[0].normal, catalog.entries[0].result.states[0].rating)

console.log('PASS - gunfighter engine covers exact dice, all range bands, X Visor, optimal AROs, Fireteam +1SD, durability fractions, state weights, and Shock/NWI immunity.')
