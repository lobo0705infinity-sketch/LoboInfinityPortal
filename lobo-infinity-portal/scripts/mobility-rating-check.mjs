import assert from 'node:assert/strict'
import { scoreMobility, officialMovementInches, buildMobilityProfiles } from '../bot/mobility-rating.mjs'

assert.equal(scoreMobility({ mov: [4, 4] }).score, 20)
assert.equal(scoreMobility({ mov: [6, 4], skills: ['Climbing Plus', 'Super-Jump'] }).score, 44.5)
const flying = ['Super-Jump(+3")', 'Super-Jump(Jet Propulsion)', 'Aerial', 'Terrain(Total)']
for (const second of [2, 4, 6]) {
  const result = scoreMobility({ mov: [8, second], skills: flying })
  assert.equal(result.score, 58 + second)
  assert.equal(scoreMobility({ mov: [8, second], skills: [...flying, 'Super-Jump', ...flying] }).score, result.score)
}
assert.equal(scoreMobility({ mov: null }).score, null)
assert.equal(scoreMobility({ mov: [8, null] }).score, null)
assert.equal(scoreMobility({ mov: [8, 2], skills: ['Super-Jump(Jet Propulsion)'] }).capabilities.aerial, false)
assert.deepEqual(officialMovementInches([20, 5]), [8, 2])
assert.equal(officialMovementInches([20]), null)
const [entry] = buildMobilityProfiles({
  metadata: { skills: [{ id: 74, name: 'Super-Jump' }, { id: 265, name: 'Aerial' }] },
  payloads: [{ sectorialId: 101, filters: { extras: [{ id: 1, name: '7.5', type: 'DISTANCE' }, { id: 2, name: 'Jet Propulsion', type: 'TEXT' }] }, units: [{ id: 1816, name: 'Redeye', profileGroups: [{ id: 1, profiles: [{ id: 1, move: [20, 5], s: 7, skills: [{ id: 74, extra: [1] }, { id: 74, extra: [2] }, { id: 265 }] }], options: [{ id: 1 }, { id: 2, disabled: true }] }] }] }],
})
assert.equal(entry.mobility.score, 60)
assert.equal(entry.mobility.capabilities.aerial, true)
assert.equal(entry.id, '101:1816:1:1:1')
console.log('PASS - mobility conversion, compound skills, overlap, unknown MOV, and official profile mapping.')
