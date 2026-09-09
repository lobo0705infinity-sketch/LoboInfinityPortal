import assert from 'node:assert/strict'
import { enrichDecodedList } from './army-intelligence-canonical-enrichment.mjs'

const list = { armyCode: 'x', combatGroups: [{ combatGroup: 1, entries: [
  { combinedId: '502-10-2-7-3', unit: 'DISPLAY', profile: 'DISPLAY LOADOUT', weapons: ['Legacy Weapon'], skills: [], equipment: [] },
  { combinedId: '502-10-2-8-1', unit: 'DISPLAY', profile: 'OTHER LOADOUT', weapons: ['Other Weapon'], skills: [], equipment: [] },
] }] }
const reference = {
  status: 'available', payloadVersion: 'fixture-1',
  units: [{ id: 10, name: 'CANONICAL UNIT', profileGroups: [
    { id: 2, profiles: [{ id: 3, name: 'CANONICAL PROFILE A', bs: 14, weapons: [{ id: 4 }] }, { id: 1, name: 'CANONICAL PROFILE B', bs: 11 }], options: [
      { id: 7, weapons: [{ id: 1, extra: [308] }, { id: 2 }] }, { id: 8, weapons: [{ id: 3 }] },
    ] },
  ] }],
  weapons: [{ id: 1, name: 'Canonical HMG', burst: 4 }, { id: 2, name: 'Canonical Pistol', burst: 2 }, { id: 3, name: 'Other Rifle', burst: 3 }, { id: 4, name: 'Canonical Profile Weapon', burst: 2 }],
  extras: [{ id: 308, name: '+1SD' }],
  fireteamChart: { teams: [{ name: 'Verified Team', type: ['CORE'], units: [{ unitId: 10 }] }] },
}
const result = enrichDecodedList(list, reference)
const [first, second] = result.combatGroups[0].entries
assert.equal(first.bs, 14)
assert.equal(first.canonicalProfile, 'CANONICAL PROFILE A')
assert.deepEqual(first.weaponProfiles.map((weapon) => weapon.name), ['Canonical Profile Weapon', 'Canonical HMG', 'Canonical Pistol'])
assert.deepEqual(first.weaponProfiles.find((weapon) => weapon.name === 'Canonical HMG').modifiers, ['+1SD'])
assert.equal(first.fireteamEligibility.state, 'verified')
assert.equal(second.bs, 11)
assert.deepEqual(second.weaponProfiles.map((weapon) => weapon.name), ['Other Rifle'])
assert.equal(result.enrichment.status, 'complete')
const unavailable = enrichDecodedList(list, { status: 'unavailable', units: [], weapons: [], fireteamChart: [], payloadVersion: null })
assert.equal(unavailable.enrichment.status, 'incomplete')
assert.equal(unavailable.combatGroups[0].entries[0].fireteamEligibility.state, 'unknown')
const noChart = enrichDecodedList(list, { status: 'none', units: reference.units, weapons: reference.weapons, fireteamChart: { teams: [] }, payloadVersion: 'fixture-2' })
assert.equal(noChart.enrichment.status, 'complete')
assert.equal(noChart.combatGroups[0].entries[0].fireteamEligibility.state, 'verified-false')
console.log('Army Intelligence canonical enrichment passed (exact combinedId profile/options, source metadata, Fireteam true/unknown, and loadout isolation).')
