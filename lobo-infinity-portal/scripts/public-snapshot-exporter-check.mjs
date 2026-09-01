import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/PublicSnapshotExporter.gs', 'utf8')
const api = fs.readFileSync('backend/API.gs', 'utf8')
assert.match(source, /function runBuildPublicSnapshotV1\(\)/)
assert.doesNotMatch(api, /runBuildPublicSnapshotV1/)
assert.doesNotMatch(source, /PublicGeneration|processAutomationQueueBatch|rebuildGameEngine|decodeArmy|refreshArmyIntelligence/)
assert.doesNotMatch(source, /PUBLIC_.*DIRTY|doGet|doPost|requireApiPermission/)
assert.match(source, /function runPublishPublicSnapshotV1Proof[\s\S]*publishLatestPublicSnapshotV1_\(true/)
assert.doesNotMatch(source, /20260830T222502Z/)
assert.match(source, /published: false/)
assert.match(source, /livePointer: false/)
assert.match(source, /duplicate Game ID/)
assert.match(source, /function runHourlyPublicSnapshot\(\)/)
assert.match(source, /function installHourlyPublicSnapshotTrigger\(\)/)
assert.match(source, /remainingMatchups:\s*remainingMatchups/)
assert.equal((source.match(/armyLink:\s*buildPublicSnapshotArmyLink_\(list\.armyLink, list\.armyCode\)/g) || []).length, 2)

function extractFunctions(text) {
  const functions = new Map()
  const pattern = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g
  let match
  while ((match = pattern.exec(text))) {
    const start = match.index
    let depth = 0; let began = false; let end = pattern.lastIndex - 1
    for (; end < text.length; end += 1) {
      if (text[end] === '{') { depth += 1; began = true }
      if (text[end] === '}') depth -= 1
      if (began && depth === 0) { end += 1; break }
    }
    functions.set(match[1], text.slice(start, end))
    pattern.lastIndex = end
  }
  return functions
}

const backendFunctions = new Map()
for (const filename of fs.readdirSync('backend').filter((name) => name.endsWith('.gs'))) {
  for (const [name, body] of extractFunctions(fs.readFileSync(`backend/${filename}`, 'utf8'))) {
    backendFunctions.set(name, { body, filename })
  }
}
const reachable = new Map()
const pending = ['runBuildPublicSnapshotV1']
while (pending.length) {
  const name = pending.pop()
  if (reachable.has(name) || !backendFunctions.has(name)) continue
  const definition = backendFunctions.get(name)
  reachable.set(name, definition)
  for (const call of definition.body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!reachable.has(call[1]) && backendFunctions.has(call[1])) pending.push(call[1])
  }
}
const urlFetchReachable = [...reachable].filter(([, definition]) => /\bUrlFetchApp\b/.test(definition.body))
assert.deepEqual(urlFetchReachable, [], `snapshot build reaches UrlFetch: ${urlFetchReachable.map(([name, value]) => `${value.filename}:${name}`).join(', ')}`)
const forbiddenArmyCalls = [
  'canonicalDecoderGatewayDecode_', 'resolveArmyCodeProfiles', 'decodeArmyCode',
  'refreshArmyIntelligence', 'rebuildArmyIntelligenceReadModelPayloadAndPersist',
  'getArmyListObjects', 'getCanonicalGameSubmittedArmyListObjects',
  'appendCanonicalGameSubmittedArmyList',
]
assert.deepEqual(forbiddenArmyCalls.filter((name) => reachable.has(name)), [],
  `snapshot build reaches Army decoding/reconstruction: ${forbiddenArmyCalls.filter((name) => reachable.has(name)).join(', ')}`)
assert.equal(reachable.has('runPublishPublicSnapshotV1Proof'), false)

const publicationReachable = new Map()
const publicationPending = ['runPublishPublicSnapshotV1Proof']
while (publicationPending.length) {
  const name = publicationPending.pop()
  if (publicationReachable.has(name) || !backendFunctions.has(name)) continue
  const definition = backendFunctions.get(name)
  publicationReachable.set(name, definition)
  for (const call of definition.body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!publicationReachable.has(call[1]) && backendFunctions.has(call[1])) publicationPending.push(call[1])
  }
}
for (const forbidden of ['buildPublicSnapshotV1_', 'canonicalDecoderGatewayDecode_',
  'rebuildGameEngine', 'refreshArmyIntelligence']) {
  assert.equal(publicationReachable.has(forbidden), false, `publication reaches ${forbidden}`)
}
const publicationUrlFetchReachable = [...publicationReachable].filter(([, definition]) => /\bUrlFetchApp\b/.test(definition.body))
assert.deepEqual(publicationUrlFetchReachable.map(([name]) => name), ['publishLatestPublicSnapshotV1_'])

