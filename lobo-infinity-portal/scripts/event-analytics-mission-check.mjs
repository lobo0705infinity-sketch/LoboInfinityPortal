import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const eventAnalytics = readFileSync('backend/EventAnalyticsApi.gs', 'utf8')
const teamTournament = readFileSync('backend/TeamTournamentApi.gs', 'utf8')

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

const sandbox = {
  canonicalizeArmyName: (value) => String(value || ''),
  getEventAnalyticsResults: () => sandbox.results,
  getEventAnalyticsString: (value) => value == null ? '' : String(value).trim(),
  results: [],
}
vm.createContext(sandbox)
vm.runInContext(
  [
    extractFunction(teamTournament, 'getTeamTournamentString'),
    extractFunction(teamTournament, 'teamTournamentSameValue'),
    extractFunction(teamTournament, 'parseTeamTournamentScore'),
    extractFunction(eventAnalytics, 'getEventAnalyticsTopKey'),
    extractFunction(eventAnalytics, 'getEventAnalyticsWinningScore_'),
    extractFunction(eventAnalytics, 'getEventAnalyticsMissions'),
  ].join('\n'),
  sandbox,
)

const playerWinner = {
  player: 'Alpha', opponent: 'Beta', winner: 'Alpha',
  tournamentPoints: '5-2', objectivePoints: '10-7', victoryPoints: '250-175',
}
const opponentWinner = {
  player: 'Alpha', opponent: 'Beta', winner: 'beta',
  tournamentPoints: '2-5', objectivePoints: '7-10', victoryPoints: '175-250',
}
for (const [field, expected] of [
  ['tournamentPoints', 5],
  ['objectivePoints', 10],
  ['victoryPoints', 250],
]) {
  assert.equal(sandbox.getEventAnalyticsWinningScore_(playerWinner, field), expected)
  assert.equal(sandbox.getEventAnalyticsWinningScore_(opponentWinner, field), expected)
}

const outbreak = [
  ['PinkFox', 'Chainsaw', 'PinkFox', '5-0', '10-4', '224-235', 'pinkfox'],
  ['Diabloknk', 'Denscott', 'Diabloknk', '5-0', '10-1', '269-168', 'Diabloknk'],
  ['xtapro', 'Zhukov2', 'xtapro', '5-2', '8-6', '184-64', 'xtapro'],
  ['Defuser', 'King Butt', 'King Butt', '2-5', '6-7', '146-203', 'King Butt'],
  ['brickwarrior', 'THE FLOOP DROOPSBY', 'brickwarrior', '5-0', '9-1', '217-93', 'brickwarrior'],
  ['KaktusGalaxus', 'Nighthawkmk2', 'Nighthawkmk2', '0-5', '0-10', '144-300', 'KaktusGalaxus'],
].map(([player, opponent, winner, tournamentPoints, objectivePoints, victoryPoints, firstTurn]) => ({
  player, opponent, winner, tournamentPoints, objectivePoints, victoryPoints, firstTurn,
  mission: 'Outbreak', winningFaction: 'Faction', status: 'Submitted', updatedAt: '2026-08-19',
}))

sandbox.results = outbreak
const summary = sandbox.getEventAnalyticsMissions({ isLeague: false, eventId: 'event-tournament' })[0]
assert.equal(summary.games, 6)
assert.equal(summary.averageTP, 5)
assert.equal(summary.averageOP, 9)
assert.ok(Math.abs(summary.averageVP - 232.83333333333334) < 1e-10)
assert.ok(Math.abs(summary.firstTurnWinRate - 83.33333333333334) < 1e-10)

sandbox.results = [
  { ...outbreak[0], firstTurn: '' },
  { ...outbreak[1], firstTurn: 'denscott' },
]
const denominator = sandbox.getEventAnalyticsMissions({ isLeague: false, eventId: 'event-tournament' })[0]
assert.equal(denominator.firstTurnWinRate, 0, 'blank first-turn data must be excluded from the denominator')

assert.match(
  eventAnalytics,
  /if \(context\.isLeague\)\s+return buildMissionApiSummaries/,
  'League missions must continue using their existing separate calculation path.',
)
assert.doesNotMatch(
  extractFunction(eventAnalytics, 'getEventAnalyticsMissions'),
  /Number\(result\.(tournamentPoints|objectivePoints|victoryPoints)\)/,
  'Paired scores must not be coerced directly to scalar numbers.',
)

console.log('event analytics mission checks passed')
