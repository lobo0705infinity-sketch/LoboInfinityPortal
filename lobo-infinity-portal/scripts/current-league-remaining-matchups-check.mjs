import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/PublicSnapshotExporter.gs', 'utf8')
const app = fs.readFileSync('src/public/SnapshotPublicApp.tsx', 'utf8')

assert.match(source, /buildPublicSnapshotRemainingMatchups_\(frozen\.playersTable, games \|\| \[\]\)/)
assert.match(source, /isPublicSnapshotCurrentLeagueGame_\(game\)/)
assert.doesNotMatch(app, /remainingMatchups|RemainingMatchup/)

const FORM = {
  DIVISION: 1, DATE: 2, PLAYER1: 4, PLAYER2: 5,
  EVENT_ID: 16, GAME_TYPE: 17, GAME_RESULT: 18,
}
const sandbox = {
  Array, Boolean, Error, Math, Number, Object, String,
  FORM,
  EVENT_ENGINE_DEFAULT_EVENT_ID: 'event-current-league',
  CONFIG: { DIVISIONS: { MAIN_MAN: 'Main Man', PGA: 'Proving Grounds A', PGB: 'Proving Grounds B' } },
  getPlayerRegistryColumns: () => ({ player: 0, displayName: 1, division: 2, active: 3 }),
  normalizeGameType: (value) => {
    const type = String(value || '').trim().toLowerCase()
    return ['casual', 'tournament', 'narrative'].includes(type) ? type : 'league'
  },
  determineWinner: () => 1,
}
vm.createContext(sandbox)

for (const name of [
  'normalizePublicSnapshotIdentity_', 'buildPublicSnapshotPlayerIndex_',
  'resolvePublicSnapshotParticipant_', 'buildPublicSnapshotGameContext_',
  'isPublicSnapshotCurrentLeagueGame_', 'getPublicSnapshotCurrentLeagueDivisions_',
  'isPublicSnapshotCompletedGame_', 'buildPublicSnapshotRemainingMatchups_',
  'validatePublicSnapshotRemainingMatchups_',
]) {
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

const playersTable = {
  headers: ['Player', 'Display Name', 'Division', 'Active'],
  rows: [
    ['Alpha', 'Alpha', 'Main Man', 'true'], ['Beta', 'Beta', 'Main Man', 'true'],
    ['Gamma', 'Gamma', 'Main Man', 'true'], ['Delta', 'Delta', 'Main Man', 'true'],
    ['Echo', 'Echo', 'Proving Grounds A', 'true'], ['Foxtrot', 'Foxtrot', 'Proving Grounds A', 'true'],
    ['Golf', 'Golf', 'Proving Grounds A', 'true'], ['Hotel', 'Hotel', 'Proving Grounds A', 'true'],
    ['India', 'India', 'Proving Grounds B', 'true'], ['Juliet', 'Juliet', 'Proving Grounds B', 'true'],
    ['Kilo', 'Kilo', 'Proving Grounds B', 'true'], ['Lima', 'Lima', 'Proving Grounds B', 'true'],
    ['Inactive', 'Inactive', 'Main Man', 'false'],
  ],
}
const headers = Array.from({ length: 19 }, (_, index) => `Column ${index}`)
function gameRow(division, date, player1, player2, eventId = 'event-current-league', gameType = 'League') {
  const row = Array(19).fill('')
  row[FORM.DIVISION] = division
  row[FORM.DATE] = date
  row[FORM.PLAYER1] = player1
  row[FORM.PLAYER2] = player2
  row[FORM.EVENT_ID] = eventId
  row[FORM.GAME_TYPE] = gameType
  row[FORM.GAME_RESULT] = 'Player 1'
  return row
}
const rows = [
  gameRow('Main Man', '2026-07-01', 'Alpha', 'Beta'),
  gameRow('Main Man', '2026-07-02', 'Beta', 'Alpha'), // duplicate pair
  gameRow('Main Man', '2026-07-03', 'Alpha', 'Gamma', 'event-current-league', 'Casual'),
  gameRow('Main Man', '2026-07-04', 'Alpha', 'Echo'), // cross division
  gameRow('Main Man', '2026-07-05', 'Alpha', 'Delta', 'event-lobo-s-american-top-40', 'Tournament'),
  gameRow('Main Man', '', 'Alpha', 'Gamma'), // incomplete
  gameRow('Proving Grounds A', '2026-07-06', 'Echo', 'Foxtrot'),
  gameRow('Proving Grounds A', '2026-07-07', 'Foxtrot', 'Echo'), // duplicate pair
  gameRow('Proving Grounds B', '2026-07-08', 'India', 'Juliet'),
  gameRow('Proving Grounds B', '2026-07-09', 'India', 'Kilo', 'event-august-2026-team-tournament', 'Tournament'),
]
const playerIndex = sandbox.buildPublicSnapshotPlayerIndex_(playersTable)
const games = sandbox.buildPublicSnapshotGameContext_({ headers, rows }, playerIndex)
const divisions = sandbox.buildPublicSnapshotRemainingMatchups_(playersTable, games)
assert.doesNotThrow(() => sandbox.validatePublicSnapshotRemainingMatchups_(divisions))

const byDivision = Object.fromEntries(divisions.map((division) => [division.division, division]))
for (const division of Object.values(byDivision)) {
  assert.equal(division.playerCount, 4)
  assert.equal(division.totalPossibleUniqueMatchups, 6)
  assert.equal(division.completedUniqueMatchups, 1)
  assert.equal(division.remainingUniqueMatchups, 5)
  for (const player of division.players) {
    assert.equal(player.opponentsCompleted + player.opponentsRemaining, 3)
    assert.equal(new Set([...player.completedOpponents, ...player.remainingOpponents].map((opponent) => opponent.player)).size, 3)
    assert.equal([...player.completedOpponents, ...player.remainingOpponents].some((opponent) => opponent.player === player.player), false)
  }
}
const alpha = byDivision['Main Man'].players.find((player) => player.player === 'Alpha')
assert.deepEqual(JSON.parse(JSON.stringify(alpha.completedOpponents.map((opponent) => opponent.player))), ['Beta'])
assert.deepEqual(JSON.parse(JSON.stringify(alpha.remainingOpponents.map((opponent) => opponent.player))), ['Delta', 'Gamma'])
assert.equal(alpha.remainingOpponents.some((opponent) => opponent.player === 'Echo'), false)
assert.equal(alpha.remainingOpponents.some((opponent) => opponent.player === 'Inactive'), false)

for (const division of divisions) {
  const members = Object.fromEntries(division.players.map((player) => [player.player, player]))
  for (const player of division.players) {
    for (const opponent of player.completedOpponents) {
      assert.equal(members[opponent.player].completedOpponents.some((item) => item.player === player.player), true)
    }
    for (const opponent of player.remainingOpponents) {
      assert.equal(members[opponent.player].remainingOpponents.some((item) => item.player === player.player), true)
    }
  }
}

console.log('Current League remaining-matchups regression passed.')
