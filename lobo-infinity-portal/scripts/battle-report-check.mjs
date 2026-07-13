import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const gameDetails = read('src/pages/GameDetails.tsx')
const recentGamesApi = read('backend/RecentGames.gs')

const checks = [
  {
    label: 'Battle Report no longer renders Best Moment Hero',
    pass:
      !gameDetails.includes('Best Moment Hero') &&
      gameDetails.includes('<h2 id="best-moment-title">Best Moment</h2>'),
  },
  {
    label: 'Battle Report does not use generic score formatter for TP/OP/VP',
    pass:
      !gameDetails.includes('formatTournamentScore(game)') &&
      !gameDetails.includes('formatObjectiveScore(game)') &&
      !gameDetails.includes('formatVictoryScore(game)') &&
      gameDetails.includes('formatBattleReportScore(game.tp,') &&
      gameDetails.includes('formatBattleReportScore(game.op,') &&
      gameDetails.includes('formatBattleReportScore(game.vp,'),
  },
  {
    label: 'Battle Report missing score fields render as Not recorded',
    pass:
      gameDetails.includes('return `Not recorded ${label}`') &&
      formatBattleReportScore('', 'TP') === 'Not recorded TP' &&
      formatBattleReportScore(undefined, 'VP') === 'Not recorded VP',
  },
  {
    label: 'Battle Report exact lookup can use canonical Form Responses row',
    pass:
      recentGamesApi.includes('function buildRecentGameFromFormResponseId(gameId)') &&
      recentGamesApi.includes('getFormResponses()') &&
      recentGamesApi.includes('buildAnalyticsRow(') &&
      recentGamesApi.includes('buildRecentGameResponse(rawGame)'),
  },
  {
    label: 'Battle Report linked-news fallback is secondary to canonical form lookup',
    pass:
      recentGamesApi.indexOf('buildRecentGameFromFormResponseId(') <
      recentGamesApi.indexOf('buildRecentGameFromLinkedNews('),
  },
]

const failures = checks.filter((check) => !check.pass)

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

if (failures.length > 0) {
  process.exitCode = 1
}

function formatBattleReportScore(score, label) {
  const value = String(score ?? '').trim()

  if (!value) {
    return `Not recorded ${label}`
  }

  return `${value} ${label}`
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}
