import { readFileSync } from 'node:fs'

const checks = []

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function check(label, condition) {
  checks.push({ label, condition })
}

const submitResult = read('src/pages/SubmitResult.tsx')
const gameDetails = read('src/pages/GameDetails.tsx')
const dashboard = read('src/pages/Dashboard.tsx')
const recentGames = read('backend/RecentGames.gs')
const gameEngine = read('backend/GameEngine.gs')
const resultSubmission = read('backend/ResultSubmissionApi.gs')
const playersApi = read('backend/PlayersApi.gs')
const apiTypes = read('src/services/api.ts')
const gameResults = read('src/services/gameResults.ts')

check(
  'Submit Game uses Game Result label',
  (submitResult.match(/label="Game Result"/g) || []).length >= 3,
)
check(
  'Submit Game validation no longer reports Winner is required',
  !submitResult.includes('Winner is required.') &&
    !submitResult.includes('Winner must match the submitted TP, OP, and VP scores.'),
)
check(
  'Backend submission preserves player/opponent armies for draws',
  (resultSubmission.match(/resultIsDraw \|\| playerIsWinner/g) || []).length >= 4,
)
check(
  'Recent game payload exposes gameResult',
  recentGames.includes('gameResult:') && recentGames.includes('function getRecentGameResult'),
)
check(
  'Game Engine analytics keeps both player rows for draws',
  gameEngine.includes('const draw = winner === 0') &&
    gameEngine.includes('winnerPlayer = row[FORM.PLAYER1]') &&
    gameEngine.includes('loserPlayer = row[FORM.PLAYER2]'),
)
check(
  'Frontend RecentGame type carries gameResult',
  apiTypes.includes('gameResult?: string') &&
    apiTypes.includes("gameResult: getString(record, 'gameResult') || undefined"),
)
check(
  'Shared game result helper detects and labels draws',
  gameResults.includes('export function isDrawGame') &&
    gameResults.includes('battled to a draw') &&
    gameResults.includes('fought to a draw'),
)
check(
  'Battle Report renders a draw result state',
  gameDetails.includes("isDraw ? 'Draw' : 'Defeated'") &&
    gameDetails.includes('getGameTimelineResult(game)'),
)
check(
  'Dashboard uses draw-aware headlines',
  dashboard.includes('getGameHeadline(game)') &&
    dashboard.includes("isDraw ? 'draw' : 'defeated'"),
)
check(
  'Player career records include draws in games played',
  playersApi.includes('return game.result === "D";') &&
    playersApi.includes('wins + losses + draws') &&
    playersApi.includes('draws: draws'),
)

const failed = checks.filter((item) => !item.condition)

if (failed.length > 0) {
  console.error('Draw support regression check failed:')
  for (const item of failed) {
    console.error(`- ${item.label}`)
  }
  process.exit(1)
}

console.log(`Draw support regression check passed (${checks.length} checks).`)
