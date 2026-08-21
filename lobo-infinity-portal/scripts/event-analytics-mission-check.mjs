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
  getAllRecentGameObjectsForEvent: () => sandbox.recentGames,
  recentGames: [],
  results: [],
}
vm.createContext(sandbox)
vm.runInContext(
  [
    extractFunction(teamTournament, 'getTeamTournamentString'),
    extractFunction(teamTournament, 'normalizeTeamTournamentPlayerKey'),
    extractFunction(teamTournament, 'teamTournamentSameValue'),
    extractFunction(teamTournament, 'parseTeamTournamentScore'),
    extractFunction(teamTournament, 'teamTournamentCanonicalGamePlayerMatches_'),
    extractFunction(teamTournament, 'orientTeamTournamentCanonicalGameScore_'),
    extractFunction(teamTournament, 'buildTeamTournamentResultFromCanonicalGame_'),
    extractFunction(eventAnalytics, 'getEventAnalyticsTopKey'),
    extractFunction(eventAnalytics, 'getEventAnalyticsWinningScore_'),
    extractFunction(eventAnalytics, 'getEventAnalyticsMissions'),
    extractFunction(eventAnalytics, 'buildEventAnalyticsGames'),
    extractFunction(eventAnalytics, 'getEventAnalyticsProfileResults'),
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

const game61 = {
  id: 61,
  winner: 'Nighthawkmk2',
  winnerDisplayName: 'Nighthawkmk2',
  loser: 'KaktusGalaxus',
  loserDisplayName: 'KaktusGalaxus',
  winnerFaction: 'Operations Subsection',
  loserFaction: 'Tartary Army Corps',
  gameResult: 'Player 1 Victory',
  mission: 'Outbreak',
  tp: '5-0',
  op: '10-0',
  vp: '300-144',
  firstTurn: 'KaktusGalaxus',
  date: '2026-08-19',
}
const adapted61 = sandbox.buildTeamTournamentResultFromCanonicalGame_(
  'event-august-2026-team-tournament',
  { player: 'Nighthawkmk2', opponent: 'KaktusGalaxus', roundId: '1', round: '1', teamA: 'A', teamB: 'B', table: '1' },
  game61,
)
assert.equal(adapted61.winningFaction, 'Operations Subsection')
assert.equal(adapted61.losingFaction, 'Tartary Army Corps')

const projectedMatchups = sandbox.buildEventAnalyticsGames([
  ['PinkFox', 'Chainsaw', 'Operations Subsection', 'Torchlight Brigade'],
  ['Diabloknk', 'Denscott', 'Next Wave', 'O-12'],
  ['xtapro', 'Zhukov2', 'ALEPH', 'Qapu Khalqi'],
  ['King Butt', 'Defuser', 'Yu Jing', 'Force de Réponse Rapide Merovingienne'],
  ['brickwarrior', 'THE FLOOP DROOPSBY', 'Operations Subsection', 'Kestrel Colonial Force'],
  ['Nighthawkmk2', 'KaktusGalaxus', 'Operations Subsection', 'Tartary Army Corps'],
].map(([winner, loser, winningFaction, losingFaction]) => ({
  winner, player: winner, opponent: loser, winningFaction, losingFaction,
  tournamentPoints: '5-0', objectivePoints: '10-0', victoryPoints: '300-100',
  mission: 'Outbreak', status: 'Submitted', updatedAt: '2026-08-19',
})))
assert.deepEqual(
  projectedMatchups.map((game) => `${game.winnerFaction} vs ${game.loserFaction}`),
  [
    'Operations Subsection vs Torchlight Brigade',
    'Next Wave vs O-12',
    'ALEPH vs Qapu Khalqi',
    'Yu Jing vs Force de Réponse Rapide Merovingienne',
    'Operations Subsection vs Kestrel Colonial Force',
    'Operations Subsection vs Tartary Army Corps',
  ],
)
assert.ok(projectedMatchups.every((game) => game.loserFaction !== ''))

const casualMatchups = [
  [50, 'Lobo', 'Kiratze', 'Operations Subsection', 'Ramah Taskforce', 'Hardlock'],
  [49, 'Lobo', 'Retrofuturist', 'Corregidor Jurisdictional Command', 'Yu Jing', "Dead Man's Switch"],
  [48, 'Lobo', 'KharuS', 'Corregidor Jurisdictional Command', 'Military Orders', 'Corporate Appropriation'],
  [43, 'Fantasy', 'Sam', 'Tunguska Jurisdictional Command', 'Ramah Taskforce', 'Hardlock'],
  [42, 'Sam', 'Fantasy', 'Ramah Taskforce', 'Tunguska Jurisdictional Command', 'B-Pong'],
  [38, 'Sam', 'xtapro', 'Caledonian Highlander Army', 'Shasvastii Expeditionary Force', 'Corporate Appropriation'],
  [36, 'Lobo', 'ADangerousFrog', 'Operations Subsection', 'PanOceania', 'Neutralization'],
  [9, 'Lobo', 'Brooke', 'Operations Subsection', 'Next Wave', 'Neutralization'],
  [6, 'brickwarrior', 'EihaMagniese', 'Operations Subsection', 'Starmada', 'Provisioning'],
].map(([id, winner, loser, winnerFaction, loserFaction, mission]) => ({
  id, winner, loser, winnerFaction, loserFaction, mission,
  date: '2026-08-01', tp: '5-0', op: '9-2', vp: '201-221', firstTurn: winner,
}))
sandbox.recentGames = casualMatchups
const casualAdapterResults = sandbox.getEventAnalyticsProfileResults({
  isLeague: true,
  gameType: 'casual',
})
const casualRecentGames = sandbox.buildEventAnalyticsGames(casualAdapterResults)
assert.ok(casualRecentGames.every((game) => game.winnerFaction && game.loserFaction))
const deadMansSwitch = casualRecentGames.find((game) => game.mission === "Dead Man's Switch")
assert.equal(deadMansSwitch.winnerFaction, 'Corregidor Jurisdictional Command')
assert.equal(deadMansSwitch.loserFaction, 'Yu Jing')
assert.equal(deadMansSwitch.tp, '5-0')
assert.equal(deadMansSwitch.op, '9-2')
assert.equal(deadMansSwitch.vp, '201-221')

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
assert.doesNotMatch(
  extractFunction(eventAnalytics, 'buildEventAnalyticsGames'),
  /loserFaction:\s*""/,
  'Event Analytics must not manufacture a blank losing faction.',
)
assert.match(
  extractFunction(eventAnalytics, 'getEventAnalyticsProfileResults'),
  /losingFaction:\s*canonicalizeArmyName\(game\.loserFaction\)/,
  'Casual Event Analytics must preserve the canonical game-specific losing faction.',
)

console.log('event analytics mission checks passed')
