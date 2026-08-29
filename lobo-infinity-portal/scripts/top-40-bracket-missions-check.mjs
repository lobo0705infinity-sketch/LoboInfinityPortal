import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const bracketSource = fs.readFileSync('backend/DoubleEliminationBracketApi.gs', 'utf8')
const routerSource = fs.readFileSync('backend/API.gs', 'utf8')
const validationSource = fs.readFileSync('backend/CanonicalValidationService.gs', 'utf8')
const managerSource = fs.readFileSync('src/components/EventManagerPanel.tsx', 'utf8')
const bracketPageSource = fs.readFileSync('src/pages/EventHome.tsx', 'utf8')
const submitSource = fs.readFileSync('src/pages/SubmitResult.tsx', 'utf8')
const apiSource = fs.readFileSync('src/services/api.ts', 'utf8')
const securitySource = fs.readFileSync('scripts/security-cache-audit.mjs', 'utf8')

const canonicalMissions = new Set([
  'Annihilation', 'Neutralization', 'Provisioning', 'Superiority', 'Uplink Center',
])
const context = vm.createContext({
  console,
  Date,
  Set,
  getEventManagerString: (value) => value == null ? '' : String(value).trim(),
  getCanonicalMissionName: (value) => canonicalMissions.has(String(value)) ? String(value) : '',
  Utilities: { formatDate: (date) => date.toISOString().slice(0, 19).replace('T', ' '), parseDate: (value) => new Date(String(value).replace(' ', 'T') + 'Z') },
  Session: { getScriptTimeZone: () => 'UTC' },
})
vm.runInContext(bracketSource, context)

function bracketFor(size) {
  const entrants = Array.from({ length: size }, (_, index) => ({ player: `P${index + 1}`, seed: index + 1 }))
  return context.buildDoubleEliminationBracket_('event-fixture', entrants)
}

let existing = []
context.readEventBracketMissionAssignments_ = () => structuredClone(existing)

const four = bracketFor(4)
const assignmentInput = [
  { bracket: 'Winners', bracketRound: 1, mission: 'Provisioning' },
  { bracket: 'Winners', bracketRound: 2, mission: 'Neutralization' },
  { bracket: 'Losers', bracketRound: 1, mission: 'Superiority' },
  { bracket: 'Losers', bracketRound: 2, mission: 'Uplink Center' },
  { bracket: 'Grand Final', bracketRound: 1, mission: 'Annihilation' },
]
const validated = context.validateEventBracketMissionAssignments_('event-fixture', four, assignmentInput)
assert.equal(validated.filter((item) => item.mission).length, 5)
for (const assignment of assignmentInput) {
  assert.equal(validated.find((item) => item.bracket === assignment.bracket && item.bracketRound === assignment.bracketRound)?.mission, assignment.mission)
}

const partial = context.validateEventBracketMissionAssignments_('event-fixture', four, [assignmentInput[0]])
assert.equal(partial.filter((item) => item.mission).length, 1)
assert.ok(partial.some((item) => item.bracket === 'Losers' && item.mission === ''))

existing = [{ eventId: 'event-fixture', bracket: 'Winners', bracketRound: 1, mission: 'Provisioning' }]
const deadlinesBefore = four.map((match) => match.deadline)
const changed = context.validateEventBracketMissionAssignments_('event-fixture', four, [{ bracket: 'Winners', bracketRound: 1, mission: 'Neutralization' }])
assert.equal(changed.find((item) => item.bracket === 'Winners' && item.bracketRound === 1).mission, 'Neutralization')
assert.deepEqual(four.map((match) => match.deadline), deadlinesBefore)

