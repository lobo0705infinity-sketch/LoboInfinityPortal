import assert from 'node:assert/strict'
import { activePreparationMatches, buildPreparationAssignments, groupPublicEventLists, isTop40Registration, preparationDate, top40RegistrationState, TOP40_EVENT_ID } from '../src/public/top40PreparationModel.ts'
import type { PublicArmyList, PublicGame, PublicEvent, PublicSchedule } from '../src/public/snapshotTypes.ts'

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
assert.equal(preparationDate('2026-11-08 23:00:00'), '2026-11-08 23:00:00 Eastern (legacy timestamp)', 'Preserve the existing Eastern label for legacy bracket records')
console.log('PASS: Top 40 event scoping, deadlines, public lists, registration state and date handling.')

// Regression: the production vault puts the event key in eventName and exports
// gameId=0, while public games retain both canonical list IDs.
const legacy = { ...list, eventId: '', eventName: TOP40_EVENT_ID, gameId: 0, armyLink: 'https://infinitytheuniverse.com/army/list/public-code' }
const opponentList = { ...legacy, id: 'list-2', player: 'opponent', playerDisplayName: 'Opponent' }
const game = {
  id: 139, eventId: TOP40_EVENT_ID, eventName: "Lobo's Top 40", gameType: 'tournament',
  date: '2026-11-02T05:00:00Z', mission: 'Corporate Appropriation',
  player1: 'player', player1DisplayName: 'Player', player2: 'opponent', player2DisplayName: 'Opponent',
  winner: 'player', winnerDisplayName: 'Player', loser: 'opponent', loserDisplayName: 'Opponent',
  winnerArmyListId: 'list-1', loserArmyListId: 'list-2',
} as PublicGame
const restored = groupPublicEventLists([legacy, opponentList], TOP40_EVENT_ID, [game])
assert.equal(restored.length, 2)
const playerAppearance = restored.find(group => group.player === 'player')!.lists[0]
assert.equal(playerAppearance.gameId, 139)
assert.equal(playerAppearance.eventName, "Lobo's Top 40")
assert.equal(playerAppearance.opponentDisplayName, 'Opponent')
assert.equal(playerAppearance.battleReportPath, '/games/139')
assert.equal(playerAppearance.armyLink, legacy.armyLink)
assert.equal(playerAppearance.result, 'Win')
assert.equal(restored.find(group => group.player === 'opponent')!.lists[0].result, 'Loss')
assert.equal(legacy.gameId, 0, 'Never mutate the pinned snapshot')
assert.equal(legacy.eventId, '')
const reused = groupPublicEventLists([legacy], TOP40_EVENT_ID, [game, { ...game, id: 140, date: '2026-11-03T05:00:00Z' }, { ...game, id: 141, eventId: 'other-event' }])
assert.deepEqual(reused[0].lists.map(item => item.gameId), [140, 139], 'Show every round without leaking another event')
assert.equal(groupPublicEventLists([{ ...legacy, approved: false }], TOP40_EVENT_ID, [game]).length, 0)
assert.equal(groupPublicEventLists([{ ...legacy, player: 'someone-else', playerDisplayName: 'Someone Else' }], TOP40_EVENT_ID, [game]).length, 0, 'An ID must belong to that game participant')
assert.equal(groupPublicEventLists([{ ...legacy, id: 'unrelated' }], TOP40_EVENT_ID, [game]).length, 0, 'Event names and matching missions alone must not attach a list')
assert.equal(groupPublicEventLists([{ ...legacy, eventId: TOP40_EVENT_ID }], TOP40_EVENT_ID, [{ ...game, eventId: 'other-event' }]).length, 0, 'Canonical associations take precedence over stale vault metadata')
assert.equal(groupPublicEventLists([legacy], TOP40_EVENT_ID, [game, game])[0].lists.length, 1, 'Repeated game records do not duplicate an appearance')
const drawn = groupPublicEventLists([legacy, opponentList], TOP40_EVENT_ID, [{ ...game, winner: 'Draw', loser: 'Draw' }])
assert.equal(drawn.length, 2)
assert.ok(drawn.every(group => group.lists[0].result === 'Draw'))
assert.equal(groupPublicEventLists([legacy], TOP40_EVENT_ID, [{ ...game, winnerArmyListId: '', loserArmyListId: '' }]).length, 0, 'No pre-game or guessed list publication')
console.log('PASS: legacy list export recovery, opponents and game links, reused rosters, event isolation, draws, approval and identity checks.')

assert.equal(groupPublicEventLists([{ ...legacy, player: 'Player', playerDisplayName: 'Player' }], TOP40_EVENT_ID, [{ ...game, winner: 'canonical-player-handle', player1: 'canonical-player-handle' }])[0].lists[0].player, 'canonical-player-handle', 'Published display names reconcile existing canonical handle aliases by exact list ID')
