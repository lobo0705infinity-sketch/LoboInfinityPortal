import assert from 'node:assert/strict'
import { buildCanonicalGunfighterProfiles } from '../bot/gunfighter-profile-canonicalizer.mjs'
import { normalizeWeaponChartRows } from '../bot/infinity-weapon-chart.mjs'

const dataset = {
  metadata: {
    skills: [{ id: 1, name: 'BS Attack' }],
    equips: [{ id: 2, name: 'X Visor' }],
    extras: [{ id: 10, name: '+1SD' }, { id: 11, name: 'SR-1' }],
  },
  units: [{ id: 99, name: 'Test Gunfighter', profileGroups: [{ id: 7, profiles: [{ id: 2, bs: 13, ph: 11, arm: 3, bts: 6, w: 1, skills: [{ id: 1, extra: [11] }], equip: [{ id: 2 }] }], options: [{ id: 4, name: 'AP HMG', weapons: [{ id: 3, extra: [10] }] }] }] }],
}
const chart = normalizeWeaponChartRows([{ id: 3, name: 'AP HMG', ranges: [{ min: 0, max: 16, modifier: 0 }, { min: 16, max: 32, modifier: 3 }], damage: 5, burst: 4, ammo: 'AP', saving: 'ARM/2', savingRolls: 1 }])
const [profile] = buildCanonicalGunfighterProfiles({ dataset, weaponChart: chart, wildcardUnitIds: [99] })
assert.equal(profile.fireteamCapable, true)
assert.equal(profile.equipment[0], 'X Visor')
assert.equal(profile.skills[0], 'BS Attack SR-1')
assert.equal(profile.weapons[0].modes[0].specialDice, 1)
assert.equal(profile.weapons[0].modes[0].saveDivisor, 2)
assert.equal(profile.profileId, 2)

const ftoDataset = structuredClone(dataset)
ftoDataset.units[0].profileGroups[0].options = [{ id: 4, name: 'TEST FTO', weapons: [{ id: 3 }] }, { id: 5, name: 'TEST', weapons: [{ id: 3 }] }]
const ftoProfiles = buildCanonicalGunfighterProfiles({ dataset: ftoDataset, weaponChart: chart, fireteamProfiles: [{ unitId: 99, memberName: 'TEST FTO', wildcard: false }] })
assert.equal(ftoProfiles.find((item) => item.optionId === 4).fireteamCapable, true)
assert.equal(ftoProfiles.find((item) => item.optionId === 5).fireteamCapable, false, 'FTO eligibility must not leak to a non-FTO sibling')
console.log('PASS - exact Army profiles join to official weapon-chart records and preserve profile/weapon modifiers.')