const completed = structuredClone(four)
completed.find((match) => match.bracket === 'Winners' && match.bracketRound === 1).status = 'Completed'
assert.throws(
  () => context.validateEventBracketMissionAssignments_('event-fixture', completed, [{ bracket: 'Winners', bracketRound: 1, mission: 'Neutralization' }]),
  /games in this bracket round have already been completed/,
)
assert.throws(
  () => context.validateEventBracketMissionAssignments_('event-fixture', four, [{ bracket: 'Winners', bracketRound: 1, mission: 'Not Canonical' }]),
  /canonical mission list/,
)
assert.throws(
  () => context.validateEventBracketMissionAssignments_('event-fixture', four, [{ bracket: 'Winners', bracketRound: 99, mission: 'Provisioning' }]),
  /round is invalid/,
)

context.activatePlayableEventBracketMatches_(four, new Date('2026-09-01T12:00:00Z'))
const activeMatch = four.find((match) => match.status === 'Active')
context.getEventByIdNoEnsure = () => ({ id: 'event-fixture', type: 'Individual Double Elimination' })
context.readEventBracketMatches_ = () => four
context.isRealEventBracketPlayer_ = (value) => Boolean(value && value !== 'BYE' && value !== 'TBD')
existing = []
let submissionCheck = context.validateTop40BracketSubmission_({
  eventId: 'event-fixture',
  matchId: activeMatch.matchId,
  player: activeMatch.playerA,
  winner: 'Player Victory',
})
assert.equal(submissionCheck.valid, false)
assert.equal(submissionCheck.error, 'A mission has not been assigned to this bracket round.')
existing = [{ eventId: 'event-fixture', bracket: activeMatch.bracket, bracketRound: activeMatch.bracketRound, mission: 'Provisioning' }]
submissionCheck = context.validateTop40BracketSubmission_({
  eventId: 'event-fixture',
  matchId: activeMatch.matchId,
  mission: 'Annihilation',
  player: activeMatch.playerA,
  winner: 'Player Victory',
})
assert.equal(submissionCheck.valid, true)
assert.equal(submissionCheck.mission, 'Provisioning')

for (const size of [2, 4, 17, 37, 40]) {
  const rounds = context.discoverEventBracketRounds_(bracketFor(size))
  assert.ok(rounds.length > 0)
  assert.equal(new Set(rounds.map((item) => `${item.bracket}:${item.bracketRound}`)).size, rounds.length)
  assert.equal(rounds.filter((item) => item.bracket === 'Grand Final').length, 1)
}

assert.match(bracketSource, /requireApiPermission\(e, "runSeasonControl"/)
assert.match(bracketSource, /setValues\(finalRows\)/)
assert.match(bracketSource, /params\.mission = before\.mission;[\s\S]*submitCanonicalGame/)
assert.match(bracketSource, /A mission has not been assigned to this bracket round\./)
assert.match(bracketSource, /copy\.mission = missionByRound/)
assert.match(validationSource, /if \(!bracket\.mission\)/)
assert.match(routerSource, /case "eventBracketMissions":\s*return saveEventBracketMissions\(e\);/)
assert.match(securitySource, /eventBracketMissions: \{ authRequired: true, userScoped: false \}/)
assert.match(apiSource, /postRequest\('eventBracketMissions'/)
assert.match(managerSource, /Bracket Missions/)
assert.match(managerSource, /Generate the bracket before assigning missions\./)
assert.match(managerSource, /Saving missions\.\.\./)
assert.match(managerSource, /Missions saved\./)
assert.match(bracketPageSource, /Mission: \{match\.mission \|\| 'Not assigned'\}/)
assert.match(submitSource, /ReadOnlyField label="Mission" value=\{leagueResult\.mission \|\| 'Mission not assigned'\}/)

console.log('PASS round discovery uses only the generated bracket structure for 2, 4, 17, 37, and 40 entrants')
console.log('PASS partial canonical mission assignments validate atomically and remain event/round scoped')
console.log('PASS completed rounds reject mission changes without touching canonical Games or deadlines')
console.log('PASS public bracket and Top 40 submission consume the same server-projected round mission')
console.log('PASS Top 40 server submission replaces client mission with the canonical assignment')
console.log('PASS Commissioner-only mission mutation is retained in the production security gate')
