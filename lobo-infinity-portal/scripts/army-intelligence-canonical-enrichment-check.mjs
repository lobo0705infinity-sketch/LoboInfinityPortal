import assert from 'node:assert/strict'
import { enrichDecodedList } from './army-intelligence-canonical-enrichment.mjs'

const list = { armyCode: 'x', combatGroups: [{ combatGroup: 1, entries: [
  { combinedId: '502-10-2-7-3', unit: 'DISPLAY', profile: 'DISPLAY LOADOUT', weapons: ['Legacy Weapon'], skills: [], equipment: [] },
  { combinedId: '502-10-2-8-1', unit: 'DISPLAY', profile: 'OTHER LOADOUT', weapons: ['Other Weapon'], skills: [], equipment: [] },
  { combinedId: '502-10-0-8-1', unit: 'DISPLAY', profile: 'CANONICAL PROFILE B', weapons: ['Other Weapon'], skills: [], equipment: [] },
  { combinedId: '502-11-0-3-1', unit: 'SCARFACE Loadout Gamma', profile: 'SCARFACE Loadout Gamma', weapons: [], skills: [], equipment: [] },
] }] }
const reference = {
  status: 'available', payloadVersion: 'fixture-1',
  units: [{ id: 10, name: 'CANONICAL UNIT', profileGroups: [
    { id: 2, profiles: [{ id: 3, name: 'CANONICAL PROFILE A', bs: 14, cc: 22, weapons: [{ id: 4 }] }, { id: 1, name: 'CANONICAL PROFILE B', bs: 11, cc: 18 }], options: [
      { id: 7, weapons: [{ id: 1, extra: [308] }, { id: 2 }] }, { id: 8, weapons: [{ id: 3 }] },
    ] },
    { id: 3, profiles: [{ id: 1, name: 'UNRELATED PERIPHERAL', bs: 9, cc: 12 }], options: [] },
  ] }, { id: 11, name: 'SCARFACE & CORDELIA', profileGroups: [
    { id: 1, profiles: [{ id: 1, name: 'SCARFACE TURNER', bs: 13, cc: 22 }], options: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    { id: 2, profiles: [{ id: 1, name: 'TURTLEMEK', bs: -1, cc: -1 }], options: [{ id: 1 }] },
    { id: 3, profiles: [{ id: 1, name: 'CORDELIA TURNER', bs: 11, cc: 13 }], options: [{ id: 1 }] },
  ] }],
  weapons: [{ id: 1, name: 'Canonical HMG', burst: 4 }, { id: 2, name: 'Canonical Pistol', burst: 2 }, { id: 3, name: 'Other Rifle', burst: 3 }, { id: 4, name: 'Canonical Profile Weapon', burst: 2 }],
  extras: [{ id: 308, name: '+1SD' }],
  fireteamChart: { teams: [{ name: 'Verified Team', type: ['CORE'], units: [{ unitId: 10 }] }] },
}
const result = enrichDecodedList(list, reference)
const [first, second, legacyGroup, scarfaceLegacyGroup] = result.combatGroups[0].entries
assert.equal(first.bs, 14)
assert.equal(first.canonicalProfile, 'CANONICAL PROFILE A')
assert.deepEqual(first.weaponProfiles.map((weapon) => weapon.name), ['Canonical Profile Weapon', 'Canonical HMG', 'Canonical Pistol'])
assert.deepEqual(first.weaponProfiles.find((weapon) => weapon.name === 'Canonical HMG').modifiers, ['+1SD'])
assert.equal(first.fireteamEligibility.state, 'verified')
assert.equal(second.bs, 11)
assert.deepEqual(second.weaponProfiles.map((weapon) => weapon.name), ['Other Rifle'])
assert.equal(legacyGroup.cc, 18)
assert.equal(scarfaceLegacyGroup.canonicalProfile, 'SCARFACE TURNER')
assert.equal(scarfaceLegacyGroup.bs, 13)
assert.equal(scarfaceLegacyGroup.cc, 22)
assert.equal(result.enrichment.status, 'complete')
const unavailable = enrichDecodedList(list, { status: 'unavailable', units: [], weapons: [], fireteamChart: [], payloadVersion: null })
assert.equal(unavailable.enrichment.status, 'incomplete')
assert.equal(unavailable.combatGroups[0].entries[0].fireteamEligibility.state, 'unknown')
const noChart = enrichDecodedList(list, { status: 'none', units: reference.units, weapons: reference.weapons, fireteamChart: { teams: [] }, payloadVersion: 'fixture-2' })
assert.equal(noChart.enrichment.status, 'complete')
assert.equal(noChart.combatGroups[0].entries[0].fireteamEligibility.state, 'verified-false')
console.log('Army Intelligence canonical enrichment passed (exact combinedId profile/options, source metadata, Fireteam true/unknown, and loadout isolation).')
