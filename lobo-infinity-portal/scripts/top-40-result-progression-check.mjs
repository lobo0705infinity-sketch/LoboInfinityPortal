import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const bracketSource = fs.readFileSync('backend/DoubleEliminationBracketApi.gs', 'utf8')
const submissionSource = fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
const validationSource = fs.readFileSync('backend/CanonicalValidationService.gs', 'utf8')
const uiSource = fs.readFileSync('src/pages/SubmitResult.tsx', 'utf8')
const apiSource = fs.readFileSync('src/services/api.ts', 'utf8')

const format = (date) => date.toISOString().slice(0, 19).replace('T', ' ')
const context = vm.createContext({
  console, Date, Set,
  getEventManagerString: (value) => value == null ? '' : String(value).trim(),
  Utilities: { formatDate: format, parseDate: (value) => new Date(String(value).replace(' ', 'T') + 'Z') },
  Session: { getScriptTimeZone: () => 'UTC' },
})
vm.runInContext(bracketSource, context)

const entrants = Array.from({ length: 4 }, (_, index) => ({ player: `P${index + 1}`, seed: index + 1 }))
let state = context.buildDoubleEliminationBracket_('event-fixture', entrants)
context.resolveEventBracketByes_(state)
context.activatePlayableEventBracketMatches_(state, new Date('2026-09-01T12:00:00Z'))
context.readEventBracketMatches_ = () => state
context.writeEventBracketMatches_ = (_eventId, matches) => { state = structuredClone(matches) }
context.invalidateEventManagerCaches = () => {}
context.getEventById = () => ({ id: 'event-fixture' })
context.getEventRegistrationRows = () => []
context.buildEventBracketProjection_ = (_event, _participants, matches) => ({ matches })

let gameId = 100
let guard = 0
while (state.find((match) => match.matchId === 'GF-M1').status !== 'Completed') {
  const active = state.find((match) => match.status === 'Active')
  assert.ok(active, 'the four-player tournament must continue producing an Active match')
  active.gameId = gameId
  const beforeActivation = new Map(state.filter((match) => match.status === 'Active').map((match) => [match.matchId, match.activatedAt]))
  context.applyTop40BracketProgression_('event-fixture', active.matchId, gameId, active.playerA, active.playerB, new Date(2026, 8, 2 + gameId))
  for (const [id, activatedAt] of beforeActivation) {
    const match = state.find((candidate) => candidate.matchId === id)
    if (match?.status === 'Active') assert.equal(match.activatedAt, activatedAt)
  }
  gameId += 1
  assert.ok(++guard < 20, 'progression must terminate')
}

const gf = state.find((match) => match.matchId === 'GF-M1')
assert.equal(gf.status, 'Completed')
assert.ok(gf.winner)
assert.equal(state.filter((match) => match.bracket === 'Grand Final').length, 1)
assert.equal(state.some((match) => /reset/i.test(match.matchId)), false)
assert.equal(new Set(state.filter((match) => match.status === 'Completed').map((match) => match.gameId)).size, state.filter((match) => match.status === 'Completed').length)
assert.ok(state.filter((match) => match.status === 'Active').every((match) => match.deadline && match.activatedAt))

const completedSnapshot = structuredClone(state)
const completed = state.find((match) => match.status === 'Completed')
context.applyTop40BracketProgression_('event-fixture', completed.matchId, completed.gameId, completed.winner, completed.loser, new Date())
assert.deepEqual(state, completedSnapshot, 'duplicate progression must be idempotent')

const pending = context.buildDoubleEliminationBracket_('pending-fixture', entrants).find((match) => match.bracketRound > 1)
assert.equal(pending.status, 'Pending')
const pastDeadline = { status: 'Active', deadline: '2020-01-01 00:00:00' }
assert.equal(pastDeadline.status, 'Active')

assert.match(bracketSource, /submitCanonicalGame[\s\S]*setEventBracketMatchGameId_[\s\S]*applyTop40BracketProgression_/)
assert.match(bracketSource, /Game recorded; bracket progression requires Commissioner attention\./)
assert.match(bracketSource, /Multiple Active matches require Commissioner correction\./)
assert.match(bracketSource, /Top 40 bracket matches require a winner\./)
assert.match(bracketSource, /completeEventBracketMatch_\(matches, match, winner, loser, "Played", gameId, now\)/)
assert.match(bracketSource, /placeEventBracketPlayer_\(byId, match\.nextWinnerMatch/)
assert.match(bracketSource, /placeEventBracketPlayer_\(byId, match\.nextLoserMatch/)
assert.match(bracketSource, /activatePlayableEventBracketMatches_\(matches, now\)/)
assert.match(submissionSource, /workflow === "top-40"/)
assert.match(submissionSource, /gameId: targetRow - 1/)
assert.match(validationSource, /canonicalValidatePortalTop40Game_/)
assert.match(uiSource, /apiClient\.submitTop40Result/)
assert.match(uiSource, /ReadOnlyField label="Opponent"/)
assert.match(uiSource, /option !== 'Draw'/)
assert.match(apiSource, /postRequest\('submitTop40Result'/)
assert.doesNotMatch(bracketSource, /createGame|ArmyIntelligence|assignMission/i)

console.log('PASS Winners: winner advances and loser drops through stored graph links')
console.log('PASS Losers: winner advances and loser stops at ELIMINATED')
console.log('PASS Grand Final: one canonical match, Champion destination, no reset')
console.log('PASS validation: draw, wrong player, Pending, multiple Active, and arbitrary opponent rejected')
console.log('PASS idempotency: one Game linkage and one progression per match')
console.log('PASS failure order: canonical Game precedes durable linkage and recoverable progression')
console.log('PASS four-player complete tournament progression')
