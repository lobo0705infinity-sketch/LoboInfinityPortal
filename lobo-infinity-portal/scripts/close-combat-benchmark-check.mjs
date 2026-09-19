import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildCloseCombatPool, evaluateCloseCombatExchange, evaluateCloseCombatProfile, resolveOpposedPools } from '../bot/close-combat-benchmark.mjs'
import { buildStandardCloseCombatDefenders } from '../bot/close-combat-standard-benchmark.mjs'

const weapon = (name = 'CC Weapon', power = 7, options = {}) => ({ name, power, burst: 1, ammo: 'N', save: 'ARM', savingRolls: 1, opponentMod: 0, states: [], ...options })
const fighter = (id, options = {}) => ({ id, name: id, cc: 20, ph: 12, arm: 2, bts: 3, vitality: 1, skills: [], weapons: [weapon()], ...options })
const plain = fighter('plain')
const target = fighter('target', { cc: 18 })
const calculatorValidation = JSON.parse(await readFile(new URL('../data/infinity-army/close-combat-calculator-validation.json', import.meta.url), 'utf8'))
for (const validation of calculatorValidation.cases) for (const side of ['activeExpectedWounds', 'reactiveExpectedWounds']) {
  if (validation.calculator[side] == null) continue
  assert.ok(Math.abs(validation.calculator[side] - validation.engine[side]) <= 0.01, `${validation.id} ${side} must remain within 0.01 of Infinity the Calculator`)
}

const ma = [1, 2, 3, 4, 5].map((level) => buildCloseCombatPool(fighter(`ma${level}`, { skills: [`Martial Arts L${level}`] }), target, weapon(), { id: 'normal', type: 'face-to-face' }, { active: true }))
assert.deepEqual(ma.map((pool) => [pool.successValue, pool.burst, pool.specialDice, pool.imposedOpponentMod]), [
  [20, 1, 0, -3], [23, 1, 0, -3], [23, 1, 1, -3], [23, 2, 0, -3], [23, 2, 1, -3],
])

const penalizer = fighter('penalizer', { skills: ['Martial Arts L3', 'CC Attack (-3)', 'Surprise Attack (-3)'], weapons: [weapon('PARA CC Weapon (-3)', 0, { save: 'PH', saveModifier: -6, nonLethal: true, opponentMod: -3 })] })
const nbw = fighter('nbw', { cc: 19, skills: ['Natural Born Warrior'] })
const nbwPool = buildCloseCombatPool(nbw, penalizer, weapon(), { id: 'normal', type: 'face-to-face' }, { active: false, opponentWeapon: penalizer.weapons[0] })
assert.equal(nbwPool.successValue, 19, 'Natural Born Warrior ignores all opposing negative CC MODs when its requirements are met')
const ordinaryPool = buildCloseCombatPool(plain, penalizer, weapon(), { id: 'normal', type: 'face-to-face' }, { active: false, opponentWeapon: penalizer.weapons[0] })
assert.equal(ordinaryPool.successValue, 11, 'Martial Arts, CC Attack, and PARA weapon MODs stack to the -12 cap')

const surprise = fighter('surprise', { skills: ['Surprise Attack (-3)'] })
const surprisedPool = buildCloseCombatPool(target, surprise, weapon(), { id: 'reactive', type: 'face-to-face' }, { active: false })
assert.equal(surprisedPool.successValue, 18, 'Surprise is not silently active outside the Surprise state')
const surpriseAttack = buildCloseCombatPool(surprise, target, weapon(), { id: 'surprise', type: 'face-to-face' }, { active: true })
assert.equal(surpriseAttack.imposedOpponentMod, -3)
const surpriseVictim = buildCloseCombatPool(target, surprise, weapon(), { id: 'reactive', type: 'face-to-face' }, { active: false, opponentWeapon: surprise.weapons[0], opponentState: { id: 'surprise' } })
assert.equal(surpriseVictim.successValue, 15, 'Surprise Attack applies to the opposing CC roll only in the Surprise state')

