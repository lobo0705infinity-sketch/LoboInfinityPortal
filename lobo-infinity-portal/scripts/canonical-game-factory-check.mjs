import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const fixedNow = '2026-08-11T16:17:18.000Z'

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [fixedNow]))
  }
}

const formatDate = (date, _timeZone, format) => {
  const value = new Date(date)
  const iso = value.toISOString()
  return format === 'yyyy-MM-dd'
    ? iso.slice(0, 10)
    : `${iso.slice(0, 10)} ${iso.slice(11, 19)}`
}

const normalizeArmyCode = (value) => String(value ?? '')
  .trim()
  .replace(/\s+/g, '')
  .replace(/[-_]/g, '')

const buildArmyListId = (value) => {
  const code = normalizeArmyCode(value)
  let hash = 5381
  for (let index = 0; index < code.length; index += 1)
    hash = (hash * 33) ^ code.charCodeAt(index)
  return 800000000 + (hash >>> 0)
}

const canonicalizeArmyName = (value) => ({
  'vanilla pano': 'PanOceania',
  'vanilla o-12': 'O-12',
}[String(value ?? '').trim().toLowerCase()] ?? String(value ?? '').trim())

const context = vm.createContext({
  Date: FixedDate,
  LIF_FORMS: {
    TYPES: {
      LEAGUE: 'league',
      TEAM: 'team-tournament',
      CASUAL: 'casual',
    },
  },
  Session: {
    getScriptTimeZone: () => 'UTC',
  },
  Utilities: {
    formatDate,
  },
  buildCanonicalArmyCodeArmyListId: buildArmyListId,
  canonicalizeArmyName,
})

