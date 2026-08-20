import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const intelligence = readFileSync('backend/LeagueIntelligence.gs', 'utf8')
const recordsApi = readFileSync('backend/RecordsApi.gs', 'utf8')

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

const functionNames = [
  'getLeagueScoreParts',
  'buildGameInsight',
  'getHighestIndividualGameScore',
  'getLeagueIntelligenceGameResult',
  'getLongestGameResultStreak',
  'getBiggestVictories',
]

const sandbox = {
  INTELLIGENCE_LIMIT: 5,
  getPlayerDisplayName: (value) => String(value || ''),
  getRecentGameDate: (value) => new Date(`${value}T00:00:00Z`),
  formatGameSummary: (game) => `${game.winner} defeated ${game.loser}\n${game.op}\non ${game.mission}`,
}
vm.createContext(sandbox)
vm.runInContext(
  functionNames.map((name) => extractFunction(intelligence, name)).join('\n'),
  sandbox,
)

function game(id, date, winner, loser, tp, op, vp, gameResult = 'Player 1 Victory') {
  return { id, date, winner, loser, tp, op, vp, gameResult, mission: `Mission ${id}` }
}

const productionFixtures = [
  game(57, '2026-08-11', 'xtapro', 'Zhukov2', '5-2', '8-6', '184-64'),
  game(37, '2026-07-23', 'Erichagz', 'krazyglue04', '5-0', '10-0', '300-74'),
]
const highestVp = sandbox.getHighestIndividualGameScore(productionFixtures, 'vp', 'Individual VP')

const opFixtures = [
  game(1, '2026-01-01', 'Player A', 'Player B', '5-1', '10-9', '200-190'),
  game(2, '2026-01-02', 'Player C', 'Player D', '5-0', '8-0', '220-20'),
]
const highestOp = sandbox.getHighestIndividualGameScore(opFixtures, 'op', 'Individual OP')

function streakGames(player, results) {
  return results.map((result, index) => {
    const opponent = `Opponent ${index}`
    if (result === 'W') return game(index + 1, `2026-02-${String(index + 1).padStart(2, '0')}`, player, opponent, '5-0', '8-2', '200-100')
    if (result === 'L') return game(index + 1, `2026-02-${String(index + 1).padStart(2, '0')}`, opponent, player, '5-0', '8-2', '200-100')
    return game(index + 1, `2026-02-${String(index + 1).padStart(2, '0')}`, player, opponent, '2-2', '5-5', '150-150', 'Draw')
  })
}

const winStreak = sandbox.getLongestGameResultStreak(streakGames('Winner', ['W', 'W', 'L', 'W', 'W', 'W']), 'W')
const losingStreak = sandbox.getLongestGameResultStreak(streakGames('Loser', ['L', 'L', 'W', 'L', 'L', 'L']), 'L')
const drawWinStreak = sandbox.getLongestGameResultStreak(streakGames('Draw Break', ['W', 'W', 'D', 'W']), 'W')
const drawLossStreak = sandbox.getLongestGameResultStreak(streakGames('Draw Loss Break', ['L', 'L', 'D', 'L']), 'L')

const largestVictoryBefore = sandbox.getBiggestVictories(opFixtures)[0]

const checks = [
  ['Highest VP evaluates individual VP', highestVp.player === 'Erichagz' && highestVp.value === 300 && highestVp.id === 37],
  ['Combined OP is not interpreted as VP', highestVp.value !== 14],
  ['Highest OP evaluates individual OP, not margin', highestOp.player === 'Player A' && highestOp.value === 10],
  ['Longest win streak is consecutive, not career wins', winStreak.player === 'Winner' && winStreak.value === 3],
  ['Longest losing streak is consecutive, not career losses', losingStreak.player === 'Loser' && losingStreak.value === 3],
  ['Draw breaks a win streak', drawWinStreak.value === 2],
  ['Draw breaks a losing streak', drawLossStreak.value === 2],
  ['Largest Victory remains OP margin with VP tie-break metadata', largestVictoryBefore.value === 8 && largestVictoryBefore.label === 'OP Margin'],
  ['Record Book uses individual VP', recordsApi.includes('records.highestIndividualVP')],
  ['Record Book uses individual OP', recordsApi.includes('records.highestIndividualOP')],
  ['Record Book uses calculated win streak', recordsApi.includes('getLongestGameResultStreak(games, "W")')],
  ['Record Book uses calculated losing streak', recordsApi.includes('getLongestGameResultStreak(games, "L")')],
  ['Largest Victory wiring is unchanged', recordsApi.includes('buildRecordBookItem("Largest Victory", records.largestVPMargin)')],
]

let failed = false
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}`)
  failed ||= !passed
}

if (failed) process.exitCode = 1