const hourlyReachable = new Map()
const hourlyPending = ['runHourlyPublicSnapshot']
while (hourlyPending.length) {
  const name = hourlyPending.pop()
  if (hourlyReachable.has(name) || !backendFunctions.has(name)) continue
  const definition = backendFunctions.get(name)
  hourlyReachable.set(name, definition)
  for (const call of definition.body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!hourlyReachable.has(call[1]) && backendFunctions.has(call[1])) hourlyPending.push(call[1])
  }
}
const hourlyUrlFetchReachable = [...hourlyReachable].filter(([, definition]) => /\bUrlFetchApp\b/.test(definition.body))
assert.deepEqual(hourlyUrlFetchReachable.map(([name]) => name), ['publishLatestPublicSnapshotV1_'])
for (const forbidden of ['canonicalDecoderGatewayDecode_', 'rebuildGameEngine', 'refreshArmyIntelligence']) {
  assert.equal(hourlyReachable.has(forbidden), false, `hourly snapshot reaches ${forbidden}`)
}
const triggerBody = backendFunctions.get('installHourlyPublicSnapshotTrigger').body
assert.match(triggerBody, /getHandlerFunction\(\) === handler/)
assert.match(triggerBody, /everyHours\(1\)/)
assert.doesNotMatch(triggerBody, /deleteTrigger\(trigger\)[\s\S]*getHandlerFunction\(\) !== handler/)

const selectionSandbox = {
  PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_PROPERTY: 'PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_ID',
  Error, String,
}
vm.createContext(selectionSandbox)
vm.runInContext(backendFunctions.get('getLatestValidatedPublicSnapshotId_').body, selectionSandbox)
const selectedIds = {
  PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_ID: '20260831T044344Z',
}
const selectionProperties = { getProperty: (key) => selectedIds[key] || '' }
assert.equal(selectionSandbox.getLatestValidatedPublicSnapshotId_(selectionProperties), '20260831T044344Z')
assert.notEqual(selectionSandbox.getLatestValidatedPublicSnapshotId_(selectionProperties), '20260830T222502Z')
delete selectedIds.PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_ID
assert.throws(() => selectionSandbox.getLatestValidatedPublicSnapshotId_(selectionProperties), /identity is unavailable/)
selectedIds.PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_ID = 'failed-snapshot'
assert.throws(() => selectionSandbox.getLatestValidatedPublicSnapshotId_(selectionProperties), /identity is unavailable/)

