import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/PublicSnapshotExporter.gs', 'utf8')
const api = fs.readFileSync('backend/API.gs', 'utf8')
assert.match(source, /function runBuildPublicSnapshotV1\(\)/)
assert.doesNotMatch(api, /runBuildPublicSnapshotV1/)
assert.doesNotMatch(source, /PublicGeneration|processAutomationQueueBatch|rebuildGameEngine|decodeArmy|refreshArmyIntelligence/)
assert.doesNotMatch(source, /PUBLIC_.*DIRTY|doGet|doPost|requireApiPermission/)
assert.match(source, /function runPublishPublicSnapshotV1Proof[\s\S]*UrlFetchApp\.fetch\(PUBLIC_SNAPSHOT_PUBLISH_URL/)
assert.match(source, /published: false/)
assert.match(source, /livePointer: false/)
assert.match(source, /duplicate Game ID/)
assert.doesNotMatch(source, /current\.json/)

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
  CONFIG: { DIVISIONS: { MAIN_MAN: 'Main Man', PGA: 'Proving Grounds A', PGB: 'Proving Grounds B' } },
  determineWinner: (row) => row[FORM.GAME_RESULT] === 'Player 2' ? 2 : row[FORM.GAME_RESULT] === 'Draw' ? 0 : 1,
  normalizeGameType: (value) => ['tournament', 'casual', 'narrative'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'league',
  getPlayerRegistryColumns: () => ({ player: 0, displayName: 1, division: 2, active: 3 }),
}
vm.createContext(sandbox)
const functions = [
  'normalizePublicSnapshotIdentity_', 'buildPublicSnapshotPlayerIndex_',
  'resolvePublicSnapshotParticipant_', 'buildPublicSnapshotGameContext_',
  'publicSnapshotColumns_', 'publicSnapshotCell_', 'buildPublicSnapshotEvents_',
  'buildPublicSnapshotGames_', 'publicSnapshotScore_', 'buildPublicSnapshotPlayers_',
  'publicSnapshotPlayerSort_', 'publicSnapshotMostFrequent_', 'publicSnapshotAverage_',
  'publicSnapshotPercentage_', 'publicSnapshotRecentGames_', 'buildPublicSnapshotMissions_',
  'buildPublicSnapshotFactions_', 'summarizePublicSnapshotFaction_',
  'isPublicSnapshotCurrentLeagueGame_', 'buildPublicSnapshotStandings_',
  'stablePublicSnapshotJson_', 'assertPublicSnapshotSafe_',
  'calculatePublicSnapshotLeagueRecord_', 'validatePublicSnapshotDatasets_',
  'buildPublicSnapshotArmyLists_', 'buildPublicSnapshotDecodedArmy_',
  'buildPublicSnapshotSchedule_', 'buildPublicSnapshotStatistics_',
  'buildPublicSnapshotRecords_', 'pickPublicHallOfFameValue_',
  'buildPublicSnapshotCommunity_', 'buildPublicSnapshotRows_'
]
for (const name of functions) {
  const start = source.indexOf(`function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  let depth = 0; let began = false; let end = start
  for (; end < source.length; end += 1) {
    if (source[end] === '{') { depth += 1; began = true }
    if (source[end] === '}') depth -= 1
    if (began && depth === 0) { end += 1; break }
  }
  vm.runInContext(source.slice(start, end), sandbox)
}

const headers = ['Timestamp', 'Division', 'Date', 'Mission', 'Player 1', 'Player 2',
  'Player 1 TP', 'Player 2 TP', 'Player 1 OP', 'Player 2 OP', 'Player 1 VP', 'Player 2 VP',
  'First Turn', 'Winning Faction', 'Losing Faction', 'Best Moment', 'Event ID', 'Game Type',
  'Game Result', 'Player 1 Army Code', 'Player 2 Army Code', 'Winner Army List ID', 'Loser Army List ID']
function gameRow(id, division, date, mission, p1, p2, p1tp, p2tp, p1op, p2op,
  p1vp, p2vp, f1, f2, result = 'Player 1', type = 'League') {
  const row = ['', division, date, mission, p1, p2, p1tp, p2tp, p1op, p2op, p1vp, p2vp,
    'Player 1', f1, f2, `Moment ${id}`, 'event-current-league', type, result,
    `SECRET-${id}-A`, `SECRET-${id}-B`, '', '']
  row.gameId = id
  return row
}
const gameRows = Array.from({ length: 73 }, (_, index) => gameRow(
  index + 1, 'Community', '2026-07-01', 'Casual Mission', 'Vision', 'Igor Your Humble Servant',
  3, 1, 6, 3, 180, 120, 'Nomads', 'PanOceania', 'Player 1', 'Casual'
))
const fixtureRows = [
  gameRow(21, 'Main Man', '2026-08-01', 'Supplies', 'Lobo', 'Vision', 5, 0, 7, 2, 200, 100, 'Corregidor Jurisdictional Command', 'Nomads'),
  gameRow(27, 'Main Man', '2026-08-05', 'Looting and Sabotaging', 'Lobo', 'Igor Your Humble Servant', 5, 0, 7, 2, 200, 100, 'Corregidor Jurisdictional Command', 'PanOceania'),
  gameRow(32, 'Proving Grounds A', '2026-07-13', 'Area of Interest', '  blitchga ', 'ZHUKOV2  ', 5, 0, 8, 2, 200, 100, 'Operations Subsection', 'Oban'),
  gameRow(36, 'Community', '2026-07-18', 'Supplies', 'Vision', ' ADangerousFrog ', 5, 0, 8, 2, 200, 100, 'Nomads', 'Ariadna', 'Player 1', 'Casual'),
  gameRow(40, 'Main Man', '2026-08-12', 'Supremacy', 'Lobo', 'Vision', 5, 0, 7, 2, 200, 100, 'Corregidor Jurisdictional Command', 'Nomads'),
  gameRow(67, 'Main Man', '2026-08-25', 'Firefight', 'Lobo', 'Igor Your Humble Servant', 5, 0, 8, 2, 213, 100, 'Corregidor Jurisdictional Command', 'PanOceania'),
  gameRow(22, 'Main Man', '2026-08-02', 'Supplies', 'Nighthawkmk2', 'Vision', 5, 0, 8, 2, 200, 100, 'Shindenbutai', 'Nomads'),
  gameRow(30, 'Main Man', '2026-08-06', 'Supremacy', 'Nighthawkmk2', 'Igor Your Humble Servant', 5, 0, 8, 2, 200, 100, 'Shindenbutai', 'PanOceania'),
  gameRow(50, 'Main Man', '2026-08-18', 'Firefight', 'Vision', 'Nighthawkmk2', 5, 1, 8, 4, 250, 214, 'Nomads', 'Shindenbutai'),
  gameRow(61, 'Proving Grounds A', '2026-08-21', 'Draw Mission', 'PG Alpha', 'PG Beta', 2, 2, 5, 5, 150, 150, 'Ariadna', 'Haqqislam', 'Draw')
]
const game73 = gameRow(73, 'Main Man', '2026-08-29', "Dead Man's Switch", 'Lobo', 'Nighthawkmk2',
  5, 0, 8, 1, 262, 122, 'Corregidor Jurisdictional Command', 'Shindenbutai')
game73[21] = '3296098999'; game73[22] = '4483300877'; fixtureRows.push(game73)
for (const row of fixtureRows) gameRows[row.gameId - 1] = row
const playersTable = { headers: ['Player', 'Display Name', 'Division', 'Active'], rows: [
  ['Lobo', 'Lobo', 'Main Man', 'true'], ['Nighthawkmk2', 'Nighthawkmk2', 'Main Man', 'true'],
  ['Vision', 'Vision', 'Main Man', 'true'], ['Igor Your Humble Servant', 'Igor Your Humble Servant', 'Main Man', 'true'],
  ['Blitchga', 'Blitchga', 'Proving Grounds A', 'true'], ['Zhukov2', 'Zhukov2', 'Proving Grounds A', 'true'],
  ['PG Alpha', 'PG Alpha', 'Proving Grounds A', 'true'], ['PG Beta', 'PG Beta', 'Proving Grounds A', 'true'],
  ['PG Gamma', 'PG Gamma', 'Proving Grounds B', 'true'],
] }
const eventsTable = { headers: ['ID', 'Name', 'Type', 'Status', 'Commissioners', 'Owner', 'Permissions', 'Automation', 'Private Notes'], rows: [
  ['event-current-league', 'Current League', 'League', 'Active', 'Secret', 'Secret', 'Secret', 'Secret', 'Secret']
] }
const index = sandbox.buildPublicSnapshotPlayerIndex_(playersTable)
const context = sandbox.buildPublicSnapshotGameContext_({ headers, rows: gameRows }, index)
const events = sandbox.buildPublicSnapshotEvents_(eventsTable, context)
const players = sandbox.buildPublicSnapshotPlayers_(playersTable, context)
const games = sandbox.buildPublicSnapshotGames_(context, events)
const missions = sandbox.buildPublicSnapshotMissions_(context)
const factions = sandbox.buildPublicSnapshotFactions_(context, players)
const standings = sandbox.buildPublicSnapshotStandings_(playersTable, context)
assert.equal(games.length, 73)
assert.deepEqual(games.filter((game) => game.id === 32).map((game) => [game.winner, game.loser]), [['Blitchga', 'Zhukov2']])
const game36 = games.find((game) => game.id === 36)
assert.equal(game36.loser, 'ADangerousFrog')
assert.equal(players.some((player) => player.player === 'ADangerousFrog'), false)
const game73Out = games.find((game) => game.id === 73)
assert.deepEqual([game73Out.winner, game73Out.loser, game73Out.mission, game73Out.tp, game73Out.op, game73Out.vp],
  ['Lobo', 'Nighthawkmk2', "Dead Man's Switch", '5–0', '8–1', '262–122'])
assert.equal(game73Out.winnerArmyListId, '3296098999')
assert.equal(game73Out.loserArmyListId, '4483300877')
assert.equal('winnerArmyCode' in game73Out, false)
assert.equal('loserArmyCode' in game73Out, false)
const main = standings.find((row) => row.division === 'Main Man')
assert.deepEqual(JSON.parse(JSON.stringify(main.standings.find((row) => row.player === 'Lobo'))), {
  rank: 1, player: 'Lobo', displayName: 'Lobo', games: 5, wins: 5, losses: 0, draws: 0,
  tp: 25, op: 37, vp: 1075,
})
assert.equal(standings.length, 3)
assert.equal(standings.find((row) => row.division === 'Proving Grounds A').standings.find((row) => row.player === 'PG Alpha').draws, 1)
assert.ok(missions.find((row) => row.mission === "Dead Man's Switch"))
assert.ok(factions.find((row) => row.name === 'Corregidor Jurisdictional Command'))
for (const event of events) for (const key of ['commissioners', 'owner', 'permissions', 'automation', 'privateNotes'])
  assert.equal(key in event, false)
sandbox.assertPublicSnapshotSafe_({ players, games, events, missions, factions, standings }, 'snapshot')
assert.equal(JSON.stringify(games).toLowerCase().includes('armycode'), false)
const armyLists = [
  { id: '3296098999' }, { id: '4483300877' }, { id: '4113389343' },
]
const datasets = { players, games, events, missions, factions, standings, 'army-lists': armyLists }
assert.doesNotThrow(() => sandbox.validatePublicSnapshotDatasets_(datasets, context))
assert.throws(() => sandbox.validatePublicSnapshotDatasets_({
  ...datasets, games: [...games, games[0]],
}, context), /duplicate Game ID/)

const allowedGameKeys = ['id', 'eventId', 'eventName', 'gameType', 'date', 'division', 'winner',
  'winnerDisplayName', 'loser', 'loserDisplayName', 'winnerFaction', 'loserFaction', 'mission',
  'tp', 'op', 'vp', 'bestMoment', 'firstTurn', 'winnerArmyListId', 'loserArmyListId']
assert.deepEqual(Object.keys(game73Out).sort(), allowedGameKeys.sort())
assert.deepEqual(Object.keys(standings[0].standings[0]).sort(),
  ['rank', 'player', 'displayName', 'games', 'wins', 'losses', 'draws', 'tp', 'op', 'vp'].sort())

const publicArmy = sandbox.buildPublicSnapshotArmyLists_({ lists: [{
  id: '3296098999', player: 'Lobo', armyCode: 'SECRET', armyLink: 'https://infinitytheuniverse.com/army/list/3296098999', approved: true,
}] })
assert.equal(publicArmy.length, 1)
assert.equal('armyCode' in publicArmy[0], false)
assert.equal(publicArmy[0].armyLink.includes('3296098999'), true)

console.log('Public Snapshot Exporter V1 regression passed.')
