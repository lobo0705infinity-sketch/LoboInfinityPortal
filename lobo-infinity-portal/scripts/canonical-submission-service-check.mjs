import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import vm from 'node:vm'

const runRegression = (script) => {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`)
}

runRegression('scripts/canonical-game-factory-check.mjs')
runRegression('scripts/canonical-validation-service-check.mjs')

const fixedNow = '2026-08-11T16:17:18.000Z'
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [fixedNow]))
  }
}

const events = []
const rows = []
let googleSubmission = null
let validationFailure = ''

const string = (value) => String(value ?? '').trim()
const normalizeArmyCode = (value) => string(value).replace(/\s+/g, '').replace(/[-_]/g, '')
const formatDate = (date, _timeZone, format) => {
  const iso = new Date(date).toISOString()
  return format === 'yyyy-MM-dd' ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${iso.slice(11, 19)}`
}
const armyListId = (code) => {
  let hash = 5381
  for (const char of normalizeArmyCode(code)) hash = (hash * 33) ^ char.charCodeAt(0)
  return String(800000000 + (hash >>> 0))
}
const canonicalizeArmyName = (value) => ({
  'vanilla pano': 'PanOceania',
  'vanilla o-12': 'O-12',
}[string(value).toLowerCase()] ?? string(value))

const sheet = {
  appendRow(row) {
    events.push('append')
    rows.push(row.slice())
  },
  getLastRow() {
    return rows.length + 1
  },
}

const assignment = {
  roundId: 'round-2',
  round: '2',
  teamA: 'Alpha Team',
  teamB: 'Bravo Team',
  player: 'Alice',
  opponent: 'Bob',
  mission: 'Panic Room',
  table: '4',
}

const portalValidationValue = (workflow) => ({
  eventId: workflow === 'casual' ? '' : 'event-current-league',
  player: 'Alice',
  opponent: 'Bob',
  playerTp: 5,
  opponentTp: 0,
  playerOp: 10,
  opponentOp: 4,
  playerVp: 100,
  opponentVp: 70,
  playerFaction: 'PanOceania',
  opponentFaction: 'O-12',
  playerArmyList: { valid: true, id: '111', list: null },
  opponentArmyList: { valid: true, id: '222', list: null },
  submittedResult: 'Alice',
  playerIsWinner: true,
  resultIsDraw: false,
})

const context = vm.createContext({
  Date: FixedDate,
  LIF_FORMS: {
    TYPES: { LEAGUE: 'league', CASUAL: 'casual', TEAM: 'team-tournament' },
  },
  CONFIG: { SHEETS: { FORM: 'Form Responses' } },
  FORM: { MISSION: 3, GAME_RESULT: 18, WINNER_ARMY_LIST_ID: 21, LOSER_ARMY_LIST_ID: 22 },
  Session: { getScriptTimeZone: () => 'UTC' },
  Utilities: { formatDate },
  SpreadsheetApp: { flush: () => events.push('flush') },
  Logger: { log: () => events.push('missing-rebuild-log') },
  canonicalizeArmyName,
  buildCanonicalArmyCodeArmyListId: armyListId,
  validateCanonicalGame(command) {
    events.push(`validate:${command.source}:${command.workflow}`)
    if (validationFailure)
      return { valid: false, errors: [validationFailure], error: validationFailure, value: {} }
    if (command.source === 'google-form')
      return { valid: true, errors: [], error: '', value: { submission: command.submission } }
    if (command.workflow === 'team-tournament')
      return {
        valid: true,
        errors: [],
        error: '',
        value: { eventId: 'event-team-tournament', assignment },
      }
    return { valid: true, errors: [], error: '', value: portalValidationValue(command.workflow) }
  },
  lifWasImported_() {
    events.push('idempotency')
    return false
  },
  lifReadSubmission_() {
    events.push('context')
    return googleSubmission
  },
  lifWriteImportLog_(_log, _key, _workflow, _row, status) {
    events.push(`import-log:${status}`)
  },
  lifEnsureCanonicalSheet_() {
    events.push('canonical-sheet')
    return sheet
  },
  lifGetTargetSpreadsheet_() {
    return { getSheetByName: () => sheet }
  },
  ensureResultSubmissionArmyListHeaders() {
    events.push('army-list-headers')
  },
  getResultSubmissionString: string,
  getResultSubmissionTimestamp: () => '2026-08-11 12:17:18',
  getResultSubmissionDate: () => '2026-08-11',
  getResultSubmissionArmyCode: normalizeArmyCode,
  getResultSubmissionArmyListId: (list) => list.id,
  recordResultSubmissionCommissionerAudit() {
    events.push('audit')
  },
  rebuildEverything() {
    events.push('rebuild')
  },
  publishLatestGameSubmittedAutomationEvent() {
    events.push('automation')
  },
  invalidateResultSubmissionCaches() {
    events.push('cache')
  },
  invalidateTeamTournamentRuntimeCache() {
    events.push('team-runtime-cache')
  },
  getTeamTournamentTimestamp: () => '2026-08-11 12:17:18',
  parseTeamTournamentSubmittedScore(value) {
    const [left, right] = string(value).split('-').map(Number)
    return { valid: true, left, right }
  },
  getTeamTournamentString: string,
  getTeamTournamentArmyCodeFaction: () => '',
  getTeamTournamentCanonicalGameResult_: () => 'Player Victory',
  getTeamTournamentCanonicalFirstTurn_: () => 'Player',
})

