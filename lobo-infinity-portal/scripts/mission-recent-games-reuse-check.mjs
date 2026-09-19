import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const missionApi = readFileSync('backend/MissionApi.gs', 'utf8')

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`Missing function ${name}`)
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error(`Unterminated function ${name}`)
}

const functions = [
  'buildMissionApiSummaries',
  'buildMissionApiSummary',
  'getMissionAverage',
  'getMissionFirstTurnWinRate',
  'getMissionMostSuccessfulFaction',
  'getMissionRecentGames',
  'getMissionLastPlayed',
]

const recentGames = [
  { id: 14, mission: 'Alpha', date: '2026-08-14', player: 'Display Alpha' },
  { id: 13, mission: 'Beta', date: '2026-08-13', player: 'Display Beta' },
  { id: 12, mission: 'Alpha', date: '2026-08-12', player: 'Display Gamma' },
  { id: 11, mission: 'Alpha', date: '2026-08-11', player: 'Display Delta' },
  { id: 10, mission: 'Alpha', date: '2026-08-10', player: 'Display Epsilon' },
  { id: 9, mission: 'Alpha', date: '2026-08-09', player: 'Display Zeta' },
  { id: 8, mission: 'Alpha', date: '2026-08-08', player: 'Outside Limit' },
]

function makeMission(name, games) {
  return {
    mission: name,
    games,
    winnerTP: games * 5,
    winnerOP: games * 8,
    winnerVP: games * 250,
    firstPlayerWins: games,
    factions: { Faction: { wins: games, losses: 0, draws: 0 } },
  }
}

let physicalLoads = 0
const sandbox = {
  MISSION_PROFILE_RECENT_GAMES_LIMIT: 5,
  buildMissionRegistry: () => ({}),
  getAllRecentGameObjects: () => {
    physicalLoads += 1
    return recentGames
  },
  getLeagueDataForEvent: () => [],
  updateMissionRegistry: (registry) => {
    registry.Alpha = makeMission('Alpha', 6)
    registry.Beta = makeMission('Beta', 1)
  },
  getTopThreeWinningFactions: () => 'Faction (6-0)',
  roundMission: (value) => Math.round(value * 100) / 100,
}

vm.createContext(sandbox)
vm.runInContext(functions.map((name) => extractFunction(missionApi, name)).join('\n'), sandbox)

function oldProjection() {
  return ['Alpha', 'Beta'].map((name) => {
    const mission = makeMission(name, name === 'Alpha' ? 6 : 1)
    const games = recentGames.filter((game) => game.mission === name).slice(0, 5)
    return {
      mission: mission.mission,
      games: mission.games,
      averageTP: 5,
      averageOP: 8,
      averageVP: 250,
      firstTurnWinRate: 100,
      mostSuccessfulFaction: 'Faction',
      lastPlayed: games[0]?.date ?? '',
    }
  })
}

for (const scope of [
  ['Current League', 'event-current-league', 'league'],
  ['Casual', 'all', 'casual'],
  ['All Games', 'all', 'all'],
]) {
  physicalLoads = 0
  const actual = JSON.parse(JSON.stringify(sandbox.buildMissionApiSummaries(scope[1], scope[2])))
  assert.deepEqual(actual, oldProjection(), `${scope[0]} response must remain semantically exact`)
  assert.equal(physicalLoads, 1, `${scope[0]} must physically load Recent Game data once`)
}

physicalLoads = 0
const alphaRecent = JSON.parse(JSON.stringify(sandbox.getMissionRecentGames('Alpha', recentGames)))
assert.deepEqual(alphaRecent, recentGames.filter((game) => game.mission === 'Alpha').slice(0, 5))
assert.equal(physicalLoads, 0, 'Preloaded Recent Game data must be reused by reference')

const tournamentFunction = extractFunction(
  readFileSync('backend/EventAnalyticsApi.gs', 'utf8'),
  'getEventAnalyticsMissions',
)
assert.match(tournamentFunction, /if \(context\.isLeague\)[\s\S]*buildMissionApiSummaries/)
assert.match(tournamentFunction, /getEventAnalyticsResults\(context\.eventId\)/)
assert.doesNotMatch(
  tournamentFunction.slice(tournamentFunction.indexOf('const missions = {}')),
  /buildMissionApiSummaries|getAllRecentGameObjects/,
  'Team Tournament must retain its distinct Event Analytics path',
)

assert.match(missionApi, /const allRecentGames\s*=\s*getAllRecentGameObjects\(\)/)
assert.match(missionApi, /buildMissionApiSummary\(\s*mission,\s*allRecentGames\s*\)/)
assert.match(missionApi, /getMissionRecentGames\(\s*mission\.mission,\s*allRecentGames\s*\)/)

console.log('mission recent-game request-local reuse checks passed')
