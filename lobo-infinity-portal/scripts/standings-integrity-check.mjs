import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const config = read('backend/Config.gs')
const gameEngine = read('backend/GameEngine.gs')
const standings = read('backend/Standings.gs')
const leagueData = read('backend/LeagueData.gs')
const dashboard = read('backend/Dashboard.gs')

assert.match(
  gameEngine,
  /"Game Type",\s*"Game Result"/s,
  'Game Engine header must include Game Result after Game Type.',
)

assert.match(
  gameEngine,
  /getGameEngineGameType\(row\),\s*gameResult/s,
  'Game Engine rows must write Game Result in the same position as the header.',
)

assert.match(
  gameEngine,
  /getGameAnalyticsHeaders\(\)[\s\S]*"Game Type",\s*"Game Result"/,
  'Game Analytics header must include Game Result after Game Type.',
)

assert.match(
  gameEngine,
  /function buildAnalyticsRow[\s\S]*getGameEngineGameType\(row\),\s*gameResult/s,
  'Game Analytics rows must write Game Result in the same position as the header.',
)

assert.match(
  gameEngine,
  /row\.length !== width/,
  'Derived sheet writes must validate rectangular rows before clearing existing data.',
)

assert.match(
  config,
  /DRAWS:\s*5,\s*TP:\s*6,\s*OP:\s*7,\s*VP:\s*8/s,
  'Standings column indexes must keep Draws between Losses and TP.',
)

assert.match(
  standings,
  /"Losses",\s*"Draws",\s*"TP",\s*"OP",\s*"VP"/s,
  'Standings header must preserve Games/Wins/Losses and add Draws before TP/OP/VP.',
)

assert.match(
  standings,
  /player\.games,\s*player\.wins,\s*player\.losses,\s*player\.draws,\s*player\.tp,\s*player\.op,\s*player\.vp/s,
  'Standings rows must preserve Games/Wins/Losses/TP/OP/VP while adding Draws.',
)

assert.match(
  standings,
  /player\.tp \+=\s*Number\(\s*game\[CONFIG\.ENGINE\.TP\]\s*\) \|\| 0/s,
  'Standings aggregation must continue reading TP from CONFIG.ENGINE.TP.',
)

assert.match(
  standings,
  /player\.op \+=\s*Number\(\s*game\[CONFIG\.ENGINE\.OP\]\s*\) \|\| 0/s,
  'Standings aggregation must continue reading OP from CONFIG.ENGINE.OP.',
)

assert.match(
  standings,
  /player\.vp \+=\s*Number\(\s*game\[CONFIG\.ENGINE\.VP\]\s*\) \|\| 0/s,
  'Standings aggregation must continue reading VP from CONFIG.ENGINE.VP.',
)

assert.match(
  leagueData,
  /return rowEventId === scope/,
  'League standings must continue filtering by event scope after loading Game Engine rows.',
)

assert.match(
  dashboard,
  /buildStandingsResponse\(\s*getStandingsDivisionConfig\("main"\),\s*dashboardContext\s*\)/s,
  'Dashboard Current Leader must share the current event Main Man standings source.',
)

assert.doesNotMatch(
  dashboard,
  /getSheetByName\(CONFIG\.SHEETS\.MAIN_MAN\)/,
  'Dashboard Current Leader must not read the legacy Main Man Standings sheet.',
)

assert.match(
  standings,
  /if \(b\.tp !== a\.tp\)[\s\S]*return b\.tp - a\.tp;[\s\S]*if \(b\.op !== a\.op\)[\s\S]*return b\.op - a\.op;[\s\S]*if \(b\.vp !== a\.vp\)[\s\S]*return b\.vp - a\.vp;[\s\S]*return a\.player\.localeCompare/s,
  'Standings sort order must remain TP, OP, VP, then player name.',
)

console.log('standings integrity checks passed')
