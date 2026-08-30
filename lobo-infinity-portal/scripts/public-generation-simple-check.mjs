import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'

const foundation = fs.readFileSync('backend/PublicGenerationFoundation.gs', 'utf8')
const simple = fs.readFileSync('backend/PublicGenerationSimple.gs', 'utf8')
const api = fs.readFileSync('backend/API.gs', 'utf8')

assert.match(simple, /function runBuildSimplePublicGenerationCandidate\(\)/)
assert.match(simple, /function buildSimplePublicPlayers_\(/)
assert.match(simple, /function buildSimplePublicGames_\(/)
assert.match(simple, /function buildSimplePublicEvents_\(/)
assert.match(simple, /function buildSimplePublicMissions_\(/)
assert.match(simple, /function buildSimplePublicFactions_\(/)
assert.match(simple, /function buildSimplePublicStandings_\(/)
assert.doesNotMatch(api, /runBuildSimplePublicGenerationCandidate/)
assert.doesNotMatch(simple, /processAutomationQueueBatch|rebuildGameEngine|decodeArmy|refreshArmyIntelligence/)
assert.doesNotMatch(simple, /PublicPlayersProjection|PublicLeagueWorkspaceProjection|PublicDetailProjection/)
assert.doesNotMatch(simple, /getStandings|rebuildStandings|PUBLIC_LEAGUE_WORKSPACE|PUBLIC_ANALYTICS/)
assert.doesNotMatch(simple, /doGet|doPost|requireApiPermission|UrlFetchApp/)

const FORM = {
  DATE: 2, DIVISION: 1, MISSION: 3, PLAYER1: 4, PLAYER2: 5,
  P1TP: 6, P2TP: 7, P1OP: 8, P2OP: 9, P1VP: 10, P2VP: 11,
  FIRSTTURN: 12, WINNINGFACTION: 13, LOSINGFACTION: 14, MOMENT: 15,
  EVENT_ID: 16, GAME_TYPE: 17, GAME_RESULT: 18,
  WINNER_ARMY_LIST_ID: 21, LOSER_ARMY_LIST_ID: 22,
}
const sandbox = {
  console, Date, JSON, Math, Number, Object, String, FORM,
  EVENT_ENGINE_DEFAULT_EVENT_ID: 'event-current-league',
  TOP40_PUBLIC_EVENT_ID: 'event-lobo-s-american-top-40',
  EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID: 'event-august-2026-team-tournament',
  CONFIG: { DIVISIONS: { MAIN_MAN: 'Main Man', PGA: 'Proving Grounds A', PGB: 'Proving Grounds B' } },
  normalizeGameType: (value) => ['tournament', 'casual', 'narrative'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'league',
  determineWinner: (row) => row[FORM.GAME_RESULT] === 'Player 2' ? 2 : row[FORM.GAME_RESULT] === 'Draw' ? 0 : 1,
  getPlayerRegistryColumns: () => ({ player: 0, displayName: 1, division: 2, active: 3 }),
  normalizePublicGenerationValue_: (value) => String(value ?? ''),
  stablePublicGenerationJson_: (value) => JSON.stringify(value, Object.keys(value).sort()),
  sha256PublicGenerationText_: (text) => crypto.createHash('sha256').update(text).digest('hex'),
  parsePublicGenerationJson_: (value, fallback) => { try { return JSON.parse(String(value || '')) } catch { return fallback } },
  Utilities: { formatDate: (date, _zone, pattern) => pattern === 'yyyy-MM' ? date.toISOString().slice(0, 7) : date.toISOString() },
  assertNoForbiddenPublicGenerationKeys_(value, path) {
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
      if (['armycode', 'auth', 'commissioner', 'credential', 'email', 'password', 'private', 'secret', 'session', 'token', 'webhook']
        .some((forbidden) => normalized.includes(forbidden))) throw new Error(`forbidden key ${path}.${key}`)
      sandbox.assertNoForbiddenPublicGenerationKeys_(child, `${path}.${key}`)
    }
  },
}
vm.createContext(sandbox)

const functionNames = [
  'simplePublicGenerationColumns_', 'simplePublicGenerationValue_',
  'normalizeSimplePublicPlayerIdentity_', 'buildSimplePublicPlayerIdentityIndex_',
  'resolveSimplePublicPlayerIdentity_',
  'buildSimplePublicGameContext_',
  'buildSimplePublicGames_', 'buildSimplePublicPlayers_', 'addSimplePublicPlayerGame_',
  'compareSimplePublicPlayerRecords_', 'mostFrequentSimplePublicValue_',
  'finalizeSimplePublicPlayer_', 'buildSimplePublicMetric_',
  'buildSimplePublicMetricGroup_',
  'calculateSimplePublicLongestWinStreak_', 'calculateSimplePublicGamesThisMonth_',
  'buildSimplePublicAvailabilityMap_', 'buildSimplePublicRegistrationMap_',
  'buildSimplePublicEvents_',
  'simplePublicPercentage_', 'simplePublicAverage_', 'simplePublicMostFrequent_',
  'simplePublicGameReferences_', 'buildSimplePublicMissions_',
  'addSimplePublicFactionResult_', 'summarizeSimplePublicFactionResults_',
  'buildSimplePublicFactions_', 'isSimplePublicCurrentLeagueGame_',
  'buildSimplePublicStandings_',
]
for (const name of functionNames) {
  const start = simple.indexOf(`function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  let depth = 0; let began = false; let end = start
  for (; end < simple.length; end += 1) {
    if (simple[end] === '{') { depth += 1; began = true }
    if (simple[end] === '}') depth -= 1
    if (began && depth === 0) { end += 1; break }
  }
  vm.runInContext(simple.slice(start, end), sandbox)
}

const headers = ['Timestamp', 'Division', 'Date', 'Mission', 'Player 1', 'Player 2',
  'Player 1 TP', 'Player 2 TP', 'Player 1 OP', 'Player 2 OP', 'Player 1 VP', 'Player 2 VP',
  'First Turn', 'Winning Faction', 'Losing Faction', 'Best Moment', 'Event ID', 'Game Type',
  'Game Result', 'Player 1 Army Code', 'Player 2 Army Code', 'Winner Army List ID', 'Loser Army List ID']
function gameRow(id, division, date, mission, player1, player2, p1tp, p2tp, p1op, p2op,
  p1vp, p2vp, faction1, faction2, result = 'Player 1', eventId = 'event-current-league', gameType = 'League') {
  const row = ['', division, date, mission, player1, player2, p1tp, p2tp, p1op, p2op, p1vp, p2vp,
    'Player 1', faction1, faction2, `Moment ${id}`, eventId, gameType, result,
    `SECRET-${id}-A`, `SECRET-${id}-B`, '', '']
  row.gameId = id
  return row
}
const game73 = gameRow(73, 'Main Man', '2026-08-29', "Dead Man's Switch", 'Lobo', 'Nighthawkmk2',
  5, 0, 8, 1, 262, 122, 'Corregidor Jurisdictional Command', 'Shindenbutai')
game73[21] = '3296098999'; game73[22] = '4483300877'
const gameRows = Array.from({ length: 73 }, (_, index) => gameRow(
  index + 1, 'Community', '2026-07-01', 'Casual Mission', 'Vision',
  'Igor Your Humble Servant', 3, 1, 6, 3, 180, 120, 'Nomads', 'PanOceania',
  'Player 1', 'event-current-league', 'Casual'
))
for (const row of [
  gameRow(21, 'Main Man', '2026-08-01', 'Supplies', 'Lobo', 'Vision', 5, 0, 7, 2, 200, 100, 'Corregidor Jurisdictional Command', 'Nomads'),
  gameRow(27, 'Main Man', '2026-08-05', 'Looting and Sabotaging', 'Lobo', 'Igor Your Humble Servant', 5, 0, 7, 2, 200, 100, 'Corregidor Jurisdictional Command', 'PanOceania'),
  gameRow(40, 'Main Man', '2026-08-12', 'Supremacy', 'Lobo', 'Vision', 5, 0, 7, 2, 200, 100, 'Corregidor Jurisdictional Command', 'Nomads'),
  gameRow(67, 'Main Man', '2026-08-25', 'Firefight', 'Lobo', 'Igor Your Humble Servant', 5, 0, 8, 2, 213, 100, 'Corregidor Jurisdictional Command', 'PanOceania'),
  game73,
  gameRow(22, 'Main Man', '2026-08-02', 'Supplies', 'Nighthawkmk2', 'Vision', 5, 0, 8, 2, 200, 100, 'Shindenbutai', 'Nomads'),
  gameRow(30, 'Main Man', '2026-08-06', 'Supremacy', 'Nighthawkmk2', 'Igor Your Humble Servant', 5, 0, 8, 2, 200, 100, 'Shindenbutai', 'PanOceania'),
  gameRow(32, 'Proving Grounds A', '2026-07-13', 'Area of Interest', '  blitchga ', 'ZHUKOV2  ', 5, 0, 8, 2, 200, 100, 'Operations Subsection', 'Oban'),
  gameRow(50, 'Main Man', '2026-08-18', 'Firefight', 'Vision', 'Nighthawkmk2', 5, 1, 8, 4, 250, 214, 'Nomads', 'Shindenbutai'),
  gameRow(60, 'Main Man', '2026-08-20', 'Casual Mission', 'Lobo', 'Vision', 5, 0, 10, 0, 300, 0, 'Corregidor Jurisdictional Command', 'Nomads', 'Player 1', 'event-current-league', 'Casual'),
  gameRow(61, 'Proving Grounds A', '2026-08-21', 'Draw Mission', 'PG Alpha', 'PG Beta', 2, 2, 5, 5, 150, 150, 'Ariadna', 'Haqqislam', 'Draw')
]) gameRows[row.gameId - 1] = row
const frozen = {
  gamesTable: { headers, rows: gameRows },
  playersTable: { headers: ['Player', 'Display Name', 'Division', 'Active'], rows: [
    ['Lobo', 'Lobo', 'Main Man', 'true'],
    ['Nighthawkmk2', 'Nighthawkmk2', 'Main Man', 'true'],
    ['Vision', 'Vision', 'Main Man', 'true'],
    ['Igor Your Humble Servant', 'Igor Your Humble Servant', 'Main Man', 'true'],
    ['PG Alpha', 'PG Alpha', 'Proving Grounds A', 'true'],
    ['PG Beta', 'PG Beta', 'Proving Grounds A', 'true'],
    ['PG Gamma', 'PG Gamma', 'Proving Grounds B', 'true'],
    ['Blitchga', 'Blitchga', 'Proving Grounds A', 'true'],
    ['Zhukov2', 'Zhukov2', 'Proving Grounds A', 'true'],
  ] },
  eventsTable: { headers: ['ID', 'Name', 'Type', 'Status', 'Commissioners', 'Owner', 'Permissions', 'Automation', 'Private Notes'], rows: [
    ['event-current-league', 'League', 'League', 'Active', 'Secret', 'Secret', 'Secret', 'Secret', 'Secret'],
    ['event-lobo-s-american-top-40', 'Top 40', 'Tournament', 'Active', 'Secret', '', '', '', ''],
    ['event-august-2026-team-tournament', 'Team Tournament', 'Tournament', 'Active', 'Secret', '', '', '', ''],
  ] },
  participantsTable: { headers: ['Event ID', 'Player'], rows: [] },
  availabilityTable: { headers: ['Player', 'City', 'Home Store'], rows: [] },
}
sandbox.sanitizePublicGenerationGame_ = (row, index) => ({
  gameId: index - 1, date: row[2], division: row[1], mission: row[3], player1: row[4], player2: row[5],
  player1Faction: row[13], player2Faction: row[14], player1ArmyListId: row[21], player2ArmyListId: row[22],
  player1Tp: Number(row[6]), player2Tp: Number(row[7]), player1Op: Number(row[8]), player2Op: Number(row[9]),
  player1Vp: Number(row[10]), player2Vp: Number(row[11]),
  winner: row[18] === 'Draw' ? 'Draw' : row[18] === 'Player 2' ? row[5] : row[4], eventId: row[16], gameType: row[17],
})

const identityIndex = sandbox.buildSimplePublicPlayerIdentityIndex_(frozen)
const context = sandbox.buildSimplePublicGameContext_(frozen, identityIndex)
const events = sandbox.buildSimplePublicEvents_(frozen, context)
const players = sandbox.buildSimplePublicPlayers_(frozen, events, context)
const games = sandbox.buildSimplePublicGames_(frozen, players, events, context)
const missions = sandbox.buildSimplePublicMissions_(context)
const factions = sandbox.buildSimplePublicFactions_(context, players)
const standings = sandbox.buildSimplePublicStandings_(frozen, players, context)
assert.equal(players.length, 9)
assert.equal(games.length, 73)
const game32 = games.find((game) => game.id === 32)
assert.equal(game32.winner, 'Blitchga')
assert.equal(game32.loser, 'Zhukov2')
assert.equal(game32.winnerDisplayName, 'Blitchga')
assert.equal(game32.loserDisplayName, 'Zhukov2')
const playerIds = new Set(players.map((player) => player.player))
assert.equal(context.filter((game) => playerIds.has(game.player1) && playerIds.has(game.player2)).length, 73)
const unresolved = games.filter((game) => game.winner !== 'Draw' &&
  (!playerIds.has(game.winner) || !playerIds.has(game.loser)))
assert.deepEqual(unresolved, [])
const persistedGame73 = games.find((game) => game.id === 73)
assert.ok(persistedGame73)
assert.equal(persistedGame73.winnerArmyListId, '3296098999')
assert.equal(persistedGame73.loserArmyListId, '4483300877')
assert.equal('winnerArmyCode' in persistedGame73, false)
assert.equal('loserArmyCode' in persistedGame73, false)
assert.equal(persistedGame73.winner, 'Lobo')
assert.equal(persistedGame73.loser, 'Nighthawkmk2')
assert.equal(events.length, 3)
for (const event of events) {
  for (const forbidden of ['commissioners', 'owner', 'permissions', 'automation', 'history', 'privateNotes'])
    assert.equal(forbidden in event, false)
}
sandbox.assertNoForbiddenPublicGenerationKeys_({ players, games, events, missions, factions, standings }, 'simple')

const mainMan = standings.find((division) => division.division === 'Main Man')
const lobo = mainMan.standings.find((row) => row.player === 'Lobo')
assert.deepEqual(JSON.parse(JSON.stringify(lobo)), {
  rank: 1, player: 'Lobo', displayName: 'Lobo', games: 5, wins: 5, losses: 0, draws: 0,
  tp: 25, op: 37, vp: 1075,
})
const night = mainMan.standings.find((row) => row.player === 'Nighthawkmk2')
assert.deepEqual(JSON.parse(JSON.stringify(night)), {
  rank: 2, player: 'Nighthawkmk2', displayName: 'Nighthawkmk2', games: 4, wins: 2, losses: 2, draws: 0,
  tp: 11, op: 21, vp: 736,
})
assert.equal(standings.length, 3)
const drawRows = standings.find((division) => division.division === 'Proving Grounds A').standings
assert.equal(drawRows.find((row) => row.player === 'PG Alpha').draws, 1)
assert.equal(drawRows.find((row) => row.player === 'PG Beta').draws, 1)
assert.ok(missions.find((mission) => mission.mission === "Dead Man's Switch").recentGames.some((game) => game.id === 73))
assert.ok(factions.find((faction) => faction.name === 'Corregidor Jurisdictional Command').recentGames.some((game) => game.id === 73))
assert.ok(factions.find((faction) => faction.name === 'Shindenbutai').recentGames.some((game) => game.id === 73))
for (const row of standings) assert.equal('event' in row, false)
assert.deepEqual(Object.keys(missions[0]).sort(), [
  'averageOP', 'averageTP', 'averageVP', 'bestMoments', 'divisionBreakdown', 'firstTurnWinRate',
  'games', 'lastPlayed', 'mission', 'mostPlayedFaction', 'mostSuccessfulFaction', 'recentGames',
].sort())
assert.deepEqual(Object.keys(factions[0]).sort(), [
  'averageOP', 'averageTP', 'averageVP', 'bestMoments', 'divisionBreakdown', 'draws', 'games',
  'lastPlayed', 'losses', 'matchupSummary', 'matchups', 'mostPlayedMission', 'name', 'recentGames',
  'topPlayer', 'topPlayerDisplayName', 'winRate', 'wins',
].sort())
assert.deepEqual(Object.keys(standings[0]).sort(), [
  'activePlayers', 'division', 'divisionLabel', 'eventId', 'gamesPlayed', 'players', 'standings',
].sort())
assert.deepEqual(Object.keys(standings[0].standings[0]).sort(), [
  'displayName', 'draws', 'games', 'losses', 'op', 'player', 'rank', 'tp', 'vp', 'wins',
].sort())

// Frozen cutoff and determinism: post-capture mutation cannot enter the existing G.
const frozenCopy = structuredClone(frozen)
const first = JSON.stringify({
  context: sandbox.buildSimplePublicGameContext_(frozenCopy),
  events: sandbox.buildSimplePublicEvents_(frozenCopy, sandbox.buildSimplePublicGameContext_(frozenCopy)),
})
frozen.gamesTable.rows.push([...game73.slice(0, 4), 'Later', 'Player', ...game73.slice(6)])
const second = JSON.stringify({
  context: sandbox.buildSimplePublicGameContext_(frozenCopy),
  events: sandbox.buildSimplePublicEvents_(frozenCopy, sandbox.buildSimplePublicGameContext_(frozenCopy)),
})
assert.equal(first, second)

const unmatched = structuredClone(frozen)
unmatched.gamesTable.rows[31][4] = 'Missing Player'
assert.throws(
  () => sandbox.buildSimplePublicGameContext_(unmatched, sandbox.buildSimplePublicPlayerIdentityIndex_(unmatched)),
  /does not resolve to the Player Registry for Game 32/
)

// The owner path is isolated and explicitly unpublished.
assert.match(simple, /published: false/)
assert.match(simple, /livePointer: false/)
assert.doesNotMatch(simple, /PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY/)
assert.match(foundation, /function createImmutablePublicGenerationFile_/)

console.log('Simplified six-domain public generation regression passed.')
