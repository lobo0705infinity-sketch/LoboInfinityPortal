import assert from 'node:assert/strict'
import { activePreparationMatches, buildPreparationAssignments, groupPublicEventLists, isTop40Registration, preparationDate, top40RegistrationState, TOP40_EVENT_ID } from '../src/public/top40PreparationModel.ts'
import type { PublicArmyList, PublicEvent, PublicSchedule } from '../src/public/snapshotTypes.ts'

const event = { id: TOP40_EVENT_ID, status: 'Registration Open', lifecycleStage: 'Registration Open', bracketMissions: [], rounds: [{ name: 'Round 1', mission: 'Data Harvest' }], bracket: [] } as unknown as PublicEvent
const otherSchedule = { eventId: 'event-current-league', missions: [{ mission: 'Data Harvest', maps: ['League-only map'] }] } as PublicSchedule
assert.deepEqual(buildPreparationAssignments(event, [otherSchedule])[0].maps, [], 'Another event must not supply Top 40 maps')
const ownSchedule = { eventId: TOP40_EVENT_ID, missions: [{ mission: 'Data Harvest', maps: ['Top 40 map'] }] } as PublicSchedule
assert.deepEqual(buildPreparationAssignments(event, [otherSchedule, ownSchedule])[0].maps, ['Top 40 map'])
assert.equal(buildPreparationAssignments({ ...event, bracketMissions: [{ bracket: 'Losers', bracketRound: '2', mission: 'Annihilation' }] }, [ownSchedule])[0].label, 'Losers Bracket · Round 2')
assert.deepEqual(buildPreparationAssignments({ ...event, rounds: [{ name: 'Round 1', mission: '' }] }, [otherSchedule])[0].maps, [])
assert.equal(buildPreparationAssignments({ ...event, rounds: [{ name: 'Round 1', mission: '' }] }, [ownSchedule])[0].label, 'Mission pool', 'A schedule pool must not be presented as an assigned bracket round')
assert.equal(top40RegistrationState(event), 'open')
assert.equal(top40RegistrationState({ ...event, status: 'Registration Closed' }), 'closed', 'Closed takes precedence over stale open lifecycle')
assert.equal(top40RegistrationState({ ...event, status: 'Active' }), 'closed')
assert.equal(top40RegistrationState(undefined), 'unknown')
assert.ok(isTop40Registration({ generatedAt: '2026-10-12T00:00:00Z', players: [{ name: 'Player', position: 1 }] }))
assert.ok(!isTop40Registration({ generatedAt: 'invalid', players: [] }))
assert.ok(!isTop40Registration({ generatedAt: '2026-10-12T00:00:00Z', players: [{ name: '', position: 1 }] }))
const list = { id: 'list-1', player: 'player', playerDisplayName: 'Player', eventId: TOP40_EVENT_ID, date: '2026-11-03' } as PublicArmyList
const groups = groupPublicEventLists([list, { ...list, id: 'league', eventId: 'event-current-league' }, { ...list, id: 'private', approved: false }], TOP40_EVENT_ID)
assert.deepEqual(groups[0].lists.map(item => item.id), ['list-1'], 'Exclude other events and explicitly unapproved lists')
assert.deepEqual(activePreparationMatches({ ...event, bracket: [{ matchId: 'A', status: 'Active', playerA: 'One', playerB: 'Two', deadline: '2026-11-08T23:00:00Z' }, { matchId: 'B', status: 'Completed' }] }).map(item => item.id), ['A'])
assert.equal(preparationDate(''), 'To be announced')
assert.equal(preparationDate('2026-02-30'), 'To be announced')
assert.match(preparationDate('2026-11-01'), /November|Nov/)
assert.equal(preparationDate('2026-11-08 23:00:00'), '2026-11-08 23:00:00 (published time)', 'Do not invent a timezone')
console.log('PASS: Top 40 event scoping, deadlines, public lists, registration state and date handling.')
