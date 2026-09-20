import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMobilityProfiles } from '../bot/mobility-rating.mjs'
import { validateMobilityCapture, validateMobilityEntries } from '../bot/mobility-catalog-validation.mjs'
import { evaluateMobilityScenarios, normalDodge, terrainMovement } from '../bot/mobility-scenarios.mjs'

const p = (mov = [4, 4], skills = [], extra = {}) => ({ mov, ph: 12, skills, equipment: [], ...extra })
const fixture = () => ({
  metadata: { factions: [{ id: 101 }], skills: [] },
  payloads: [{ sectorialId: 101, version: 'fixture', filters: { skills: [{ id: 259, name: 'Exrah' }], equip: [{ id: 7, name: 'Motorcycle' }] }, units: [{ id: 1, name: 'Fixture', profileGroups: [{ id: 1, profiles: [{ id: 1, move: [10, 10], ph: 12, skills: [{ id: 259 }], equip: [{ id: 7 }] }], options: [{ id: 1 }] }] }] }],
})
test('one-of-58 style incomplete capture is rejected', () => {
  const c = fixture(); c.metadata.factions.push({ id: 102 })
  assert.throws(() => validateMobilityCapture(c), /missing \[102\]/)
})
test('duplicate and unexpected faction payloads are rejected', () => {
  const c = fixture(); c.payloads.push(structuredClone(c.payloads[0]))
  assert.throws(() => validateMobilityCapture(c), /Duplicate/)
  c.payloads[1].sectorialId = 102
  assert.throws(() => validateMobilityCapture(c), /unexpected \[102\]/)
})
test('missing profile groups cannot silently reduce coverage', () => {
  const c = fixture(); delete c.payloads[0].units[0].profileGroups
  assert.throws(() => validateMobilityCapture(c), /profile groups/)
})
test('faction-local skills and equipment resolve, and PH survives', () => {
  const c = fixture(); validateMobilityCapture(c)
  const entries = buildMobilityProfiles(c); validateMobilityEntries(entries)
  assert.deepEqual(entries[0].skills, ['Exrah'])
  assert.deepEqual(entries[0].equipment, ['Motorcycle'])
  assert.equal(entries[0].ph, 12)
})
test('duplicates, unresolved traits and missing MOV/PH fail entry validation', () => {
  const [entry] = buildMobilityProfiles(fixture())
  assert.throws(() => validateMobilityEntries([entry, entry]), /Duplicate/)
  assert.throws(() => validateMobilityEntries([{ ...entry, skills: ['Unknown 999'] }]), /Unresolved/)
  assert.throws(() => validateMobilityEntries([{ ...entry, ph: null }]), /Missing PH/)
  assert.throws(() => validateMobilityEntries([{ ...entry, mobility: { status: 'missing-movement' } }]), /Missing movement/)
})
test('official nonmoving form remains unranked, not an extraction failure', () => {
  const c = fixture(); c.payloads[0].units[0].profileGroups[0].profiles[0].move = [-1, -1]
  const entries = buildMobilityProfiles(c); validateMobilityEntries(entries)
  assert.equal(entries[0].mobility.status, 'no-movement-attribute')
  assert.equal(evaluateMobilityScenarios(entries[0]).status, 'unranked-no-movement')
})
test('8-2, 8-4, 8-6 retain different sprint capacity', () => {
  assert.deepEqual([2, 4, 6].map(b => evaluateMobilityScenarios(p([8, b])).openMoveMove), [10, 12, 14])
})
test('flier short jump 11 differs from long jump 12', () => {
  const r = evaluateMobilityScenarios(p([8, 2], ['Super-Jump(+3")', 'Super-Jump(Jet Propulsion)']))
  assert.equal(r.horizontalJumpAndShoot, 11); assert.equal(r.horizontalLongJump, 12)
  assert.equal(r.gap11AndShoot, true); assert.equal(r.bentAirPath10AndShoot, true)
  assert.equal(r.openBestTravel, 13); assert.equal(r.open12Orders, 1)
})
test('Garuda-like 8-2 Jet Propulsion crosses 11 only without shooting', () => {
  const r = evaluateMobilityScenarios(p([8, 2], ['Super-Jump(Jet Propulsion)']))
  assert.equal(r.horizontalJumpAndShoot, 10); assert.equal(r.gap11AndShoot, false)
  assert.equal(r.gap11OneOrder, true)
  assert.equal(r.openBestTravel, 12)
})
test('ordinary jump is a long skill; extra distance does not grant shoot action', () => {
  const r = evaluateMobilityScenarios(p([6, 4], ['Jump(+3")']))
  assert.equal(r.horizontalLongJump, 9); assert.equal(r.horizontalJumpAndShoot, null)
})
test('bent aerial path requires Jet Propulsion, not ordinary Super-Jump', () => {
  assert.equal(evaluateMobilityScenarios(p([8, 2], ['Super-Jump'])).bentAirPath10AndShoot, false)
})
test('Climb +3 replaces standard +2 and C+ allows a follow-up action', () => {
  assert.equal(evaluateMobilityScenarios(p([6, 2], ['Climb(+3")'])).climbLongSkill, 9)
  assert.equal(evaluateMobilityScenarios(p([6, 2], ['Climb(+3")'])).climbAndShoot, null)
  assert.equal(evaluateMobilityScenarios(p([6, 2], ['Climb(+3")', 'Climbing Plus'])).climbAndShoot, 9)
})
test('motorcycle blocks climb and upward jump but allows horizontal jump', () => {
  for (const bike of ['Motorcycle', 'AI Motorcycle']) {
    const r = evaluateMobilityScenarios(p([8, 6], [], { equipment: [bike] }))
    assert.equal(r.climbLongSkill, null); assert.equal(r.upwardJumpAndShoot, null)
    assert.equal(r.horizontalLongJump, 10)
  }
})
test('Terrain Total gains +1 first MOV and avoids both difficult-terrain penalties', () => {
  assert.deepEqual(terrainMovement(p([6, 4], ['Terrain(Total)']), 'Jungle'), { status: 'ok', matches: true, first: 7, second: 4 })
  assert.deepEqual(terrainMovement(p([6, 4]), 'Jungle'), { status: 'ok', matches: false, first: 5, second: 3 })
})
test('specific terrain works only in its type; multiple types require a choice', () => {
  assert.equal(terrainMovement(p([4, 4], ['Terrain(Desert)']), 'Jungle').matches, false)
  assert.equal(terrainMovement(p([4, 4], ['Terrain(Aquatic/Jungle)']), 'Jungle').status, 'terrain-choice-required')
  assert.equal(terrainMovement(p([4, 4], ['Terrain(Aquatic/Jungle)']), 'Jungle', 'Aquatic').matches, false)
  assert.equal(terrainMovement(p([4, 4], ['Terrain(Aquatic/Jungle)']), 'Jungle', 'Jungle').matches, true)
  assert.equal(terrainMovement(p([4, 4], ['Terrain']), 'Jungle').status, 'terrain-type-unspecified')
})
test('Dodge bonus inches differ from target modifiers', () => {
  const r = normalDodge(p([4, 4], ['Dodge(+2")', 'Dodge(+3)']))
  assert.equal(r.distance, 4); assert.equal(r.target, 15); assert.equal(r.successProbability, 0.75); assert.equal(r.expectedDistance, 3)
})
test('Dodge negative modifier affects opponent, not normal-roll PH', () => {
  assert.equal(normalDodge(p([4, 4], ['Dodge(-3)'])).target, 12)
})
test('Dodge fixed PH and special die affect Normal Roll probability', () => {
  const r = normalDodge(p([4, 4], ['Dodge(PH=10)', 'Dodge(+1SD)']))
  assert.equal(r.successProbability, 0.75); assert.equal(r.expectedDistance, 1.5)
})
test('Dodge repeated labels do not double stack', () => {
  assert.deepEqual(normalDodge(p([4, 4], ['Dodge(+3)', 'Dodge(+3)'])), normalDodge(p([4, 4], ['Dodge(+3)'])))
})
test('Aerial cannot Climb because scenery contact is unavailable', () => {
  assert.equal(evaluateMobilityScenarios(p([8, 2], ['Aerial', 'Super-Jump(Jet Propulsion)'])).climbLongSkill, null)
})