vm.runInContext(fs.readFileSync('backend/GameFactory.gs', 'utf8'), context)
vm.runInContext(fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8'), context)

const oldDetermineWinner = (submission) => {
  if (submission.gameResult === 'Draw') return 'Draw'
  return submission.gameResult === 'Player Victory'
    ? submission.player
    : submission.opponent
}

const oldResolveFirstTurn = (submission) => {
  const firstTurn = String(submission.firstTurn || '').trim()
  const normalized = firstTurn.toLowerCase()
  if (normalized === 'player' || normalized === String(submission.player || '').trim().toLowerCase())
    return String(submission.player || '').trim()
  if (normalized === 'opponent' || normalized === String(submission.opponent || '').trim().toLowerCase())
    return String(submission.opponent || '').trim()
  return firstTurn
}

const oldImportedCanonicalRow = (submission) => {
  if (submission.formType === 'casual') {
    const winner = oldDetermineWinner(submission)
    const playerWins = winner === submission.player || winner === 'Draw'
    return [
      submission.timestamp,
      submission.division,
      new FixedDate(),
      submission.mission,
      submission.player,
      submission.opponent,
      Number(submission.playerTp),
      Number(submission.opponentTp),
      Number(submission.playerOp),
      Number(submission.opponentOp),
      Number(submission.playerVp),
      Number(submission.opponentVp),
      submission.firstTurn === 'Player' ? submission.player : submission.opponent,
      playerWins ? submission.playerFaction : submission.opponentFaction,
      playerWins ? submission.opponentFaction : submission.playerFaction,
      submission.bestMoment,
      submission.eventId,
      'casual',
      winner,
      submission.playerArmyCode,
      submission.opponentArmyCode,
      '',
      '',
    ]
  }

  const winner = oldDetermineWinner(submission)
  const playerWins = winner === submission.player || winner === 'Draw'
  const playerFaction = canonicalizeArmyName(submission.playerFaction)
  const opponentFaction = canonicalizeArmyName(submission.opponentFaction)
  const playerArmyCode = normalizeArmyCode(submission.playerArmyCode)
  const opponentArmyCode = normalizeArmyCode(submission.opponentArmyCode)
  const playerArmyListId = String(buildArmyListId(playerArmyCode))
  const opponentArmyListId = String(buildArmyListId(opponentArmyCode))
  return [
    formatDate(new FixedDate(), 'UTC', 'yyyy-MM-dd HH:mm:ss'),
    String(submission.division || '').trim(),
    formatDate(new FixedDate(), 'UTC', 'yyyy-MM-dd'),
    String(submission.mission || '').trim(),
    String(submission.player || '').trim(),
    String(submission.opponent || '').trim(),
    Number(submission.playerTp),
    Number(submission.opponentTp),
    Number(submission.playerOp),
    Number(submission.opponentOp),
    Number(submission.playerVp),
    Number(submission.opponentVp),
    oldResolveFirstTurn(submission),
    playerWins ? playerFaction : opponentFaction,
    playerWins ? opponentFaction : playerFaction,
    String(submission.bestMoment || '').trim(),
    String(submission.eventId || '').trim(),
    submission.formType === 'team-tournament' ? 'tournament' : 'league',
    winner === 'Draw' ? 'Draw' : playerWins ? 'Player 1 Victory' : 'Player 2 Victory',
    playerArmyCode,
    opponentArmyCode,
    playerWins ? playerArmyListId : opponentArmyListId,
    playerWins ? opponentArmyListId : playerArmyListId,
  ]
}

const normalizeCell = (value) => {
  if (Object.prototype.toString.call(value) === '[object Date]')
    return { type: 'Date', value: new Date(value).toISOString() }
  return { type: typeof value, value }
}

const assertRowsEqual = (label, before, after) => {
  assert.equal(before.length, 23, `${label} reference row must contain 23 columns`)
  assert.equal(after.length, 23, `${label} factory row must contain 23 columns`)
  assert.equal(
    JSON.stringify(Array.from(after, normalizeCell)),
    JSON.stringify(Array.from(before, normalizeCell)),
    `${label} row changed`,
  )
}

const commonSubmission = {
  timestamp: new FixedDate('2026-08-10T13:14:15.000Z'),
  division: 'Main Man',
  mission: 'Panic Room',
  player: 'Alpha',
  opponent: 'Bravo',
  playerTp: '3',
  opponentTp: '7',
  playerOp: '4',
  opponentOp: '8',
  playerVp: '51',
  opponentVp: '82',
  firstTurn: 'Player',
  playerFaction: 'vanilla pano',
  opponentFaction: 'vanilla o-12',
  bestMoment: '',
  eventId: 'event-current-league',
  gameResult: 'Opponent Victory',
  playerArmyCode: ' P1-ARMY_CODE ',
  opponentArmyCode: ' P2-ARMY_CODE ',
}

const submissions = [
  ['League', {
    ...commonSubmission,
    formType: 'league',
    gameResult: 'Player Victory',
  }],
  ['Casual', {
    ...commonSubmission,
    formType: 'casual',
    division: 'Casual',
    eventId: '',
    playerFaction: 'PanOceania',
    opponentFaction: 'O-12',
    playerArmyCode: normalizeArmyCode(commonSubmission.playerArmyCode),
    opponentArmyCode: normalizeArmyCode(commonSubmission.opponentArmyCode),
    gameResult: 'Draw',
  }],
  ['Team Tournament', {
    ...commonSubmission,
    formType: 'team-tournament',
    division: 'Team Tournament',
    eventId: 'event-team-tournament',
    round: '2',
    team: 'Alpha Team',
    opponentTeam: 'Bravo Team',
  }],
]

for (const [label, submission] of submissions) {
  const before = oldImportedCanonicalRow(submission)
  const after = context.buildCanonicalGameRow(
    context.canonicalSubmissionBuildGoogleFormGameCommand_(submission),
  )
  assertRowsEqual(label, before, after)
}

const resultSubmissionSource = fs.readFileSync('backend/ResultSubmissionApi.gs', 'utf8')
assert.doesNotMatch(resultSubmissionSource, /row\[FORM\.[A-Z0-9_]+\]\s*=/)
assert.equal((resultSubmissionSource.match(/buildCanonicalGameRow\s*\(/g) || []).length, 0)

const responseImporterSource = fs.readFileSync('backend/ResponseImporter.gs', 'utf8')
assert.equal((responseImporterSource.match(/buildCanonicalGameRow\s*\(/g) || []).length, 0)
assert.doesNotMatch(responseImporterSource, /function lifBuildCanonicalGameRow_\s*\(/)

const submissionServiceSource = fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
assert.equal((submissionServiceSource.match(/buildCanonicalGameRow\s*\(/g) || []).length, 3)

console.log('PASS: Canonical rows are identical before and after the extraction.')
