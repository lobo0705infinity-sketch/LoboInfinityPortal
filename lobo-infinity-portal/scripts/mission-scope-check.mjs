import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getEventMissionGames, summarizeMissionForEvent } from '../src/public/missionSnapshotScope.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const app = read('src/public/SnapshotPublicApp.tsx')
const missionApi = read('backend/MissionApi.gs')

assert.match(app, /<Route path="\/missions" element=\{<Missions \/>\}/)
assert.match(app, /visibleMissions=missions\.map\(mission=>summarizeMissionForEvent\(mission,games,selectedEventId\)\)/)
assert.match(app, /<Link to=\{`\/missions\/\$\{encodeURIComponent\(mission\.mission\)\}\$\{selectedEventId===/)
assert.match(app, /const missionGames=getEventMissionGames\(m\.mission,games\.data!,selectedEventId\)/)
assert.match(app, /const summary=summarizeMissionForEvent\(m,games\.data!,selectedEventId\)/)
assert.match(missionApi, /getLeagueDataForEvent\(\s*eventId \|\| "all",\s*gameType \|\| "league"\s*\)/)

const mission = {
  mission: 'Superiority', games: 3, averageTP: 6, averageOP: 8,
  averageVP: 200, firstTurnWinRate: 66.7, mostSuccessfulFaction: 'Tohaa',
  mostPlayedFaction: 'PanOceania', lastPlayed: '2026-09-03',
  divisionBreakdown: [], recentGames: [], bestMoments: [],
}
const makeGame = (id, eventId, date, winner, firstTurn, factions, scores) => ({
  id, eventId, date, division: 'Main Man', mission: 'Superiority',
  player1: `Player ${id} A`, player2: `Player ${id} B`, winner, firstTurn,
  player1Faction: factions[0], player2Faction: factions[1],
  winnerFaction: winner === `Player ${id} A` ? factions[0] : factions[1],
  tp: scores[0], op: scores[1], vp: scores[2], bestMoment: '',
})
const games = [
  makeGame(1, 'event-a', '2026-09-01', 'Player 1 A', 'Player 1', ['PanOceania', 'Nomads'], ['5–0', '8–2', '200–100']),
  makeGame(2, 'event-a', '2026-09-02', 'Player 2 B', 'Player 1', ['PanOceania', 'Ariadna'], ['4–3', '7–2', '150–120']),
  makeGame(3, 'event-b', '2026-09-03', 'Player 3 A', 'Player 1', ['Tohaa', 'Next Wave'], ['9–0', '10–0', '300–0']),
]

assert.equal(summarizeMissionForEvent(mission, games, 'all'), mission, 'All-events view preserves the published summary.')
assert.deepEqual(getEventMissionGames('Superiority', games, 'event-a').map((game) => game.id), [2, 1])
const eventA = summarizeMissionForEvent(mission, games, 'event-a')
assert.equal(eventA.games, 2)
assert.equal(eventA.firstTurnWinRate, 50)
assert.equal(eventA.averageTP, 4.5)
assert.equal(eventA.averageOP, 7.5)
assert.equal(eventA.averageVP, 175)
assert.equal(eventA.mostSuccessfulFaction, 'Ariadna')
assert.equal(eventA.mostPlayedFaction, 'PanOceania')
assert.deepEqual(eventA.recentGames.map((game) => game.id), [2, 1])

const eventB = summarizeMissionForEvent(mission, games, 'event-b')
assert.equal(eventB.games, 1)
assert.equal(eventB.firstTurnWinRate, 100)
assert.equal(eventB.mostSuccessfulFaction, 'Tohaa')
assert.deepEqual(eventB.recentGames.map((game) => game.id), [3])
assert.equal(summarizeMissionForEvent(mission, games, 'event-missing').games, 0)

console.log('Pinned-snapshot mission event scopes passed.')
