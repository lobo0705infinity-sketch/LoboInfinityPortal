import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const gameDetails = read('src/pages/GameDetails.tsx')
const recentGamesApi = read('backend/RecentGames.gs')

const checks = [
  {
    label: 'Battle Report renders approved Battle Highlight language',
    pass:
      !gameDetails.includes('Best Moment Hero') &&
      gameDetails.includes('title="Battle Highlight"') &&
      gameDetails.includes('NO BATTLE HIGHLIGHT') &&
      gameDetails.includes('No memorable moment was submitted for this battle.'),
  },
  {
    label: 'Battle Report uses shared OperatorBadge component',
    pass:
      gameDetails.includes("import OperatorBadge from '../components/OperatorBadge'") &&
      gameDetails.includes('<OperatorBadge'),
  },
  {
    label: 'Battle Report does not use generic score formatter for TP/OP/VP',
    pass:
      !gameDetails.includes('formatTournamentScore(game)') &&
      !gameDetails.includes('formatObjectiveScore(game)') &&
      !gameDetails.includes('formatVictoryScore(game)') &&
      gameDetails.includes('buildScores(game)') &&
      gameDetails.includes("{ label: 'TP' as const") &&
      gameDetails.includes("{ label: 'OP' as const") &&
      gameDetails.includes("{ label: 'VP' as const"),
  },
  {
    label: 'Battle Report missing score fields render as Not recorded',
    pass:
      gameDetails.includes("left = 'Not recorded'") &&
      gameDetails.includes("right = 'Not recorded'") &&
      splitScoreValue('').left === 'Not recorded' &&
      splitScoreValue(undefined).right === 'Not recorded',
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

function splitScoreValue(score) {
  const value = String(score ?? '').trim()
  const [left = 'Not recorded', right = 'Not recorded'] = value ? value.split('-') : []

  return {
    left: left.trim() || 'Not recorded',
    right: right.trim() || 'Not recorded',
  }
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}
