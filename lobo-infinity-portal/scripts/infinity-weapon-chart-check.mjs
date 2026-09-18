import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { normalizeWeaponChartRow, weaponChartRecordToGunfighterWeapon } from '../bot/infinity-weapon-chart.mjs'

const extractorSource = await readFile(new URL('../bot/infinity-weapon-chart.mjs', import.meta.url), 'utf8')
assert.match(extractorSource, /nameCell\?\.textContent/, 'hidden weapon rows must be read with textContent')
assert.doesNotMatch(extractorSource, /\.innerText/, 'innerText drops hidden Army weapon rows')

const apHmg = normalizeWeaponChartRow({
  id: 3,
  name: 'AP Heavy Machine Gun',
  ranges: [
    { min: 0, max: 8, modifier: -3 },
    { min: 8, max: 16, modifier: 0 },
    { min: 16, max: 32, modifier: 3 },
    { min: 32, max: 48, modifier: -3 },
  ],
  damage: '5', burst: '4', ammo: 'AP', saving: 'ARM/2', savingRolls: '1', traits: ['Suppressive Fire'],
})
assert.equal(apHmg.damage, 5)
assert.equal(apHmg.save, 'ARM')
assert.equal(apHmg.saveDivisor, 2)
assert.equal(apHmg.savingRolls, 1)
assert.deepEqual(apHmg.ranges.at(-1), { min: 32, max: 48, modifier: -3 })

const blitzen = normalizeWeaponChartRow({ name: 'Blitzen', damage: 6, burst: 1, ammo: 'E/M', saving: 'BTS/2', savingRolls: 2, traits: ['Non-lethal'] })
assert.equal(blitzen.nonLethal, true)
assert.equal(blitzen.state, 'isolated')
assert.equal(weaponChartRecordToGunfighterWeapon(blitzen).modes[0].saves, 2)

const riotstopper = normalizeWeaponChartRow({ name: 'Heavy Riotstopper', damage: 7, burst: 1, ammo: 'PARA', saving: 'PH-6', traits: ['Direct Template (Large Teardrop)', 'Non-lethal'] })
assert.equal(riotstopper.attackType, 'direct-template')
assert.equal(riotstopper.save, 'PH')
assert.equal(riotstopper.saveModifier, -6)
assert.equal(riotstopper.state, 'immobilized')

const exp = normalizeWeaponChartRow({ name: 'Missile Launcher', ammo: 'EXP', saving: 'ARM' })
assert.equal(exp.savingRolls, 3)

const flashPulse = normalizeWeaponChartRow({ name: 'Flash Pulse', damage: 13, burst: 1, ammo: 'Stun', saving: 'BTS', traits: ['Technical Weapon', 'Non-lethal'] })
assert.equal(flashPulse.attackAttribute, 'wip')
const smoke = normalizeWeaponChartRow({ name: 'Smoke Grenades', damage: '-', burst: 1, ammo: 'Smoke', saving: '-', traits: ['Targetless'] })
assert.equal(smoke.attackAttribute, 'ph')

console.log('PASS - official weapon chart fields normalize into gunfighter-ready records.')
