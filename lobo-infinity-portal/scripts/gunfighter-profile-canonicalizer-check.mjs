import assert from 'node:assert/strict'
import { buildCanonicalGunfighterProfiles } from '../bot/gunfighter-profile-canonicalizer.mjs'
import { normalizeWeaponChartRows } from '../bot/infinity-weapon-chart.mjs'

const dataset = {
  metadata: {
    skills: [{ id: 1, name: 'BS Attack' }],
    equips: [{ id: 2, name: 'X Visor' }],
    extras: [{ id: 10, name: '+1SD' }, { id: 11, name: 'SR-1' }],
    weapons: [{ id: 3, name: 'AP HMG' }, { id: 8, name: 'Pitcher' }],
  },
  units: [{ id: 99, name: 'Test Gunfighter', profileGroups: [{ id: 7, profiles: [{ id: 2, bs: 13, ph: 11, arm: 3, bts: 6, w: 1, skills: [{ id: 1, extra: [11] }], equip: [{ id: 2 }] }], options: [{ id: 4, name: 'AP HMG', weapons: [{ id: 3, extra: [10] }, { id: 8 }] }] }] }],
}
const chart = normalizeWeaponChartRows([
  { id: 3, name: 'AP HMG', ranges: [{ min: 0, max: 16, modifier: 0 }, { min: 16, max: 32, modifier: 3 }], damage: 5, burst: 4, ammo: 'AP', saving: 'ARM/2', savingRolls: 1 },
  { id: 8, name: 'Pitcher', ranges: [{ min: 0, max: 8, modifier: 0 }], damage: '-', burst: 1, ammo: '', saving: '-', savingRolls: '-' },
  { id: 5, name: 'Heavy Flamethrower', damage: 6, burst: 1, ammo: 'N', saving: 'ARM', savingRolls: 1, traits: ['Continous Damage', 'Direct Template (Large Teardrop)'] },
])
const [profile] = buildCanonicalGunfighterProfiles({ dataset, weaponChart: chart, sectorialId: 502, wildcardUnitIds: [99] })
assert.equal(profile.fireteamCapable, true)
assert.equal(profile.equipment[0], 'X Visor')
assert.equal(profile.skills[0], 'BS Attack SR-1')
assert.equal(profile.weapons[0].modes[0].specialDice, 1)
assert.equal(profile.weapons[0].modes[0].saveDivisor, 2)
assert.equal(profile.weapons.some((weapon) => weapon.name === 'Pitcher'), false, 'utility launchers without a target resolution must be excluded')
assert.equal(profile.profileId, 2)

const [ttsProfile] = buildCanonicalGunfighterProfiles({
  dataset,
  weaponChart: chart,
  sectorialId: 502,
  ttsProfiles: [{ id: '502:99:7:4:2', bs: 14, ph: 16, arm: 6, bts: 6, vitality: null, structure: 4, skills: ['BS Attack(-3)', 'BS Attack(SR-1)'], equipment: [], weapons: [{ name: 'AP HMG', modifiers: [] }, { name: 'Heavy Flamethrower', modifiers: ['+1B'] }] }],
})
assert.equal(ttsProfile.bs, 13, 'Official stats cannot be overwritten by stale TTS data')
assert.equal(ttsProfile.vitality, 1)
assert.equal(ttsProfile.structure, null)
const ttsFlamethrower = ttsProfile.weapons.find((weapon) => weapon.name === 'Heavy Flamethrower')
assert.equal(ttsFlamethrower, undefined, 'TTS may not add weapons absent from this official selection')

const ftoDataset = structuredClone(dataset)
ftoDataset.units[0].profileGroups[0].options = [{ id: 4, name: 'TEST FTO', weapons: [{ id: 3 }] }, { id: 5, name: 'TEST', weapons: [{ id: 3 }] }]
const ftoProfiles = buildCanonicalGunfighterProfiles({ dataset: ftoDataset, weaponChart: chart, sectorialId: 502, fireteamProfiles: [{ unitId: 99, memberName: 'TEST FTO', wildcard: false }] })
assert.equal(ftoProfiles.find((item) => item.optionId === 4).fireteamCapable, true)
assert.equal(ftoProfiles.find((item) => item.optionId === 5).fireteamCapable, false, 'FTO eligibility must not leak to a non-FTO sibling')
const weaponlessDataset = structuredClone(dataset)
weaponlessDataset.units[0].profileGroups[0].options = [{ id: 9, name: 'Repeater', weapons: [] }]
const [weaponless] = buildCanonicalGunfighterProfiles({ dataset: weaponlessDataset, weaponChart: chart, sectorialId: 502 })
assert.deepEqual(weaponless.weapons, [], 'profiles without offensive ranged weapons remain in the catalog with a zero rating')
const [crossSectorTts] = buildCanonicalGunfighterProfiles({
  dataset,
  weaponChart: chart,
  sectorialId: 502,
  ttsProfiles: [{ id: '501:99:7:4:2', unitId: 99, groupId: 7, optionId: 4, profileId: 2, bs: 15, ph: 12, arm: 4, bts: 6, vitality: 1, structure: null, skills: [], equipment: [], weapons: [{ name: 'AP HMG', modifiers: [] }] }],
})
assert.equal(crossSectorTts.bs, 13, 'Cross-sectorial TTS matches cannot override official profiles')
console.log('PASS - exact Army profiles join to official weapon-chart records and preserve profile/weapon modifiers.')
