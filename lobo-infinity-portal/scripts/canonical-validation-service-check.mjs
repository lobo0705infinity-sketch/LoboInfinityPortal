import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const state = {
  event: { id: 'league-1', type: 'League', accepting: true },
  registrations: [{ player: 'Alice' }, { player: 'Bob' }],
  duplicate: false,
  registration: { player: 'Alice', status: 'Active' },
  roundActive: true,
  assignment: {
    roundId: 'round-1',
    round: 1,
    teamA: 'Wolves',
    teamB: 'Ravens',
    player: 'Alice',
    opponent: 'Bob',
    mission: 'Panic Room',
    table: '1'
  },
  teamDuplicate: false,
}

const string = (value) => String(value ?? '').trim()
const normalize = (value) => string(value).toLowerCase()
const score = (value) => {
  const raw = string(value)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
const pairScore = (value) => {
  const match = string(value).match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
  return match
    ? { valid: true, left: Number(match[1]), right: Number(match[2]) }
    : { valid: false, left: 0, right: 0 }
}
const armyList = (id, _player, _faction, code) => {
  if (string(code)) return { valid: true, id: 'derived', list: null }
  if (String(id) === 'bad')
    return { valid: false, error: 'Selected Army List must be an approved submitted list.' }
  return { valid: true, id: String(id), list: { armyCode: 'stored' } }
}
const determineWinner = (player, opponent, playerTp, opponentTp, playerOp, opponentOp, playerVp, opponentVp) => {
  if (playerTp !== opponentTp) return playerTp > opponentTp ? player : opponent
  if (playerOp !== opponentOp) return playerOp > opponentOp ? player : opponent
  if (playerVp !== opponentVp) return playerVp > opponentVp ? player : opponent
  return 'Draw'
}

const context = vm.createContext({
  EVENT_ENGINE_DEFAULT_EVENT_ID: 'league-1',
  EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID: 'team-1',
  lifNormalize_: normalize,
  resolveEventId: string,
  getEventByIdSnapshot: (id) => state.event && (id === state.event.id || id === 'team-1') ? state.event : null,
  getCurrentLeagueEventSnapshot: () => state.event,
  isLeagueResultEventAcceptingResults: (event) => event.accepting !== false,
  getResultSubmissionString: string,
  getCanonicalPlayerFromUser: (user) => string(user?.player),
  normalizeResultSubmissionValue: normalize,
  getEventRegistrationRows: () => state.registrations,
  isResultSubmissionRegisteredPlayer: (rows, player) => rows.some((row) => normalize(row.player) === normalize(player)),
  hasExistingLeagueResult: () => state.duplicate,
  parseResultSubmissionScore: score,
  canonicalizeArmyName: string,
  validateResultSubmissionArmyListId: armyList,
  determineLeagueSubmissionWinner: determineWinner,
  getTeamTournamentString: string,
  getEventRegistrationForPlayer: () => state.registration,
  getEventParticipantKey: (_event, user) => string(user?.player),
  getTeamTournamentCurrentRound: () => ({ id: 'round-1' }),
  isTeamTournamentRoundActive: () => state.roundActive,
  getTeamTournamentPairings: () => [state.assignment],
  resolveTeamTournamentResultAssignment: () => state.assignment,
  buildCommissionerTeamTournamentOverrideAssignment: () => state.assignment,
  parseTeamTournamentSubmittedScore: pairScore,
  teamTournamentSameValue: (left, right) => normalize(left) === normalize(right),
  getTeamTournamentResults: () => [],
  hasSubmittedTeamTournamentResult: () => state.teamDuplicate,
})

vm.runInContext(fs.readFileSync('backend/CanonicalValidationService.gs', 'utf8'), context)

const legacyGoogleValidation = (submission) => {
  const errors = []
  const required = ['mission', 'player', 'opponent', 'playerFaction', 'opponentFaction',
    'playerArmyCode', 'opponentArmyCode', 'gameResult', 'firstTurn']
  required.forEach((key) => {
    if (!String(submission[key] || '').trim()) errors.push(`${key} is required.`)
  })
  if (normalize(submission.player) === normalize(submission.opponent))
    errors.push('Player and opponent must be different.')
  ;['playerTp', 'opponentTp', 'playerOp', 'opponentOp', 'playerVp', 'opponentVp']
    .forEach((key) => {
      const value = Number(submission[key])
      if (!Number.isInteger(value) || value < 0)
        errors.push(`${key} must be a non-negative whole number.`)
    })
  if (Number(submission.playerTp) + Number(submission.opponentTp) > 10)
    errors.push('Tournament Points cannot total more than 10.')
  if (!['Player Victory', 'Opponent Victory', 'Draw'].includes(submission.gameResult))
    errors.push('Game Result is invalid.')
  if (!['Player', 'Opponent'].includes(submission.firstTurn))
    errors.push('First Turn is invalid.')
  return errors
}

const readScores = (params) => ({
  playerTp: score(params.playerTournamentPoints),
  opponentTp: score(params.opponentTournamentPoints),
  playerOp: score(params.playerObjectivePoints),
  opponentOp: score(params.opponentObjectivePoints),
  playerVp: score(params.playerVictoryPoints),
  opponentVp: score(params.opponentVictoryPoints),
})

const legacyPortalLeague = ({ params, auth, commissionerContext }) => {
  const eventId = string(params.eventId || 'league-1')
  const event = context.getEventByIdSnapshot(eventId) || state.event
  if (!event) return 'Event was not found.'
  if (!context.isLeagueResultEventAcceptingResults(event)) return 'This event is not currently accepting results.'
  const player = string(params.player) || string(auth?.user?.player)
  const opponent = string(params.opponent)
  if (!player || !opponent) return 'Player and opponent are required.'
  if (normalize(player) === normalize(opponent)) return 'Opponent must be a different player.'
  const registrations = state.registrations
  if (!commissionerContext.override && !context.isResultSubmissionRegisteredPlayer(registrations, player))
    return 'Player is not registered for this event.'
  if (!commissionerContext.override && !context.isResultSubmissionRegisteredPlayer(registrations, opponent))
    return 'Opponent is not registered for this event.'
  if (!commissionerContext.override && state.duplicate) return 'This match has already been reported.'
  const scores = readScores(params)
  if (Object.values(scores).some((value) => value === null)) return 'Scores must be non-negative numbers.'
  if (scores.playerTp + scores.opponentTp > 10) return 'Tournament Points cannot total more than 10.'
  const playerFaction = string(params.playerFaction)
  const opponentFaction = string(params.opponentFaction)
  if (!playerFaction || !opponentFaction) return 'Both factions are required.'
  const playerList = armyList(params.playerArmyListId, player, playerFaction, params.playerArmyCode)
  if (!playerList.valid) return playerList.error
  const opponentList = armyList(params.opponentArmyListId, opponent, opponentFaction, params.opponentArmyCode)
  if (!opponentList.valid) return opponentList.error
  return ''
}

const legacyPortalCasual = ({ params, auth }) => {
  const player = string(params.player) || string(auth?.user?.playerDisplayName || auth?.user?.displayName || auth?.user?.email)
  const opponent = string(params.opponent)
  if (!player || !opponent) return 'Players are required.'
  if (normalize(player) === normalize(opponent)) return 'Opponent must be a different player.'
  const playerFaction = string(params.playerFaction)
  const opponentFaction = string(params.opponentFaction)
  if (!playerFaction) return 'Player faction is required.'
  if (!opponentFaction) return 'Opponent faction is required.'
  const playerList = armyList(params.playerArmyListId, player, playerFaction, params.playerArmyCode)
  if (!playerList.valid) return playerList.error
  const opponentList = armyList(params.opponentArmyListId, opponent, opponentFaction, params.opponentArmyCode)
  if (!opponentList.valid) return opponentList.error
  if (!string(params.mission)) return 'Mission is required.'
  if (!string(params.firstTurn)) return 'First Turn is required.'
  if (!string(params.bestMoment)) return 'Best Moment is required.'
  const scores = readScores(params)
  if (Object.values(scores).some((value) => value === null)) return 'Scores must be non-negative numbers.'
  if (scores.playerTp + scores.opponentTp > 10) return 'Tournament Points cannot total more than 10.'
  return ''
}

const legacyTeamPolicy = (params, assignment) => {
  const issues = []
  const tournamentPoints = pairScore(params.tournamentPoints)
  const objectivePoints = pairScore(params.objectivePoints)
  const victoryPoints = pairScore(params.victoryPoints)
  if (!assignment.opponent && !string(params.opponent))
    issues.push('Opponent could not be resolved from the published pairing.')
  ;[
    ['roundId', 'roundId', 'Round'],
    ['teamA', 'teamA', 'Team'],
    ['teamB', 'teamB', 'Opponent team'],
    ['player', 'player', 'Player'],
    ['opponent', 'opponent', 'Opponent'],
    ['mission', 'mission', 'Mission'],
    ['table', 'table', 'Table'],
  ].forEach(([submittedKey, expectedKey, label]) => {
    const submitted = string(params[submittedKey])
    const expected = string(assignment[expectedKey])
    if (submitted && expected && normalize(submitted) !== normalize(expected))
      issues.push(`${label} does not match the published pairing.`)
  })
  if (!tournamentPoints.valid || !objectivePoints.valid || !victoryPoints.valid)
    issues.push('Scores must use the published you-opponent format, for example 7-3.')
  if (tournamentPoints.valid && tournamentPoints.left + tournamentPoints.right > 10)
    issues.push('Tournament Points cannot total more than 10.')
  if (!string(params.winner)) issues.push('Game Result is required.')
  return issues
}

const legacyPortalTeam = ({ params, auth, commissionerContext }) => {
  const eventId = string(params.eventId || 'team-1')
  const event = context.getEventByIdSnapshot(eventId) || context.getEventByIdSnapshot('team-1')
  if (!event || string(event.type) !== 'Team Tournament')
    return 'Portal result submission is only enabled for Team Tournament events.'
  const selectedPlayer = commissionerContext.enabled ? string(params.player) : ''
  const registration = commissionerContext.enabled && selectedPlayer
    ? state.registration
    : state.registration && auth?.user
  if ((!registration || registration.status === 'Withdrawn') && !commissionerContext.override)
    return 'You must be registered for this Team Tournament before submitting a result.'
  if (!state.roundActive) return 'This Team Tournament round is not currently accepting results.'
  const assignment = state.assignment
  if (!assignment) return 'No active table pairing was found for your registration.'
  const issues = legacyTeamPolicy(params, assignment)
  if (issues.length) return issues.join(' ')
  if (!commissionerContext.override && state.teamDuplicate) return 'This match has already been submitted.'
  return ''
}

const baseGoogle = {
  mission: 'Panic Room', player: 'Alice', opponent: 'Bob',
  playerFaction: 'O-12', opponentFaction: 'ALEPH',
  playerArmyCode: 'AAA', opponentArmyCode: 'BBB',
  gameResult: 'Player Victory', firstTurn: 'Player',
  playerTp: 5, opponentTp: 0, playerOp: 10, opponentOp: 4,
  playerVp: 100, opponentVp: 70,
}

for (const workflow of ['league', 'casual', 'team-tournament']) {
  for (const submission of [
    { ...baseGoogle, formType: workflow },
    {
      ...baseGoogle,
      formType: workflow,
      mission: '',
      opponent: ' Alice ',
      playerTp: -1,
      gameResult: 'Unknown',
      firstTurn: 'Unknown',
    },
  ]) {
    const before = legacyGoogleValidation(submission)
    const after = context.validateCanonicalGame({ source: 'google-form', workflow, submission })
    assert.deepEqual([...after.errors], before, `${workflow} Google Form validation changed`)
    assert.equal(after.valid, before.length === 0, `${workflow} Google Form acceptance changed`)
  }
}

const basePortal = {
  player: 'Alice', opponent: 'Bob', mission: 'Panic Room', firstTurn: 'Alice', bestMoment: 'A crit',
  playerFaction: 'O-12', opponentFaction: 'ALEPH', playerArmyCode: 'AAA', opponentArmyCode: 'BBB',
  playerTournamentPoints: '5', opponentTournamentPoints: '0',
  playerObjectivePoints: '10', opponentObjectivePoints: '4',
  playerVictoryPoints: '100', opponentVictoryPoints: '70', winner: 'Alice',
}
const portalAuth = { user: { player: 'Alice', playerDisplayName: 'Alice' } }
const normalCommissioner = { enabled: false, override: false }

const assertPortalEquivalent = (workflow, command, legacy) => {
  const before = legacy(command)
  const after = context.validateCanonicalGame({ source: 'portal', workflow, ...command })
  assert.equal(after.error, before, `${workflow} error message changed`)
  assert.equal(after.valid, before === '', `${workflow} acceptance changed`)
}

state.event = { id: 'league-1', type: 'League', accepting: true }
state.registrations = [{ player: 'Alice' }, { player: 'Bob' }]
state.duplicate = false
for (const params of [
  { ...basePortal, eventId: 'league-1' },
  { ...basePortal, eventId: 'league-1', opponent: 'Alice' },
  { ...basePortal, eventId: 'league-1', playerTournamentPoints: '-1' },
  { ...basePortal, eventId: 'league-1', playerFaction: '' },
]) assertPortalEquivalent('league', { params, auth: portalAuth, commissionerContext: normalCommissioner }, legacyPortalLeague)

for (const params of [
  { ...basePortal },
  { ...basePortal, bestMoment: '' },
  { ...basePortal, opponent: 'Alice' },
  { ...basePortal, opponentArmyCode: '', opponentArmyListId: 'bad' },
]) assertPortalEquivalent('casual', { params, auth: portalAuth, commissionerContext: normalCommissioner }, legacyPortalCasual)

state.event = { id: 'team-1', type: 'Team Tournament' }
state.registration = { player: 'Alice', status: 'Active' }
state.roundActive = true
state.assignment = {
  roundId: 'round-1', round: 1, teamA: 'Wolves', teamB: 'Ravens',
  player: 'Alice', opponent: 'Bob', mission: 'Panic Room', table: '1',
}
state.teamDuplicate = false
const baseTeam = {
  eventId: 'team-1', roundId: 'round-1', teamA: 'Wolves', teamB: 'Ravens',
  player: 'Alice', opponent: 'Bob', mission: 'Panic Room', table: '1',
  tournamentPoints: '5-0', objectivePoints: '10-4', victoryPoints: '100-70', winner: 'Alice',
}
for (const params of [
  { ...baseTeam },
  { ...baseTeam, mission: 'Wrong', tournamentPoints: 'bad', winner: '' },
]) assertPortalEquivalent('team-tournament', { params, auth: portalAuth, commissionerContext: normalCommissioner }, legacyPortalTeam)

state.teamDuplicate = true
assertPortalEquivalent(
  'team-tournament',
  { params: { ...baseTeam }, auth: portalAuth, commissionerContext: normalCommissioner },
  legacyPortalTeam,
)

const importer = fs.readFileSync('backend/ResponseImporter.gs', 'utf8')
const resultApi = fs.readFileSync('backend/ResultSubmissionApi.gs', 'utf8')
const teamApi = fs.readFileSync('backend/TeamTournamentApi.gs', 'utf8')
const validationSource = fs.readFileSync('backend/CanonicalValidationService.gs', 'utf8')

assert.match(importer, /validateCanonicalGame\s*\(\s*\{[\s\S]*?source:\s*"google-form"/)
assert.match(resultApi, /workflow:\s*"league"/)
assert.match(resultApi, /workflow:\s*"casual"/)
assert.match(teamApi, /workflow:\s*"team-tournament"/)
assert.doesNotMatch(teamApi, /function\s+validateTeamTournamentResultSubmission\s*\(/)
assert.equal((validationSource.match(/function\s+validateCanonicalGame\s*\(/g) || []).length, 1)

console.log('Canonical validation equivalence: League PASS')
console.log('Canonical validation equivalence: Casual PASS')
console.log('Canonical validation equivalence: Team Tournament PASS')
console.log('Canonical validation regression suite: PASS')
