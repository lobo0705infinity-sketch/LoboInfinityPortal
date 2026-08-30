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
assert.doesNotMatch(api, /runBuildSimplePublicGenerationCandidate/)
assert.doesNotMatch(simple, /processAutomationQueueBatch|rebuildGameEngine|decodeArmy|refreshArmyIntelligence/)
assert.doesNotMatch(simple, /PublicPlayersProjection|PublicLeagueWorkspaceProjection|PublicDetailProjection/)
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
  'buildSimplePublicGames_', 'buildSimplePublicPlayers_', 'addSimplePublicPlayerGame_',
  'compareSimplePublicPlayerRecords_', 'mostFrequentSimplePublicValue_',
  'finalizeSimplePublicPlayer_', 'buildSimplePublicMetric_',
  'buildSimplePublicMetricGroup_',
  'calculateSimplePublicLongestWinStreak_', 'calculateSimplePublicGamesThisMonth_',
  'buildSimplePublicAvailabilityMap_', 'buildSimplePublicRegistrationMap_',
  'buildSimplePublicEvents_',
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
const game73 = ['', 'Main Man', '2026-08-29', "Dead Man's Switch", 'Lobo', 'Nighthawkmk2',
  5, 0, 8, 1, 262, 122, 'Player 1', 'Corregidor Jurisdictional Command', 'Shindenbutai',
  'Moment', 'event-current-league', 'League', 'Player 1', 'SECRET-LOBO', 'SECRET-NIGHT',
  '3296098999', '4483300877']
const frozen = {
  gamesTable: { headers, rows: [...Array.from({ length: 72 }, () => []), game73] },
  playersTable: { headers: ['Player', 'Display Name', 'Division', 'Active'], rows: [
    ['Lobo', 'Lobo', 'Main Man', 'true'],
    ['Nighthawkmk2', 'Nighthawkmk2', 'Main Man', 'true'],
    ['Vision', 'Vision', 'Main Man', 'true'],
    ['Igor Your Humble Servant', 'Igor Your Humble Servant', 'Main Man', 'true'],
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
  player1Vp: Number(row[10]), player2Vp: Number(row[11]), winner: row[4], eventId: row[16], gameType: row[17],
})

const events = sandbox.buildSimplePublicEvents_(frozen)
const players = sandbox.buildSimplePublicPlayers_(frozen, events)
const games = sandbox.buildSimplePublicGames_(frozen, players, events)
assert.equal(players.length, 4)
assert.equal(players.find((player) => player.player === 'Lobo').wins, 1)
assert.equal(games.length, 1)
assert.equal(games[0].id, 73)
assert.equal(games[0].winnerArmyListId, '3296098999')
assert.equal(games[0].loserArmyListId, '4483300877')
assert.equal('winnerArmyCode' in games[0], false)
assert.equal('loserArmyCode' in games[0], false)
assert.equal(events.length, 3)
for (const event of events) {
  for (const forbidden of ['commissioners', 'owner', 'permissions', 'automation', 'history', 'privateNotes'])
    assert.equal(forbidden in event, false)
}
sandbox.assertNoForbiddenPublicGenerationKeys_({ players, games, events }, 'simple')

// Frozen cutoff and determinism: post-capture mutation cannot enter the existing G.
const frozenCopy = structuredClone(frozen)
const first = JSON.stringify({
  players: sandbox.buildSimplePublicPlayers_(frozenCopy, sandbox.buildSimplePublicEvents_(frozenCopy)),
  events: sandbox.buildSimplePublicEvents_(frozenCopy),
})
frozen.gamesTable.rows.push([...game73.slice(0, 4), 'Later', 'Player', ...game73.slice(6)])
const second = JSON.stringify({
  players: sandbox.buildSimplePublicPlayers_(frozenCopy, sandbox.buildSimplePublicEvents_(frozenCopy)),
  events: sandbox.buildSimplePublicEvents_(frozenCopy),
})
assert.equal(first, second)

// The owner path is isolated and explicitly unpublished.
assert.match(simple, /published: false/)
assert.match(simple, /livePointer: false/)
assert.doesNotMatch(simple, /PUBLIC_GENERATION_ACTIVE_BUILD_PROPERTY/)
assert.match(foundation, /function createImmutablePublicGenerationFile_/)

console.log('Simplified three-domain public generation regression passed.')
