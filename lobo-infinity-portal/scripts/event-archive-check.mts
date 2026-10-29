import assert from 'node:assert/strict'
import { eventLifecycle, eventReportingClosure, isPastEvent } from '../src/config/eventLifecycle.ts'
const team = { id: 'event-august-2026-team-tournament', status: 'Registration Closed' }
assert.equal(eventLifecycle(team), 'Archived')
assert.equal(isPastEvent(team), true)
assert.match(eventReportingClosure(team)!, /closed/)
assert.equal(isPastEvent({ id: 'league-2026', status: 'Active', endDate: '2000-01-01' }), false, 'elapsed date alone cannot close an unfinished event')
assert.equal(isPastEvent({ id: 'season-2025', lifecycleStage: 'Completed', status: 'Active' }), true)
assert.equal(isPastEvent({ id: 'season-2024', lifecycleStage: 'Archived' }), true)
assert.equal(eventLifecycle({ id: 'top40-2027', status: 'Registration Open' }), 'Registration Open')
assert.equal(eventReportingClosure({ id: 'event-current-league', status: 'Active' }), undefined)
assert.equal(eventLifecycle({ id: 'next-edition', status: 'Planning' }), 'Upcoming')
console.log('PASS archival decisions, stale labels, completed seasons, active-event preservation and separate future editions')
