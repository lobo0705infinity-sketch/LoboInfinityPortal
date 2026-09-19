import assert from 'node:assert/strict'
import { buildFireteamBonusEligibility } from '../bot/fireteam-bonus-eligibility.mjs'

const payload = {
  units: [
    { id: 1, slug: 'dragao' }, { id: 2, slug: 'tikbalang' },
    { id: 3, slug: 'marut' }, { id: 4, slug: 'maximus' }, { id: 5, slug: 'johnny' },
    { id: 6, slug: 'outsider' }, { id: 7, slug: 'wildcard' },
  ],
  fireteamChart: { teams: [
    { name: 'Moto Fireteams', type: ['DUO'], units: [
      { name: 'DRAGAO', max: 1, slug: 'dragao' },
      { name: 'TIKBALANG', max: 2, slug: 'tikbalang' },
    ] },
    { name: 'Max-Op Fireteam', type: ['DUO'], units: [
      { name: 'MARUT', max: 1, slug: 'marut' },
      { name: 'MAXIMUS', comment: '(Max-Op)', max: 1, slug: 'maximus' },
      { name: 'JOHNNY', comment: '(Max-Op)', max: 1, slug: 'johnny' },
    ] },
    { name: 'Test Haris', type: ['HARIS'], units: [
      { name: 'TIKBALANG', max: 2, slug: 'tikbalang' },
      { name: 'OUTSIDER', max: 1, slug: 'outsider' },
    ] },
    { name: 'Wildcards', type: [], units: [
      { name: 'WILDCARD FTO', comment: 'FTO', max: 1, slug: 'wildcard' },
    ] },
  ] },
}

const result = buildFireteamBonusEligibility([payload])
const records = (id) => result.fireteamProfiles.filter((entry) => entry.unitId === id)
assert.equal(records(1).some((entry) => entry.level2Capable), false, 'a singleton Drago in an unrelated Duo remains Level 1')
assert.equal(records(2).some((entry) => entry.level2Capable), true, 'two copies of the same model reach Level 2')
assert.equal(records(3).some((entry) => entry.level2Capable), false, 'a singleton Marut without a matching parenthetical remains Level 1')
assert.equal(records(4).some((entry) => entry.level2Capable), true, 'matching parenthetical names reach Level 2')
assert.equal(records(5).some((entry) => entry.level2Capable), true, 'both members of a matching parenthetical pair receive Level 2')
assert.equal(records(6).some((entry) => entry.level2Capable), true, 'a third Haris member benefits when the team contains a same-model pair')
assert.equal(records(7).some((entry) => entry.level2Capable), true, 'a Wildcard can join a larger team that reaches Level 2')
console.log('PASS - Fireteam +1SD eligibility follows Level 2 composition rather than simple linkability.')
