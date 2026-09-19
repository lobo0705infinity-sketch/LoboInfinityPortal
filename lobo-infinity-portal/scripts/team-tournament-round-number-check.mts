import assert from 'node:assert/strict'
import { getNextTeamTournamentRoundNumber, getTeamTournamentRoundNumber, normalizeTeamTournamentRoundNumber } from '../src/services/teamTournamentRounds.ts'

const productionPairingHistory = [{ round: 1 }, { round: 'Round 2' }]
const productionRounds = [
  { id: 'round-august-2026-team-tournament-1', name: 'Round 1', number: 1, mission: 'Supplies' },
  { id: 'round-august-2026-team-tournament-2', name: 'Round 2', number: 2, mission: 'Superiority' },
]
const currentEventRound = { name: 'Round 2' }

assert.equal(normalizeTeamTournamentRoundNumber(1), 1)
assert.equal(normalizeTeamTournamentRoundNumber('1'), 1)
assert.equal(normalizeTeamTournamentRoundNumber('Round 2'), 2)
assert.equal(getTeamTournamentRoundNumber(productionPairingHistory[0]), 1)
assert.equal(getTeamTournamentRoundNumber(productionPairingHistory[1]), 2)
assert.equal(getNextTeamTournamentRoundNumber([...productionRounds, ...productionPairingHistory], currentEventRound), 3)
assert.deepEqual(productionRounds.map((round) => `Round ${getTeamTournamentRoundNumber(round)}`), ['Round 1', 'Round 2'])

console.log('PASS: mixed production Team Tournament rounds normalize to Round 1, Round 2, and Round 3 (new)')
