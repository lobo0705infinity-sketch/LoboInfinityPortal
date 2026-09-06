import assert from 'node:assert/strict'
import { getPublicTeamTournamentParticipants, orderPublicTeamTournamentGames, orderPublicTeamTournamentStandings } from '../src/public/teamTournamentPresentation.ts'

const game = (id: string, date: unknown) => ({ id, date } as any)
const source = [game('9', '8/1/2026'), game('100', '2026-08-01T00:00:00.000Z'), game('10', '8/1/2026'), game('x', ''), game('11', 'not-a-date'), game('12', '2027-01-01')]
const before = JSON.stringify(source)
assert.deepEqual(orderPublicTeamTournamentGames(source).map(g => g.id), ['12', '100', '10', '9', '11', 'x'])
assert.equal(JSON.stringify(source), before)
const tied = [game('a', '8/1/2026'), game('b', '8/1/2026')]
assert.deepEqual(orderPublicTeamTournamentGames(tied).map(g => g.id), ['a', 'b'])

const decisive = { player1DisplayName: 'Arg', player2DisplayName: 'Defuser', winnerDisplayName: 'Defuser', loserDisplayName: 'Arg', tp: '5–0', op: '9–1', vp: '285–96' } as any
assert.deepEqual(getPublicTeamTournamentParticipants(decisive), ['Defuser', 'Arg'])
assert.deepEqual(getPublicTeamTournamentParticipants({ ...decisive, gameResult: 'Draw' }), ['Arg', 'Defuser'])
assert.deepEqual(getPublicTeamTournamentParticipants({ ...decisive, winnerDisplayName: 'Draw', loserDisplayName: 'Tie' }), ['Arg', 'Defuser'])

const standings = [
  { teamId: 's', teamName: 'Swedes Can’t Decide', objectivePoints: 51, tournamentPoints: 32, victoryPoints: 1877, rank: 1 },
  { teamId: 'h', teamName: 'HO-12', objectivePoints: '62', tournamentPoints: '30', victoryPoints: '2006', rank: 2 },
  { teamId: 'g', teamName: 'Goodbye Ruby Monday', objectivePoints: 59, tournamentPoints: 30, victoryPoints: 2151, rank: 3 },
  { teamId: 'a', teamName: 'Angry Beavers', objectivePoints: 33, tournamentPoints: 14, victoryPoints: 1406, rank: 4 },
] as any
assert.deepEqual(orderPublicTeamTournamentStandings(standings).map(team => [team.rank, team.teamName]), [[1, 'HO-12'], [2, 'Goodbye Ruby Monday'], [3, 'Swedes Can’t Decide'], [4, 'Angry Beavers']])
console.log('Team Tournament public display ordering, orientation, ranking, stability, and immutability checks passed.')
