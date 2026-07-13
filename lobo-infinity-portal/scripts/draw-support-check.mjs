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
const standingsApi = read('backend/StandingsApi.gs')
const standingsTable = read('src/components/StandingsTable.tsx')
const teamTournamentApi = read('backend/TeamTournamentApi.gs')
const teamTournamentPage = read('src/pages/TeamTournament.tsx')
const recordsApi = read('backend/RecordsApi.gs')
const hallOfFame = read('src/pages/HallOfFame.tsx')
const factionProfile = read('src/pages/FactionProfile.tsx')
const armyListApi = read('backend/ArmyListApi.gs')
const rivalries = read('src/pages/Rivalries.tsx')
const playerComparison = read('src/pages/PlayerComparison.tsx')

check(
  'Submit Game uses Game Result label',
  (submitResult.match(/label="Game Result"/g) || []).length >= 3,
)
check(
  'Submit Game validation no longer reports Winner is required',
  !submitResult.includes('Winner is required.') &&
    !submitResult.includes('Winner must match the submitted TP, OP, and VP scores.') &&
    !submitResult.includes('Game Result must match the submitted TP, OP, and VP scores.'),
)
check(
  'Submit Game stores explicit game result labels',
  submitResult.includes('Player 1 Victory') &&
    submitResult.includes('Player 2 Victory') &&
    resultSubmission.includes('row[FORM.GAME_RESULT]'),
)
check(
  'Backend submission preserves player/opponent armies for draws',
  (resultSubmission.match(/resultIsDraw \|\| playerIsWinner/g) || []).length >= 4,
)
check(
  'Recent game payload exposes gameResult',
  recentGames.includes('gameResult:') &&
    recentGames.includes('function getRecentGameResult') &&
    gameEngine.includes('"Game Result"'),
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
check(
  'League standings expose and render Draws',
  standingsApi.includes('draws: row[CONFIG.STANDINGS.DRAWS]') &&
    standingsTable.includes('<th scope="col">Draws</th>') &&
    standingsTable.includes('standing.draws'),
)
check(
  'Team Tournament standings include draws',
  teamTournamentApi.includes('let draws = 0') &&
    teamTournamentApi.includes('draws: draws') &&
    teamTournamentPage.includes('<th>D</th>') &&
    teamTournamentPage.includes('team.draws'),
)
check(
  'Hall of Fame includes Most Draws',
  recordsApi.includes('"draws"') &&
    hallOfFame.includes('Most Draws') &&
    apiTypes.includes('draws: HallOfFameLeader[]'),
)
check(
  'Faction matchups expose W-L-D',
  armyListApi.includes('matchup.draws') &&
    factionProfile.includes('summary.wins}-${summary.losses}-${summary.draws') &&
    factionProfile.includes('matchup.draws'),
)
check(
  'Head-to-head surfaces render draws',
  recordsApi.includes('draws: draws') &&
    apiTypes.includes('rightWins: number') &&
    apiTypes.includes('draws: number') &&
    playerComparison.includes('headToHead.draws') &&
    rivalries.includes('rivalry.leftWins}-${rivalry.rightWins}-${rivalry.draws'),
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