const FORM = {
  DATE: 2, DIVISION: 1, MISSION: 3, PLAYER1: 4, PLAYER2: 5,
  P1TP: 6, P2TP: 7, P1OP: 8, P2OP: 9, P1VP: 10, P2VP: 11,
  FIRSTTURN: 12, WINNINGFACTION: 13, LOSINGFACTION: 14, MOMENT: 15,
  EVENT_ID: 16, GAME_TYPE: 17, GAME_RESULT: 18,
  WINNER_ARMY_LIST_ID: 21, LOSER_ARMY_LIST_ID: 22,
}
const sandbox = {
  console, Date, JSON, Math, Number, Object, String, FORM, encodeURIComponent, decodeURIComponent,
  EVENT_ENGINE_DEFAULT_EVENT_ID: 'event-current-league',
  CONFIG: { DIVISIONS: { MAIN_MAN: 'Main Man', PGA: 'Proving Grounds A', PGB: 'Proving Grounds B' } },
  determineWinner: (row) => row[FORM.GAME_RESULT] === 'Player 2' ? 2 : row[FORM.GAME_RESULT] === 'Draw' ? 0 : 1,
  normalizeGameType: (value) => ['tournament', 'casual', 'narrative'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'league',
  getPlayerRegistryColumns: () => ({ player: 0, displayName: 1, division: 2, active: 3 }),
}
vm.createContext(sandbox)
const functions = [
  'normalizePublicSnapshotIdentity_', 'buildPublicSnapshotPlayerIndex_', 'findPublicSnapshotRegistryIdentity_',
  'resolvePublicSnapshotParticipant_', 'buildPublicSnapshotGameContext_',
  'publicSnapshotColumns_', 'publicSnapshotCell_', 'buildPublicSnapshotEvents_',
  'buildPublicSnapshotGames_', 'publicSnapshotScore_', 'ensurePublicSnapshotPlayerRecord_',
  'resolvePublicSnapshotDirectoryParticipant_', 'buildPublicSnapshotPlayers_',
  'publicSnapshotPlayerSort_', 'publicSnapshotMostFrequent_', 'publicSnapshotAverage_',
  'publicSnapshotPercentage_', 'publicSnapshotRecentGames_', 'buildPublicSnapshotMissions_',
  'buildPublicSnapshotFactions_', 'summarizePublicSnapshotFaction_',
  'isPublicSnapshotCurrentLeagueGame_', 'getPublicSnapshotCurrentLeagueDivisions_',
  'isPublicSnapshotCompletedGame_', 'buildPublicSnapshotRemainingMatchups_',
  'validatePublicSnapshotRemainingMatchups_', 'buildPublicSnapshotStandings_',
  'stablePublicSnapshotJson_', 'assertPublicSnapshotSafe_',
  'calculatePublicSnapshotLeagueRecord_', 'validatePublicSnapshotDatasets_',
  'buildPublicSnapshotArmyLink_', 'buildPublicSnapshotArmyLists_', 'buildPublicSnapshotDecodedArmy_',
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
assert.equal(players.some((player) => player.player === 'ADangerousFrog'), true)
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
const schedule = sandbox.buildPublicSnapshotSchedule_({
  playersTable,
  leagueOperationsTable: { headers: [], rows: [] },
  schedulingTable: { headers: [], rows: [] },
}, standings, events, context)
assert.equal(schedule.length, 1)
assert.equal(schedule[0].remainingMatchups.length, 3)
const datasets = { players, games, events, missions, factions, standings, schedule, 'army-lists': armyLists }
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

const directoryPlayersTable = { headers: playersTable.headers, rows: [
  ...playersTable.rows, ['aro_wax', 'Wax', 'Community', 'false'],
] }
const directoryIndex = sandbox.buildPublicSnapshotPlayerIndex_(directoryPlayersTable)
const directoryGames = sandbox.buildPublicSnapshotGameContext_({ headers, rows: [
  gameRow(1, 'Community', '2026-08-01', 'Casual Mission', 'Wax', 'ADangerousFrog', 5, 0, 7, 1, 200, 100, 'Nomads', 'Ariadna', 'Player 1', 'Casual'),
] }, directoryIndex)
const directory = sandbox.buildPublicSnapshotPlayers_(directoryPlayersTable, directoryGames, {
  'event-team': { participants: [
    { player: 'dangerous@example.test', displayName: 'ADangerousFrog', status: 'Approved', role: 'Player' },
    { player: 'team-only@example.test', displayName: 'Team Only', status: 'Approved', role: 'Player' },
    { player: 'withdrawn@example.test', displayName: 'Withdrawn Only', status: 'Withdrawn', role: 'Player' },
  ] },
})
assert.equal(directory.filter((player) => player.player === 'aro_wax').length, 1)
assert.equal(directory.some((player) => player.player === 'Wax'), false)
assert.equal(directory.find((player) => player.player === 'ADangerousFrog').games, 1)
assert.equal(directory.find((player) => player.player === 'Team Only').division, 'Community')
assert.deepEqual(JSON.parse(JSON.stringify(directory.find((player) => player.player === 'Withdrawn Only').eventParticipations)), [
  { eventId: 'event-team', status: 'Withdrawn', role: 'Player' },
])
assert.equal(JSON.stringify(directory).includes('@example.test'), false)

const publicArmy = sandbox.buildPublicSnapshotArmyLists_({ lists: [
  { id: '3296098999', player: 'Lobo', armyCode: 'SECRET-A', armyLink: 'https://infinitytheuniverse.com/army/list/3296098999', approved: true },
  { id: '4483300877', player: 'Nighthawkmk2', armyCode: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890%3D', approved: true },
  { id: '4113389343', player: 'Nighthawkmk2', armyCode: 'SECRET-C', approved: true },
] })
assert.deepEqual(publicArmy.map((list) => list.id), ['3296098999', '4483300877', '4113389343'])
assert.equal('armyCode' in publicArmy[0], false)
assert.equal(publicArmy[0].armyLink.includes('3296098999'), true)
assert.equal(publicArmy[1].armyLink, 'https://infinitytheuniverse.com/army/list/ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890%3D')
assert.equal(publicArmy[2].armyLink, '')

const persistedSandbox = { Array, Error }
vm.createContext(persistedSandbox)
for (const name of ['readPublicSnapshotPersistedArmyLists_', 'readPublicSnapshotPersistedArmyIntelligence_']) {
  const definition = backendFunctions.get(name)
  assert.ok(definition, `missing ${name}`)
  vm.runInContext(definition.body, persistedSandbox)
}
persistedSandbox.readArmyListsReadModelPayload = () => ({ lists: [{ id: '3296098999' }, { id: '4483300877' }, { id: '4113389343' }] })
persistedSandbox.readArmyIntelligenceReadModelPayload = () => ({ lists: [], summary: { decodedLists: 103, pendingLists: 0, failedLists: 0 } })
assert.equal(persistedSandbox.readPublicSnapshotPersistedArmyLists_().lists.length, 3)
assert.equal(persistedSandbox.readPublicSnapshotPersistedArmyIntelligence_().summary.decodedLists, 103)
let decoderCalls = 0; let urlFetchCalls = 0
persistedSandbox.CanonicalDecoderGateway = { decode() { decoderCalls += 1 } }
persistedSandbox.UrlFetchApp = { fetch() { urlFetchCalls += 1 } }
persistedSandbox.readArmyListsReadModelPayload = () => null
assert.throws(() => persistedSandbox.readPublicSnapshotPersistedArmyLists_(), /Army Lists persisted model unavailable/)
persistedSandbox.readArmyIntelligenceReadModelPayload = () => null
assert.throws(() => persistedSandbox.readPublicSnapshotPersistedArmyIntelligence_(), /Army Intelligence persisted model unavailable/)
assert.equal(decoderCalls, 0)
assert.equal(urlFetchCalls, 0)

console.log('Public Snapshot Exporter V1 regression passed.')
