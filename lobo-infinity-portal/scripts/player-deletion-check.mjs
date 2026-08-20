import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync('backend/PlayerDeletionApi.gs', 'utf8')
const router = readFileSync('backend/API.gs', 'utf8')
const ui = readFileSync('src/pages/CommissionerPlayers.tsx', 'utf8')
const onboarding = readFileSync('backend/ResponseImporter.gs', 'utf8')

const sheetNames = {
  PLAYERS: 'Players', FORM: 'Form Responses', ENGINE: 'Game Engine',
  ARMY_LISTS: 'Army Lists', ARMY_INTELLIGENCE: 'Army Intelligence',
  ACHIEVEMENTS: 'Achievements', SEASON_AVAILABILITY: 'Season Availability',
  SCHEDULING_REQUESTS: 'Scheduling Requests', EVENT_PARTICIPANTS: 'Event Participants',
  TEAM_TOURNAMENT_TEAMS: 'Team Tournament Teams', TEAM_TOURNAMENT_PAIRINGS: 'Team Tournament Pairings',
  TEAM_TOURNAMENT_INVITATIONS: 'Team Tournament Invitations', USERS: 'Users',
  ARMY_CODE_VALIDATION_AUDIT: 'Army Code Validation Audit',
  GAME_SCORE_CORRECTION_AUDIT: 'Game Score Correction Audit',
  GAME_ARMY_CODE_CORRECTION_AUDIT: 'Game Army Code Correction Audit',
  SEASON_ARCHIVE: 'Season Archive',
}

function makeSheet(values) {
  return {
    values: values.map((row) => row.slice()),
    deleteRow(rowNumber) { this.values.splice(rowNumber - 1, 1) },
    getDataRange() { return { getValues: () => this.values.map((row) => row.slice()) } },
    getLastRow() { return this.values.length },
  }
}

function makeScenario(extraSheets = {}) {
  const sheets = {
    Players: makeSheet([
      ['Player', 'Display Name', 'Division', 'Active'],
      ['TestPlayer', 'TestPlayer', '', true],
    ]),
    'Event Participants': makeSheet([
      ['Event ID', 'Player', 'Display Name', 'Role', 'Status', 'Registered At', 'Seed', 'Team', 'Notes', 'Email', 'Discord', 'Preferred Team', 'Captain', 'Free Agent', 'Faction', 'Updated At'],
      ['event-current-league', 'TestPlayer', 'TestPlayer', 'Player', 'Active', '', '', '', '', '', '', '', '', '', '', ''],
    ]),
    'Join Form Responses': makeSheet([['Timestamp', 'Player Name / Handle'], ['now', 'TestPlayer']]),
    'Google Forms Import Log': makeSheet([['Response Key', 'Form Type'], ['1:2', 'join-community']]),
    ...extraSheets,
  }
  let registryInvalidated = 0
  let eventInvalidated = 0
  let portalInvalidated = 0
  const spreadsheet = { getSheetByName: (name) => sheets[name] || null }
  const sandbox = {
    CONFIG: { SHEETS: sheetNames }, EVENT_ENGINE_DEFAULT_EVENT_ID: 'event-current-league', JSON,
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    getApiParameters: (e) => e.parameter || {}, getPlayerRegistryString: (value) => String(value ?? '').trim(),
    invalidateEventEngineSnapshotCache: () => { eventInvalidated += 1 },
    invalidatePlayerRegistryCache: () => { registryInvalidated += 1 },
    invalidatePortalCacheGroup: () => { portalInvalidated += 1 },
    jsonOutput: (value) => value, lifGetTargetSpreadsheet_: () => spreadsheet,
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox)
  return {
    result: () => sandbox.deleteCanonicalPlayer({ parameter: { player: 'TestPlayer' } }),
    sheets,
    invalidations: () => ({ eventInvalidated, portalInvalidated, registryInvalidated }),
  }
}

const unused = makeScenario()
const unusedResult = unused.result()
const game = makeScenario({
  'Form Responses': makeSheet([['Player 1', 'Player 2'], ['TestPlayer', 'Opponent']]),
})
const gameResult = game.result()
const list = makeScenario({
  'Army Lists': makeSheet([['Player'], ['TestPlayer']]),
})
const listResult = list.result()
const historical = makeScenario({
  'Event Participants': makeSheet([
    ['Event ID', 'Player', 'Display Name', 'Role', 'Status', 'Registered At'],
    ['event-old-league', 'TestPlayer', 'TestPlayer', 'Player', 'Complete', '2025-01-01'],
  ]),
})
const historicalResult = historical.result()
const tournament = makeScenario({
  'Team Tournament Teams': makeSheet([['Captain', 'Players'], ['Other', 'TestPlayer; Teammate']]),
})
const tournamentResult = tournament.result()
const availability = makeScenario({
  'Season Availability': makeSheet([['Player', 'Status'], ['TestPlayer', 'Available']]),
})
const availabilityResult = availability.result()

const checks = [
  ['Unused onboarding Player deletion succeeds', unusedResult.success === true],
  ['Canonical Player row is removed', unused.sheets.Players.values.length === 1],
  ['Eligible synthesized participant is removed', unused.sheets['Event Participants'].values.length === 1],
  ['Player/event/portal caches are invalidated', Object.values(unused.invalidations()).every((count) => count === 1)],
  ['Player with game is refused before deletion', gameResult.code === 'PLAYER_HAS_HISTORY' && game.sheets.Players.values.length === 2],
  ['Player with Army List is refused', listResult.code === 'PLAYER_HAS_HISTORY' && list.sheets.Players.values.length === 2],
  ['Historical event participant is refused', historicalResult.code === 'PLAYER_HAS_HISTORY' && historical.sheets.Players.values.length === 2],
  ['Team Tournament dependency is refused', tournamentResult.code === 'PLAYER_HAS_HISTORY' && tournament.sheets.Players.values.length === 2],
  ['Other authoritative dependency is refused', availabilityResult.code === 'PLAYER_HAS_HISTORY' && availability.sheets.Players.values.length === 2],
  ['Join Form response and import log do not block deletion and remain preserved', unused.sheets['Join Form Responses'].values.length === 2 && unused.sheets['Google Forms Import Log'].values.length === 2],
  ['Anonymous/non-Commissioner requests use existing Commissioner permission guard', router.includes('case "deleteCanonicalPlayer"') && router.includes('requireApiPermission(e, "runSeasonControl"')],
  ['Commissioner UI requires permission and explicit Handle confirmation', ui.includes("auth.hasPermission('runSeasonControl')") && ui.includes('Delete ${selectedPlayer}?') && ui.includes('window.confirm')],
  ['Onboarding submission architecture remains intact', onboarding.includes('lifImportCommunityPlayer_') && onboarding.includes('createCanonicalPlayer(handle)')],
]

let failed = false
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  failed ||= !pass
}
if (failed) process.exitCode = 1