const cc23 = buildCloseCombatPool(fighter('cc23', { cc: 23 }), target, weapon(), { id: 'normal', type: 'face-to-face' }, { active: true })
const cc10 = buildCloseCombatPool(fighter('cc10', { cc: 10 }), target, weapon(), { id: 'normal', type: 'face-to-face' }, { active: false })
const overTwenty = resolveOpposedPools(cc23, cc10)
assert.ok(overTwenty.summary.activeWin > 70, 'CC above 20 receives its expanded critical range')

const plusBurst = fighter('plus-burst', { skills: ['CC Attack (+1B)'] })
assert.equal(buildCloseCombatPool(plusBurst, target, weapon(), { id: 'ally', type: 'face-to-face', alliedBurst: 2 }, { active: true }).burst, 4)
const plusNine = fighter('plus-nine', { cc: 14, skills: ['CC Attack (+9)'] })
assert.equal(buildCloseCombatPool(plusNine, target, weapon(), { id: 'normal', type: 'face-to-face' }, { active: true }).successValue, 23)
const improvised = weapon('D-Charges', 6, { attackMod: -6, ammo: 'AP+EXP', savingRolls: 3 })
assert.equal(buildCloseCombatPool(plain, target, improvised, { id: 'normal', type: 'face-to-face' }, { active: true }).successValue, 14, 'Improvised penalizes the weapon user rather than the opponent')

const fixedPsLowPh = fighter('fixed-ps-low-ph', { ph: 8, weapons: [weapon('DA CC Weapon (PS 7)', 7, { ammo: 'DA', savingRolls: 2 })] })
const fixedPsHighPh = fighter('fixed-ps-high-ph', { ph: 18, weapons: [weapon('DA CC Weapon (PS 7)', 7, { ammo: 'DA', savingRolls: 2 })] })
const low = evaluateCloseCombatExchange({ attacker: fixedPsLowPh, defender: target, weapon: fixedPsLowPh.weapons[0], defenderWeapon: target.weapons[0] })
const high = evaluateCloseCombatExchange({ attacker: fixedPsHighPh, defender: target, weapon: fixedPsHighPh.weapons[0], defenderWeapon: target.weapons[0] })
assert.equal(low.score, high.score, 'CC weapon PS must never be inferred from PH')
const continuous = fighter('continuous', { weapons: [weapon('Continuous CC Weapon', 7, { continuousDamage: true })] })
const continuousResult = evaluateCloseCombatExchange({ attacker: continuous, defender: target, weapon: continuous.weapons[0], defenderWeapon: target.weapons[0] })
assert.ok(continuousResult.effect.expectedWounds > low.effect.expectedWounds, 'Continuous Damage repeats failed Saving Rolls')

const protheion = fighter('protheion', { cc: 24, skills: ['Martial Arts L4', 'Protheion'], weapons: [weapon('EXP CC Weapon (PS 6)', 6, { ammo: 'EXP', savingRolls: 3 })] })
const fragile = fighter('fragile', { cc: 10, arm: 0, vitality: 1 })
const feeding = evaluateCloseCombatExchange({ attacker: protheion, defender: fragile, weapon: protheion.weapons[0], defenderWeapon: fragile.weapons[0] })
assert.ok(feeding.protheion.expectedPowerUp <= 1, 'Protheion cannot gain from excess failed saves after a one-VITA target reaches Dead')

const berserker = fighter('berserker', { skills: ['Berserk (+3)'] })
const states = evaluateCloseCombatProfile(berserker, buildStandardCloseCombatDefenders()).states
assert.ok(states.some((state) => state.id === 'berserk'))
assert.ok(states.some((state) => state.id === 'reactive'))
assert.notEqual(states.find((state) => state.id === 'berserk').rating, states.find((state) => state.id === 'normal').rating, 'Berserk is evaluated separately from normal CC')
const protheionStates = evaluateCloseCombatProfile(protheion, buildStandardCloseCombatDefenders()).states
assert.deepEqual(protheionStates.filter((state) => /^protheion-/.test(state.id)).map((state) => state.id), ['protheion-1', 'protheion-2'])

console.log('PASS - close-combat benchmark covers MA1-5, NBW, CC MOD stacking/cap, Surprise, Berserk, +B/+SD, allied Burst, fixed weapon PS, over-20 criticals, weapon effects, and capped Protheion.')
