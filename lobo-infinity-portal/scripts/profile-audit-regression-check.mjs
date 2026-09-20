import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { buildMobilityProfiles } from '../bot/mobility-rating.mjs'
import { mobilityIndex } from '../bot/mobility-index.mjs'
import { eligibleLevel2Teams, canonicalMemberships } from '../bot/fireteam-list-eligibility.mjs'
import { repairArmyProfile } from '../bot/profile-audit.mjs'
const p = { mov: [4, 4], ph: 12, skills: ['Climbing Plus'], equipment: [] }
assert.equal(mobilityIndex(p).scenarios.climbWholeOrder, 10)
assert.equal(mobilityIndex(p).components.verticalTravel, 10 / 12)
assert.equal(mobilityIndex({ ...p, mov: [6, 4] }).components.verticalTravel, 1)
assert.equal(mobilityIndex({ ...p, skills: [] }).scenarios.climbWholeOrder, 6)
assert.equal(mobilityIndex({ ...p, skills: ['Climbing Plus', 'Motorcycle'] }).scenarios.climbWholeOrder, null)
const profile = { id: 1, move: [10, 10], ph: 12 }
const group = (id, options) => ({ id, profiles: [profile], options })
const capture = { metadata: {}, payloads: [{ sectorialId: 1, units: [{ id: 1, profileGroups: [group(1, [{ id: 1, includes: [{ group: 2, option: 1 }] }]), group(2, [{ id: 1, disabled: true, includes: [{ group: 3, option: 1 }] }]), group(3, [{ id: 1, disabled: true, includes: [{ group: 2, option: 1 }] }]), group(4, [{ id: 1, disabled: true }])] }] }] }
assert.deepEqual(buildMobilityProfiles(capture).map(e => e.groupId), [1, 2, 3], 'included disabled options, recursive links and cycles; exclude unreferenced disabled options')
const member = (id, unit, tags = [], extra = {}) => ({ combinedId: id, unitName: unit, fireteamMemberships: [{ team: 'Test', minSize: 2, maxSize: 2, memberName: unit, compositionTags: tags, max: 2, ...extra }] })
const eligible = rows => [...eligibleLevel2Teams(rows)].filter(([, teams]) => teams.size).map(([id]) => id)
assert.deepEqual(eligible([member('a','A'),member('b','B')]), [], 'mixed duo is level 1')
assert.deepEqual(eligible([member('a','A'),member('b','A')]), ['a','b'])
assert.deepEqual(eligible([member('a','A',['shared']),member('b','B',['shared'])]), ['a','b'])
assert.deepEqual(eligible([member('a','A',['shared']),member('b','B',['shared extra'])]), [], 'no prefix tag matching')
assert.deepEqual(eligible([member('a','A'),member('a','A')]), ['a'], 'repeated identical loadouts are two models')
assert.deepEqual(eligible([member('a','A'),member('b','A'),member('c','C')]), ['a','b'], 'third unit cannot borrow duo bonus')
assert.deepEqual(eligible([member('a','A',[],{maxSize:3}),member('b','A',[],{maxSize:3}),member('c','C',[],{maxSize:3})]), ['a','b','c'])
assert.deepEqual(eligible([member('a','A',[],{max:1}),member('b','A',[],{max:1})]), [], 'respect member maximum')
assert.deepEqual(eligible([member('a','A',[],{requiredNames:['Leader']}),member('b','A',[],{requiredNames:['Leader']})]), [], 'required member must be present')
assert.deepEqual(eligible([{...member('a','A'),combatGroup:1},{...member('b','A'),combatGroup:2}]), [], 'models in different combat groups cannot form a team')
const chart = canonicalMemberships({ units: [{ id:1,slug:'a' },{id:2,slug:'b'}],fireteamChart:{teams:[{name:'Test',type:['DUO'],units:[{slug:'a',name:'A',comment:'(Shared)',max:1},{slug:'b',name:'B',comment:'(Shared)',max:1}]}]}})
assert.deepEqual(chart.get(1)[0].compositionTags,['shared'])
const vertigo = repairArmyProfile({ combinedId:'502-410-1-1-1',weapons:['Crazykoala','Cybermine','Pitcher Repeater'] })
assert.ok(vertigo.weapons.includes('Missile Launcher'))
assert.ok(!vertigo.weapons.some(w=>/Crazykoala|Cybermine|Pitcher/.test(w)))
assert.equal(repairArmyProfile({combinedId:'102-33-2-1-1'}).fireteamEligibility.teams.length, 0, 'Crabbot must not inherit Tikbalang Fireteam membership')
const unknown = {combinedId:'999-999-1-1-1',weapons:['Unknown']}
assert.equal(repairArmyProfile(unknown),unknown)
const source = JSON.parse(gunzipSync(Buffer.from(await readFile('data/infinity-army/mobility-provisional-catalog.json.gz.b64','utf8'),'base64')))
assert.ok(source.entries.some(e=>e.id==='801:1553:2:1:1'))
assert.ok(source.entries.some(e=>e.id==='801:1553:3:1:1'))
console.log('PASS: Climb + Move, restricted movement, recursive companion inclusion, Level 2 composition, repeated profiles, team capacity, chart limits, required members and exact Vertigo weapon repair.')
