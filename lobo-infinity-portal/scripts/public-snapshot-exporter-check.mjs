import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/PublicSnapshotExporter.gs', 'utf8')
const armyRegistrySource = fs.readFileSync('backend/ArmyRegistry.gs', 'utf8')
const api = fs.readFileSync('backend/API.gs', 'utf8')
assert.match(source, /function runBuildPublicSnapshotV1\(\)/)
assert.doesNotMatch(api, /runBuildPublicSnapshotV1/)
assert.doesNotMatch(source, /PublicGeneration|processAutomationQueueBatch|rebuildGameEngine|decodeArmy|refreshArmyIntelligence/)
assert.doesNotMatch(source, /PUBLIC_.*DIRTY|doGet|doPost|requireApiPermission/)
assert.match(source, /function runPublishPublicSnapshotV1Proof[\s\S]*publishLatestPublicSnapshotV1_\(true/)
assert.match(source, /function runPublishPublicSnapshotV1Proof\(\)\s*\{/)
assert.doesNotMatch(source, /function runPublishPublicSnapshotV1Proof\([^)]*\w[^)]*\)/)
assert.match(source, /function runPublishPublicSnapshot20260903T042240ZProof\(\)\s*\{\s*return publishLatestPublicSnapshotV1_\(true, "20260903T042240Z"\);\s*\}/)
assert.match(source, /function runPublishPublicSnapshot20260903T130548ZProof\(\)\s*\{\s*return publishLatestPublicSnapshotV1_\(true, "20260903T130548Z"\);\s*\}/)
assert.match(source, /function runInspectLatestValidatedPublicSnapshotV1\(\)/)
assert.doesNotMatch(source, /setProperty\(PUBLIC_SNAPSHOT_PUBLISH_TOKEN_PROPERTY/)
assert.doesNotMatch(source, /setProperties\([^)]*PUBLIC_SNAPSHOT_PUBLISH_TOKEN_PROPERTY/)
assert.doesNotMatch(source, /20260830T222502Z/)
assert.match(source, /published: false/)
assert.match(source, /livePointer: false/)
assert.match(source, /duplicate Game ID/)
assert.match(source, /function runHourlyPublicSnapshot\(\)/)
assert.match(source, /function installHourlyPublicSnapshotTrigger\(\)/)
assert.match(source, /remainingMatchups:\s*remainingMatchups/)
assert.equal((source.match(/armyLink:\s*buildPublicSnapshotArmyLink_\(list\.armyLink, list\.armyCode\)/g) || []).length, 2)
assert.match(source, /function readPublicSnapshotTeamTournamentProjection_\(\)/)
assert.match(source, /teamTournamentProjection: JSON\.parse\(JSON\.stringify\(teamTournamentProjection\)\)/)
assert.match(source, /event\.standings = JSON\.parse\([\s\S]*?teamTournamentProjection\.tournament\.standings/)

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
assert.deepEqual(urlFetchReachable.map(([name]) => name), ['fetchMissionGeistListing_'],
  `snapshot build may fetch only the Mission Geist catalog: ${urlFetchReachable.map(([name, value]) => `${value.filename}:${name}`).join(', ')}`)
const forbiddenArmyCalls = [
  'canonicalDecoderGatewayDecode_', 'resolveArmyCodeProfiles', 'decodeArmyCode',
  'refreshArmyIntelligence', 'rebuildArmyIntelligenceReadModelPayloadAndPersist',
  'getArmyListObjects', 'getCanonicalGameSubmittedArmyListObjects',
  'appendCanonicalGameSubmittedArmyList',
]
assert.deepEqual(forbiddenArmyCalls.filter((name) => reachable.has(name)), [],
  `snapshot build reaches Army decoding/reconstruction: ${forbiddenArmyCalls.filter((name) => reachable.has(name)).join(', ')}`)
assert.equal(reachable.has('runPublishPublicSnapshotV1Proof'), false)
assert.equal(reachable.has('runPublishPublicSnapshot20260903T042240ZProof'), false)

const publicationReachable = new Map()
const publicationPending = ['runPublishPublicSnapshot20260903T130548ZProof']
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

const inspectionReachable = new Map()
const inspectionPending = ['runInspectLatestValidatedPublicSnapshotV1']
while (inspectionPending.length) {
  const name = inspectionPending.pop()
  if (inspectionReachable.has(name) || !backendFunctions.has(name)) continue
  const definition = backendFunctions.get(name)
  inspectionReachable.set(name, definition)
  for (const call of definition.body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!inspectionReachable.has(call[1]) && backendFunctions.has(call[1])) inspectionPending.push(call[1])
  }
}
assert.equal([...inspectionReachable].some(([, definition]) => /\bUrlFetchApp\b/.test(definition.body)), false)
for (const forbidden of [
  'runBuildPublicSnapshotV1', 'buildPublicSnapshotV1_', 'runPublishPublicSnapshotV1Proof',
  'publishLatestPublicSnapshotV1_', 'createPublicSnapshotFolder_', 'writePublicSnapshotFile_',
  'canonicalDecoderGatewayDecode_', 'fetchMissionGeistListing_',
]) assert.equal(inspectionReachable.has(forbidden), false, `latest snapshot inspection reaches ${forbidden}`)
const inspectionSource = backendFunctions.get('runInspectLatestValidatedPublicSnapshotV1').body
assert.doesNotMatch(inspectionSource, /setProperty|setProperties|createFile|createFolder|setContent|moveTo|trash|UrlFetchApp/)
assert.match(inspectionSource, /game\.op === "8–2"/)
assert.match(inspectionSource, /game\.mission === "The Dig"/)
assert.match(inspectionSource, /game\.mission === "Double Bind"/)

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
assert.deepEqual(hourlyUrlFetchReachable.map(([name]) => name).sort(),
  ['fetchMissionGeistListing_', 'publishLatestPublicSnapshotV1_'])
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

const exactSnapshotId = '20260903T130548Z'
const exactSourceCutoff = '2026-09-03T13:06:10.647Z'
let exactUrlFetchCalls = 0
let exactDriveReads = 0
let exactLatestValidatedId = exactSnapshotId
const exactFiles = Object.fromEntries([
  'snapshot.json', 'players.json', 'games.json', 'events.json', 'missions.json', 'mission-catalog.json',
  'factions.json', 'standings.json', 'army-lists.json', 'army-intelligence-summary.json',
  'army-intelligence-detail.json', 'schedule.json', 'statistics.json', 'community.json',
].map((filename) => [filename, JSON.stringify({
  snapshotId: exactSnapshotId, sourceCutoff: exactSourceCutoff,
  ...(filename === 'snapshot.json' ? { status: 'validated', published: false, livePointer: false } : { data: [] }),
})]))
const exactPublicationSandbox = {
  Error, JSON, Logger: { log() {} }, String,
  PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_PROPERTY: 'PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_ID',
  PUBLIC_SNAPSHOT_PUBLISH_TOKEN_PROPERTY: 'LOBO_SNAPSHOT_PUBLISH_TOKEN',
  PUBLIC_SNAPSHOT_V1_ROOT_PROPERTY: 'PUBLIC_SNAPSHOT_V1_ROOT_FOLDER_ID',
  PUBLIC_SNAPSHOT_PUBLISH_URL: 'https://example.test/api/public-snapshot-publish',
  PUBLIC_SNAPSHOT_PUBLIC_FILES: Object.keys(exactFiles),
  PropertiesService: { getScriptProperties: () => ({
    getProperty: (key) => key === 'PUBLIC_SNAPSHOT_V1_LAST_VALIDATED_ID' ? exactLatestValidatedId
      : key === 'LOBO_SNAPSHOT_PUBLISH_TOKEN' ? 'token' : 'root',
  }) },
  DriveApp: { getFolderById: () => {
    exactDriveReads += 1
    return { getFoldersByName: () => {
      let folderRead = false
      return { hasNext: () => !folderRead, next: () => {
        folderRead = true
        return { getFilesByName: (filename) => {
          let fileRead = false
          return { hasNext: () => !fileRead, next: () => {
            fileRead = true
            return { getBlob: () => ({ getDataAsString: () => exactFiles[filename] }) }
          } }
        } }
      } }
    } }
  } },
  UrlFetchApp: { fetch: () => {
    exactUrlFetchCalls += 1
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({
      success: true, activated: true, snapshotId: exactSnapshotId, sourceCutoff: exactSourceCutoff,
      uploaded: 14, files: [], current: { snapshotId: exactSnapshotId },
    }) }
  } },
}
vm.createContext(exactPublicationSandbox)
for (const name of ['getLatestValidatedPublicSnapshotId_', 'publishLatestPublicSnapshotV1_', 'runPublishPublicSnapshot20260903T130548ZProof']) {
  vm.runInContext(backendFunctions.get(name).body, exactPublicationSandbox)
}
assert.equal(exactPublicationSandbox.runPublishPublicSnapshot20260903T130548ZProof().snapshotId, exactSnapshotId)
assert.equal(exactUrlFetchCalls, 1)
exactLatestValidatedId = '20260903T050000Z'
assert.throws(() => exactPublicationSandbox.runPublishPublicSnapshot20260903T130548ZProof(), /changed before publication/)
assert.equal(exactUrlFetchCalls, 1)
assert.equal(exactDriveReads, 1)
exactLatestValidatedId = ''
assert.throws(() => exactPublicationSandbox.runPublishPublicSnapshot20260903T130548ZProof(), /identity is unavailable/)
assert.equal(exactUrlFetchCalls, 1)
assert.equal(exactDriveReads, 1)
exactLatestValidatedId = 'malformed-snapshot'
assert.throws(() => exactPublicationSandbox.runPublishPublicSnapshot20260903T130548ZProof(), /identity is unavailable/)
assert.equal(exactUrlFetchCalls, 1)
assert.equal(exactDriveReads, 1)

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
vm.runInContext(armyRegistrySource, sandbox)
const functions = [
  'normalizePublicSnapshotIdentity_', 'buildPublicSnapshotPlayerIndex_', 'findPublicSnapshotRegistryIdentity_',
  'resolvePublicSnapshotParticipant_', 'buildPublicSnapshotGameContext_',
  'publicSnapshotColumns_', 'publicSnapshotCell_', 'buildPublicSnapshotEvents_',
  'buildPublicSnapshotGames_', 'publicSnapshotScore_', 'ensurePublicSnapshotPlayerRecord_',
  'resolvePublicSnapshotDirectoryParticipant_', 'buildPublicSnapshotPlayers_',
  'recordPublicSnapshotArmyUsage_', 'isPublicSnapshotArmyUsageMoreRecent_',
  'finalizePublicSnapshotArmyUsage_', 'resolvePublicSnapshotPreferredArmy_',
  'publicSnapshotPlayerSort_', 'publicSnapshotMostFrequent_', 'publicSnapshotAverage_', 'publicSnapshotMissionAverage_',
  'publicSnapshotScoreCellIsValid_', 'publicSnapshotWinnerScore_',
  'publicSnapshotPercentage_', 'publicSnapshotRecentGames_', 'buildPublicSnapshotMissions_',
  'buildPublicSnapshotFactions_', 'summarizePublicSnapshotFaction_',
  'isPublicSnapshotCurrentLeagueGame_', 'getPublicSnapshotCurrentLeagueDivisions_',
  'isPublicSnapshotCompletedGame_', 'buildPublicSnapshotRemainingMatchups_',
  'validatePublicSnapshotRemainingMatchups_', 'buildPublicSnapshotStandings_',
  'stablePublicSnapshotJson_', 'assertPublicSnapshotSafe_', 'validatePublicSnapshotFile_',
  'calculatePublicSnapshotLeagueRecord_', 'validatePublicSnapshotArmyUsage_', 'validatePublicSnapshotDatasets_',
  'buildPublicSnapshotArmyLink_', 'buildPublicSnapshotArmyLists_', 'buildPublicSnapshotDecodedArmy_',
  'buildPublicSnapshotLeagueMission_', 'buildPublicSnapshotSchedule_', 'buildPublicSnapshotStatistics_',
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
const missionGeistValidator = backendFunctions.get('validateMissionGeistCatalog_')
assert.ok(missionGeistValidator, 'missing validateMissionGeistCatalog_')
vm.runInContext(missionGeistValidator.body, sandbox)

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
const historicalGame73Context = context.find((game) => game.gameId === 73)
historicalGame73Context.gameId = 173
historicalGame73Context.player2Op = 2
context.find((game) => game.gameId === 40).player2Op = 3
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
const game73Out = games.find((game) => game.winnerArmyListId === '3296098999' && game.loserArmyListId === '4483300877')
assert.equal(game73Out.id, 173)
assert.deepEqual([game73Out.winner, game73Out.loser, game73Out.mission, game73Out.tp, game73Out.op, game73Out.vp],
  ['Lobo', 'Nighthawkmk2', "Dead Man's Switch", '5–0', '8–2', '262–122'])
assert.equal(game73Out.winnerArmyListId, '3296098999')
assert.equal(game73Out.loserArmyListId, '4483300877')
assert.equal(games.find((game) => game.id === 40).op, '7–3')
assert.equal('winnerArmyCode' in game73Out, false)
assert.equal('loserArmyCode' in game73Out, false)
const drawGameOut = games.find((game) => game.id === 61)
assert.deepEqual(
  JSON.parse(JSON.stringify([drawGameOut.player1, drawGameOut.player1Faction, drawGameOut.player2, drawGameOut.player2Faction])),
  ['PG Alpha', 'Ariadna', 'PG Beta', 'Haqqislam'],
)
const drawPlayer = players.find((player) => player.player === 'PG Alpha')
assert.equal(drawPlayer.draws, 1)
assert.equal(drawPlayer.preferredArmy, 'Ariadna')
assert.deepEqual(JSON.parse(JSON.stringify(drawPlayer.armyUsage)), [{
  army: 'Ariadna', parentFaction: 'Ariadna', classification: 'vanilla', games: 1,
  mostRecentGameDate: '2026-08-21', mostRecentGameId: 61, tiedForHighestUsage: true,
}])
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
const missionCatalog = {
  schemaVersion: '1.0.0', contentHash: 'sha256-fixture', generatedAt: '2026-09-02T00:00:00Z',
  attribution: 'Courtesy of Mission Geist',
  missions: [{
    id: 'fixture-mission', name: 'Fixture Mission', canonicalUrl: 'https://infinitygeist.com/mission/fixture-mission',
    rights: {
      ip: 'A Tale of Miniatures and Dice', official: false,
      set: 'Operation Hungry Walrus (Phase 1)', author: 'Bromad Academy', needs_review: true,
    }, sourceCollectionId: 'fixture-season',
    sourceCollectionName: 'Fixture Season', current: true,
  }],
}
const snapshotId = '20260903T031440Z'
const sourceCutoff = '2026-09-03T03:14:40.000Z'
const fileContents = {
  players: JSON.stringify({ schemaVersion: 1, snapshotId, sourceCutoff, data: [] }),
  missionCatalog: JSON.stringify({ schemaVersion: 1, snapshotId, sourceCutoff, data: missionCatalog }),
  playersWithAuthor: JSON.stringify({ schemaVersion: 1, snapshotId, sourceCutoff, data: [{ author: 'Portal User' }] }),
  missionCatalogWrongPath: JSON.stringify({
    schemaVersion: 1, snapshotId, sourceCutoff, data: { ...missionCatalog, author: 'Wrong Path' },
  }),
  missionCatalogNonStringAuthor: JSON.stringify({
    schemaVersion: 1, snapshotId, sourceCutoff,
    data: { ...missionCatalog, missions: [{ ...missionCatalog.missions[0], rights: { ...missionCatalog.missions[0].rights, author: true } }] },
  }),
  authToken: JSON.stringify({ schemaVersion: 1, snapshotId, sourceCutoff, data: [{ authToken: 'secret' }] }),
  authentication: JSON.stringify({ schemaVersion: 1, snapshotId, sourceCutoff, data: [{ authentication: 'secret' }] }),
  token: JSON.stringify({ schemaVersion: 1, snapshotId, sourceCutoff, data: [{ token: 'secret' }] }),
  invalidMissionCatalog: JSON.stringify({ schemaVersion: 1, snapshotId, sourceCutoff, data: { missions: [] } }),
  unrelatedObject: JSON.stringify({ schemaVersion: 1, snapshotId, sourceCutoff, data: { unexpected: true } }),
  metadata: JSON.stringify({ schemaVersion: 1, snapshotId, sourceCutoff, files: {} }),
}
sandbox.DriveApp = {
  getFileById: (fileId) => ({ getBlob: () => ({ getDataAsString: () => fileContents[fileId] }) }),
}
assert.doesNotThrow(() => sandbox.validatePublicSnapshotFile_('players', snapshotId, sourceCutoff, false, 'players.json'))
assert.doesNotThrow(() => sandbox.validatePublicSnapshotFile_('missionCatalog', snapshotId, sourceCutoff, false, 'mission-catalog.json'))
assert.throws(
  () => sandbox.validatePublicSnapshotFile_('playersWithAuthor', snapshotId, sourceCutoff, false, 'players.json'),
  /forbidden key at snapshot\.data\.0\.author/,
)
assert.throws(
  () => sandbox.validatePublicSnapshotFile_('missionCatalogWrongPath', snapshotId, sourceCutoff, false, 'mission-catalog.json'),
  /forbidden key at snapshot\.data\.author/,
)
assert.throws(
  () => sandbox.validatePublicSnapshotFile_('missionCatalogNonStringAuthor', snapshotId, sourceCutoff, false, 'mission-catalog.json'),
  /forbidden key at snapshot\.data\.missions\.0\.rights\.author/,
)
for (const [fileId, key] of [['authToken', 'authToken'], ['authentication', 'authentication'], ['token', 'token']]) {
  assert.throws(
    () => sandbox.validatePublicSnapshotFile_(fileId, snapshotId, sourceCutoff, false, 'players.json'),
    new RegExp(`forbidden key at snapshot\\.data\\.0\\.${key}`),
  )
}
assert.throws(
  () => sandbox.validatePublicSnapshotFile_('invalidMissionCatalog', snapshotId, sourceCutoff, false, 'mission-catalog.json'),
  /Mission Geist catalog metadata is incomplete/,
)
assert.throws(
  () => sandbox.validatePublicSnapshotFile_('unrelatedObject', snapshotId, sourceCutoff, false, 'unrelated.json'),
  /Public snapshot data file is invalid/,
)
assert.doesNotThrow(() => sandbox.validatePublicSnapshotFile_('metadata', snapshotId, sourceCutoff, true, 'snapshot.json'))
const datasets = { players, games, events, missions, 'mission-catalog': missionCatalog, factions, standings, schedule, 'army-lists': armyLists }
assert.doesNotThrow(() => sandbox.validatePublicSnapshotDatasets_(datasets, context))
const cloneDatasets = () => JSON.parse(JSON.stringify(datasets))
const withChangedHistoricalGame = (change) => {
  const copy = cloneDatasets()
  Object.assign(copy.games.find((game) => game.winnerArmyListId === '3296098999'), change)
  return copy
}
assert.throws(
  () => sandbox.validatePublicSnapshotDatasets_(withChangedHistoricalGame({ op: '8–1' }), context),
  /score does not match canonical history: op/,
)
assert.throws(
  () => sandbox.validatePublicSnapshotDatasets_(withChangedHistoricalGame({ winner: 'Wrong Player' }), context),
  /Game 73 acceptance fixture failed/,
)
assert.throws(
  () => sandbox.validatePublicSnapshotDatasets_(withChangedHistoricalGame({ winnerArmyListId: 'wrong-id' }), context),
  /Game 73 acceptance fixture failed/,
)
assert.throws(
  () => sandbox.validatePublicSnapshotDatasets_(withChangedHistoricalGame({ mission: 'Wrong Mission' }), context),
  /Game 73 acceptance fixture failed/,
)
assert.throws(() => sandbox.validatePublicSnapshotDatasets_({
  ...datasets, games: [...games, games[0]],
}, context), /duplicate Game ID/)

const allowedGameKeys = ['id', 'eventId', 'eventName', 'gameType', 'date', 'division',
  'player1', 'player1DisplayName', 'player1Faction', 'player2', 'player2DisplayName', 'player2Faction', 'winner',
  'winnerDisplayName', 'loser', 'loserDisplayName', 'winnerFaction', 'loserFaction', 'mission',
  'tp', 'op', 'vp', 'bestMoment', 'firstTurn', 'winnerArmyListId', 'loserArmyListId']
assert.deepEqual(Object.keys(game73Out).sort(), allowedGameKeys.sort())
assert.deepEqual(Object.keys(standings[0].standings[0]).sort(),
  ['rank', 'player', 'displayName', 'games', 'wins', 'losses', 'draws', 'tp', 'op', 'vp'].sort())

const usageGames = [
  { gameId: 101, date: '2026-09-01', player1: 'Tie Player', player1DisplayName: 'Tie Player', player1Faction: 'Military Orders', player2: 'Opponent A', player2DisplayName: 'Opponent A', player2Faction: 'Yu Jing', winner: 'Tie Player', mission: 'M1', player1Tp: 1, player2Tp: 0, player1Op: 1, player2Op: 0, player1Vp: 1, player2Vp: 0 },
  { gameId: 102, date: '2026-09-02', player1: 'Tie Player', player1DisplayName: 'Tie Player', player1Faction: 'Kestrel Colonial Force', player2: 'Opponent B', player2DisplayName: 'Opponent B', player2Faction: 'Yu Jing', winner: 'Tie Player', mission: 'M2', player1Tp: 1, player2Tp: 0, player1Op: 1, player2Op: 0, player1Vp: 1, player2Vp: 0 },
  { gameId: 103, date: '2026-09-03', player1: 'Tie Player', player1DisplayName: 'Tie Player', player1Faction: 'Military Orders', player2: 'Opponent C', player2DisplayName: 'Opponent C', player2Faction: 'Yu Jing', winner: 'Tie Player', mission: 'M3', player1Tp: 1, player2Tp: 0, player1Op: 1, player2Op: 0, player1Vp: 1, player2Vp: 0 },
  { gameId: 104, date: '2026-09-04', player1: 'Tie Player', player1DisplayName: 'Tie Player', player1Faction: 'Kestrel Colonial Force', player2: 'Opponent D', player2DisplayName: 'Opponent D', player2Faction: 'Yu Jing', winner: 'Tie Player', mission: 'M4', player1Tp: 1, player2Tp: 0, player1Op: 1, player2Op: 0, player1Vp: 1, player2Vp: 0 },
  { gameId: 105, date: '2026-09-05', player1: 'Vanilla Player', player1DisplayName: 'Vanilla Player', player1Faction: 'Vanilla PanOceania', player2: 'Opponent E', player2DisplayName: 'Opponent E', player2Faction: 'Yu Jing', winner: 'Vanilla Player', mission: 'M5', player1Tp: 1, player2Tp: 0, player1Op: 1, player2Op: 0, player1Vp: 1, player2Vp: 0 },
]
const usagePlayers = sandbox.buildPublicSnapshotPlayers_({ headers: playersTable.headers, rows: [
  ['Tie Player', 'Tie Player', 'Community', 'false'], ['Vanilla Player', 'Vanilla Player', 'Community', 'false'], ['No Army', 'No Army', 'Community', 'false'],
] }, usageGames, {})
const tiedPlayer = usagePlayers.find((player) => player.player === 'Tie Player')
assert.equal(tiedPlayer.preferredArmy, 'Kestrel Colonial Force')
assert.deepEqual(JSON.parse(JSON.stringify(tiedPlayer.armyUsage.map((entry) => [entry.army, entry.games, entry.tiedForHighestUsage]))), [
  ['Kestrel Colonial Force', 2, true], ['Military Orders', 2, true],
])
assert.equal(usagePlayers.find((player) => player.player === 'Vanilla Player').preferredArmy, 'PanOceania')
assert.equal(usagePlayers.find((player) => player.player === 'No Army').preferredArmy, 'No Army Selected')

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
