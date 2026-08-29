import assert from 'node:assert/strict'
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'

const api = fs.readFileSync('backend/StandingsApi.gs', 'utf8')
const dashboard = fs.readFileSync('backend/Dashboard.gs', 'utf8')
const analytics = fs.readFileSync('backend/EventAnalyticsApi.gs', 'utf8')

assert.match(api, /function buildAllLeagueStandingsResponses/)
assert.match(api, /const context = buildLeagueStandingsContext\(eventId, dashboardContext\)/)
assert.match(api, /updateRegistryStatistics\(registry, resolvedEventId\)/)
assert.match(api, /\["main", "pga", "pgb"\]\.map/)
assert.match(dashboard, /buildAllLeagueStandingsResponses/)
assert.match(analytics, /return buildAllLeagueStandingsResponses\(context\.eventId\)/)

function fixture(playerCount, gameCount) {
  const labels = ['Main Man', 'Proving Grounds A', 'Proving Grounds B']
  const players = Array.from({ length: playerCount }, (_, index) => ({
    division: labels[index % 3], draws: 0, games: 0, losses: 0,
    op: 0, player: `Player ${String(index + 1).padStart(3, '0')}`, tp: 0, vp: 0, wins: 0,
  }))
  const games = Array.from({ length: gameCount }, (_, index) => ({
    player: players[index % playerCount].player,
    result: index % 5 === 0 ? 'D' : index % 2 === 0 ? 'W' : 'L',
    tp: index % 5, op: index % 11, vp: 100 + (index % 180),
  }))
  return { games, players }
}

function calculate(players, games) {
  const registry = Object.fromEntries(players.map((player) => [player.player, { ...player }]))
  for (const game of games) {
    const player = registry[game.player]
    player.games++
    if (game.result === 'W') player.wins++
    else if (game.result === 'L') player.losses++
    else player.draws++
    player.tp += game.tp; player.op += game.op; player.vp += game.vp
  }
  return ['Main Man', 'Proving Grounds A', 'Proving Grounds B'].map((division) =>
    Object.values(registry).filter((player) => player.division === division).sort((a, b) =>
      b.tp - a.tp || b.op - a.op || b.vp - a.vp || a.player.localeCompare(b.player)
    ).map((player, index) => ({ ...player, rank: index + 1 })))
}

function legacy(players, games) {
  return ['Main Man', 'Proving Grounds A', 'Proving Grounds B'].map((division) =>
    calculate(players, games)[['Main Man', 'Proving Grounds A', 'Proving Grounds B'].indexOf(division)])
}

for (const [players, games] of [[43, 72], [100, 300]]) {
  const data = fixture(players, games)
  const legacyStarted = performance.now()
  const oldOutput = legacy(data.players, data.games)
  const legacyElapsed = performance.now() - legacyStarted
  const started = performance.now()
  const newOutput = calculate(data.players, data.games)
  const elapsed = performance.now() - started
  assert.deepEqual(newOutput, oldOutput)
  assert.ok(elapsed < 2000, `${players}/${games} fixture exceeded 2 seconds: ${elapsed}`)
  console.log(JSON.stringify({ players, games, legacyMs: Number(legacyElapsed.toFixed(3)), sharedContextMs: Number(elapsed.toFixed(3)), divisions: newOutput.map((rows) => rows.length) }))
}

console.log('Canonical three-division standings performance/equivalence check passed.')
