import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const importer = readFileSync(new URL('../backend/ResponseImporter.gs', import.meta.url), 'utf8')
const validation = readFileSync(new URL('../backend/CanonicalValidationService.gs', import.meta.url), 'utf8')

function extract(source, name) {
  const start = source.indexOf(`function ${name}`)
  assert.notEqual(start, -1, `${name} must exist.`)
  let depth = 0
  let body = false
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; body = true }
    if (source[i] === '}') depth -= 1
    if (body && depth === 0) return source.slice(start, i + 1)
  }
  throw new Error(`Unable to extract ${name}.`)
}

const context = {
  LIF_FORMS: { TYPES: { CASUAL: 'casual' }, FIELDS: {
    MISSION: 'Mission', PLAYER: 'Player', OPPONENT: 'Opponent',
    PLAYER_FACTION: 'Player Faction', OPPONENT_FACTION: 'Opponent Faction',
    PLAYER_ARMY_CODE: 'Player Army Code', OPPONENT_ARMY_CODE: 'Opponent Army Code',
    PLAYER_TP: 'Player Tournament Points', OPPONENT_TP: 'Opponent Tournament Points',
    PLAYER_OP: 'Player Objective Points', OPPONENT_OP: 'Opponent Objective Points',
    PLAYER_VP: 'Player Victory Points', OPPONENT_VP: 'Opponent Victory Points',
    GAME_RESULT: 'Game Result', FIRST_TURN: 'First Turn', BEST_MOMENT: 'Best Moment', NOTES: 'Optional Notes',
  } },
  lifNormalizeArmyCode_: (value) => value,
  lifNormalize_: (value) => String(value ?? '').trim().toLowerCase(),
  canonicalValidationResult_: (errors, value) => ({ valid: errors.length === 0, errors, value }),
}
vm.createContext(context)
vm.runInContext([
  extract(importer, 'lifCollapseCasualResponseColumns_'),
  extract(importer, 'lifReadSubmission_'),
  extract(validation, 'canonicalValidateGoogleFormGame_'),
].join('\n'), context)

const headers = [
  'Timestamp', 'Email Address', 'Player', 'Player Faction', 'Player Army Code',
  'Opponent', 'Opponent Faction', 'Opponent Army Code',
  'Player', 'Player Faction', 'Player Army Code', 'Opponent', 'Opponent Faction', 'Opponent Army Code',
  'Mission', 'Game Result', 'First Turn', 'Player Tournament Points', 'Opponent Tournament Points',
  'Player Objective Points', 'Opponent Objective Points', 'Player Victory Points', 'Opponent Victory Points',
  'Best Moment', 'Optional Notes', 'Mission', 'Game Result', 'First Turn',
]
const values = [
  '8/27/2026 20:43:57', '', '', '', '', '', '', '',
  'Snakes / Lucas', 'Yu Jing', 'PLAYER-CODE', 'Lobo', 'Corregidor Jurisdictional Command', 'OPPONENT-CODE',
  'Provisioning', 'Opponent Victory', 'Player', '0', '5', '2', '7', '136', '216',
  'Lei Gong saving like boss and McDawg elusive granata', '', '', '', '',
]
const named = context.lifCollapseCasualResponseColumns_(headers, values)
const submission = context.lifReadSubmission_(named, 'casual', new Date('2026-08-28T00:43:56.660Z'), null)
assert.equal(submission.player, 'Snakes / Lucas')
assert.equal(submission.opponent, 'Lobo')
assert.equal(submission.playerFaction, 'Yu Jing')
assert.equal(submission.opponentFaction, 'Corregidor Jurisdictional Command')
assert.equal(submission.playerArmyCode, 'PLAYER-CODE')
assert.equal(submission.opponentArmyCode, 'OPPONENT-CODE')
assert.equal(submission.mission, 'Provisioning')
assert.equal(submission.gameResult, 'Opponent Victory')
assert.equal(submission.firstTurn, 'Player')
assert.deepEqual(
  [submission.playerTp, submission.opponentTp, submission.playerOp, submission.opponentOp, submission.playerVp, submission.opponentVp],
  ['0', '5', '2', '7', '136', '216'],
)
assert.equal(submission.bestMoment, 'Lei Gong saving like boss and McDawg elusive granata')
assert.equal(submission.notes, '')
assert.equal(context.canonicalValidateGoogleFormGame_(submission).valid, true)

const malformed = context.lifReadSubmission_(context.lifCollapseCasualResponseColumns_(headers, headers.map(() => '')), 'casual', new Date(), null)
assert.equal(context.canonicalValidateGoogleFormGame_(malformed).valid, false)
assert.throws(
  () => context.lifCollapseCasualResponseColumns_(['Player', 'Player'], ['Lobo', 'Other']),
  /conflicting values/,
)
assert.match(extract(importer, 'handleLoboFormSubmit'), /formType === LIF_FORMS\.TYPES\.CASUAL[\s\S]*lifBuildCasualNamedValuesFromResponseRow_/)

console.log('casual response mapping regression checks passed')