vm.runInContext(fs.readFileSync('backend/GameFactory.gs', 'utf8'), context)
const buildCanonicalGameRow = context.buildCanonicalGameRow
context.buildCanonicalGameRow = (command) => {
  events.push('factory')
  return buildCanonicalGameRow(command)
}
vm.runInContext(fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8'), context)

const normalizeRow = (row) => row.map((value) => value instanceof Date ? value.toISOString() : value)
const assertRow = (label, actual, expected) => {
  assert.deepEqual(normalizeRow(actual), normalizeRow(expected), `${label} canonical row changed`)
}
const reset = () => {
  events.length = 0
  rows.length = 0
  validationFailure = ''
}

const commonGoogle = {
  timestamp: '8/11/2026 12:17:18',
  division: 'Division A',
  eventId: 'event-current-league',
  mission: 'Panic Room',
  player: 'Alice',
  opponent: 'Bob',
  playerFaction: 'vanilla pano',
  opponentFaction: 'vanilla o-12',
  playerArmyCode: 'AAA-BBB',
  opponentArmyCode: 'CCC_DDD',
  playerTp: '5', opponentTp: '0', playerOp: '10', opponentOp: '4', playerVp: '100', opponentVp: '70',
  gameResult: 'Player Victory', firstTurn: 'Player', bestMoment: 'A crit',
}

const legacyGoogleCommand = (submission) => {
  const casual = submission.formType === 'casual'
  const command = {
    division: submission.division,
    mission: submission.mission,
    player: submission.player,
    opponent: submission.opponent,
    playerTp: submission.playerTp,
    opponentTp: submission.opponentTp,
    playerOp: submission.playerOp,
    opponentOp: submission.opponentOp,
    playerVp: submission.playerVp,
    opponentVp: submission.opponentVp,
    firstTurn: submission.firstTurn,
    firstTurnMode: casual ? 'legacy-casual' : 'canonical',
    playerFaction: submission.playerFaction,
    opponentFaction: submission.opponentFaction,
    canonicalizeFactions: !casual,
    bestMoment: submission.bestMoment,
    eventId: submission.eventId,
    gameType: casual ? 'casual' : submission.formType === 'team-tournament' ? 'tournament' : 'league',
    gameResult: submission.gameResult,
    gameResultMode: casual ? 'winner-name' : 'canonical',
    playerArmyCode: submission.playerArmyCode,
    opponentArmyCode: submission.opponentArmyCode,
    deriveArmyListIds: !casual,
  }
  if (casual) {
    command.timestamp = submission.timestamp
    command.date = new FixedDate()
    command.playerArmyListId = ''
    command.opponentArmyListId = ''
  }
  return command
}

for (const workflow of ['league', 'casual', 'team-tournament']) {
  reset()
  googleSubmission = {
    ...commonGoogle,
    formType: workflow,
    division: workflow === 'casual' ? 'Casual' : workflow === 'team-tournament' ? 'Team Tournament' : 'Division A',
    eventId: workflow === 'casual' ? '' : workflow === 'team-tournament' ? 'event-team-tournament' : 'event-current-league',
    gameResult: workflow === 'casual' ? 'Draw' : 'Player Victory',
  }
  const expected = buildCanonicalGameRow(legacyGoogleCommand(googleSubmission))
  const result = context.submitCanonicalGame({
    source: 'google-form', workflow, namedValues: {}, timestamp: googleSubmission.timestamp,
    targetSpreadsheet: {}, importLog: {}, responseKey: `sheet:${workflow}`,
  })
  assert.equal(result.success, true)
  assertRow(`Google Form ${workflow}`, result.row, expected)
  const expectedEvents = [
    'idempotency', 'context', `validate:google-form:${workflow}`, 'canonical-sheet', 'factory',
    'append', 'import-log:Imported', 'flush', 'rebuild',
  ]
  if (workflow === 'team-tournament') expectedEvents.push('team-runtime-cache')
  assert.deepEqual(events, expectedEvents, `Google Form ${workflow} rebuild order changed`)
}

const portalParams = {
  division: 'Division A', mission: 'Panic Room', firstTurn: 'Alice', bestMoment: 'A crit',
  playerArmyCode: 'AAA-BBB', opponentArmyCode: 'CCC_DDD',
}

for (const workflow of ['league', 'casual']) {
  reset()
  const validated = portalValidationValue(workflow)
  const legacyCommand = {
    timestamp: '2026-08-11 12:17:18', date: '2026-08-11',
    division: workflow === 'casual' ? 'Casual' : 'Division A', mission: 'Panic Room',
    player: validated.player, opponent: validated.opponent,
    playerTp: 5, opponentTp: 0, playerOp: 10, opponentOp: 4, playerVp: 100, opponentVp: 70,
    firstTurn: 'Alice', playerFaction: 'PanOceania', opponentFaction: 'O-12', bestMoment: 'A crit',
    eventId: validated.eventId, gameType: workflow, outcome: 'player',
    playerArmyCode: 'AAABBB', opponentArmyCode: 'CCCDDD',
    playerArmyListId: '111', opponentArmyListId: '222',
  }
  const expected = buildCanonicalGameRow(legacyCommand)
  const result = context.submitCanonicalGame({
    source: 'portal', workflow, params: portalParams, auth: {}, commissionerContext: {},
  })
  assert.equal(result.success, true)
  assertRow(`Portal ${workflow}`, result.row, expected)
  assert.deepEqual(events, [
    `validate:portal:${workflow}`, 'factory', 'army-list-headers', 'append',
    'audit', 'rebuild', 'automation', 'cache',
  ], `Portal ${workflow} rebuild order changed`)
}

reset()
const teamParams = {
  tournamentPoints: '5-0', objectivePoints: '10-4', victoryPoints: '100-70',
  playerArmyCode: 'AAA-BBB', opponentArmyCode: 'CCC_DDD',
  playerFaction: 'vanilla pano', opponentFaction: 'vanilla o-12',
  winner: 'Alice', firstTurn: 'Player', bestMoment: 'A crit', notes: '',
}
const teamResult = context.submitCanonicalGame({
  source: 'portal', workflow: 'team-tournament', params: teamParams, auth: {}, commissionerContext: {},
})
const expectedTeamRow = buildCanonicalGameRow(legacyGoogleCommand(teamResult.context.submission))
assertRow('Portal Team Tournament', teamResult.row, expectedTeamRow)
assert.deepEqual(events, [
  'validate:portal:team-tournament', 'canonical-sheet', 'factory', 'append', 'flush', 'rebuild',
  'team-runtime-cache',
], 'Portal Team Tournament rebuild order changed')

reset()
validationFailure = 'Mission is required.'
const rejected = context.submitCanonicalGame({
  source: 'portal', workflow: 'casual', params: portalParams, auth: {}, commissionerContext: {},
})
assert.equal(rejected.success, false)
assert.equal(rejected.error, 'Mission is required.')
assert.deepEqual(events, ['validate:portal:casual'], 'Rejected submissions must not append or rebuild')

const importer = fs.readFileSync('backend/ResponseImporter.gs', 'utf8')
const resultApi = fs.readFileSync('backend/ResultSubmissionApi.gs', 'utf8')
const teamApi = fs.readFileSync('backend/TeamTournamentApi.gs', 'utf8')
const service = fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
const extractFunction = (source, name) => {
  const start = source.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `${name} must exist`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  assert.fail(`${name} must have a balanced body`)
}
const callers = [
  extractFunction(importer, 'handleLoboFormSubmit'),
  extractFunction(resultApi, 'submitLeagueResult'),
  extractFunction(resultApi, 'submitCasualResult'),
  extractFunction(teamApi, 'saveTeamTournamentResult'),
]
for (const caller of callers) {
  assert.match(caller, /submitCanonicalGame\s*\(/)
  assert.doesNotMatch(caller, /validateCanonicalGame\s*\(|buildCanonicalGameRow\s*\(|\.appendRow\s*\(|rebuildEverything\s*\(|rebuildGameEngine\s*\(/)
}
assert.equal((service.match(/function\s+submitCanonicalGame\s*\(/g) || []).length, 1)
assert.doesNotMatch(importer, /function\s+lifAppendCanonicalGameSubmission_\s*\(|function\s+lifRunCanonicalGamePipeline_\s*\(/)

console.log('Canonical Submission Service rows: PASS')
console.log('Canonical Submission Service validation: PASS')
console.log('Canonical Submission Service rebuild order: PASS')
console.log('Canonical Submission Service sole orchestration ownership: PASS')
