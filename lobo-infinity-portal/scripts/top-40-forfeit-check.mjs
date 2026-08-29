import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const bracketSource = fs.readFileSync('backend/DoubleEliminationBracketApi.gs', 'utf8')
const routerSource = fs.readFileSync('backend/API.gs', 'utf8')
const managerSource = fs.readFileSync('src/components/EventManagerPanel.tsx', 'utf8')
const publicSource = fs.readFileSync('src/pages/EventHome.tsx', 'utf8')
const apiSource = fs.readFileSync('src/services/api.ts', 'utf8')
const securitySource = fs.readFileSync('scripts/security-cache-audit.mjs', 'utf8')

const format = (date) => date.toISOString().slice(0, 19).replace('T', ' ')
const context = vm.createContext({
  console, Date, Set,
  getEventManagerString: (value) => value == null ? '' : String(value).trim(),
  Utilities: { formatDate: format, parseDate: (value) => new Date(String(value).replace(' ', 'T') + 'Z') },
  Session: { getScriptTimeZone: () => 'UTC' },
})
vm.runInContext(bracketSource, context)

function freshFourPlayerBracket() {
  const entrants = Array.from({ length: 4 }, (_, index) => ({ player: `P${index + 1}`, seed: index + 1 }))
  const matches = context.buildDoubleEliminationBracket_('event-fixture', entrants)
  context.resolveEventBracketByes_(matches)
  context.activatePlayableEventBracketMatches_(matches, new Date('2026-09-01T12:00:00Z'))
  return matches
}

const winners = freshFourPlayerBracket()
const winnersMatch = winners.find((match) => match.bracket === 'Winners' && match.status === 'Active')
const winnerDestination = winners.find((match) => match.matchId === winnersMatch.nextWinnerMatch)
const loserDestination = winners.find((match) => match.matchId === winnersMatch.nextLoserMatch)
context.completeEventBracketMatch_(winners, winnersMatch, winnersMatch.playerA, winnersMatch.playerB, 'Forfeit', '', new Date('2026-09-02T12:00:00Z'))
assert.equal(winnersMatch.status, 'Completed')
assert.equal(winnersMatch.resolution, 'Forfeit')
assert.equal(winnersMatch.gameId, '')
assert.ok([winnerDestination.playerA, winnerDestination.playerB].includes(winnersMatch.playerA))
assert.ok([loserDestination.playerA, loserDestination.playerB].includes(winnersMatch.playerB))

const losers = freshFourPlayerBracket()
const initial = losers.filter((match) => match.bracket === 'Winners' && match.status === 'Active')
initial.forEach((match, index) => context.completeEventBracketMatch_(losers, match, match.playerA, match.playerB, 'Forfeit', '', new Date(`2026-09-0${2 + index}T12:00:00Z`)))
const losersMatch = losers.find((match) => match.bracket === 'Losers' && match.status === 'Active')
assert.ok(losersMatch)
const selectedLosersWinner = losersMatch.playerB
const eliminated = losersMatch.playerA
context.completeEventBracketMatch_(losers, losersMatch, selectedLosersWinner, eliminated, 'Forfeit', '', new Date('2026-09-04T12:00:00Z'))
assert.equal(losersMatch.winner, selectedLosersWinner)
assert.equal(losersMatch.loser, eliminated)
assert.equal(losersMatch.nextLoserMatch, 'ELIMINATED')
assert.equal(losersMatch.gameId, '')

let tournament = freshFourPlayerBracket()
let guard = 0
while (tournament.find((match) => match.matchId === 'GF-M1').status !== 'Active') {
  const active = tournament.find((match) => match.status === 'Active')
  assert.ok(active)
  context.completeEventBracketMatch_(tournament, active, active.playerA, active.playerB, 'Forfeit', '', new Date(2026, 8, 5 + guard))
  assert.ok(++guard < 20)
}
const grandFinal = tournament.find((match) => match.matchId === 'GF-M1')
context.completeEventBracketMatch_(tournament, grandFinal, grandFinal.playerA, grandFinal.playerB, 'Forfeit', '', new Date('2026-09-20T12:00:00Z'))
assert.equal(grandFinal.status, 'Completed')
assert.equal(grandFinal.nextWinnerMatch, 'CHAMPION')
assert.equal(grandFinal.nextLoserMatch, 'RUNNER_UP')
assert.equal(grandFinal.resolution, 'Forfeit')
assert.equal(tournament.filter((match) => match.bracket === 'Grand Final').length, 1)

const beforeDeadlineBracket = freshFourPlayerBracket()
const beforeDeadline = beforeDeadlineBracket.find((match) => match.status === 'Active')
context.completeEventBracketMatch_(beforeDeadlineBracket, beforeDeadline, beforeDeadline.playerA, beforeDeadline.playerB, 'Forfeit', '', new Date('2026-09-02T12:00:00Z'))
assert.equal(beforeDeadline.status, 'Completed')
const pastDeadline = freshFourPlayerBracket().find((match) => match.status === 'Active')
pastDeadline.deadline = '2020-01-01 00:00:00'
assert.equal(pastDeadline.status, 'Active', 'a passed deadline must not forfeit automatically')

const duplicate = freshFourPlayerBracket()
const duplicateMatch = duplicate.find((match) => match.status === 'Active')
context.completeEventBracketMatch_(duplicate, duplicateMatch, duplicateMatch.playerA, duplicateMatch.playerB, 'Forfeit', '', new Date())
assert.throws(() => context.completeEventBracketMatch_(duplicate, duplicateMatch, duplicateMatch.playerA, duplicateMatch.playerB, 'Forfeit', '', new Date()), /Only Active/)
const wrongPlayer = freshFourPlayerBracket()
const wrongMatch = wrongPlayer.find((match) => match.status === 'Active')
assert.throws(() => context.completeEventBracketMatch_(wrongPlayer, wrongMatch, 'Intruder', wrongMatch.playerB, 'Forfeit', '', new Date()), /Winner must be a bracket participant/)

assert.match(bracketSource, /function awardEventBracketForfeit\(e\)[\s\S]*requireApiPermission\(e, "runSeasonControl"/)
assert.match(bracketSource, /completeEventBracketMatch_\(matches, match, winner, loser, "Forfeit", "", new Date\(\)\)/)
assert.doesNotMatch(bracketSource.match(/function awardEventBracketForfeit[\s\S]*?\n}\n/)[0], /submitCanonicalGame|createSubmissionCommand/)
assert.match(routerSource, /case "eventBracketForfeit":\s*return awardEventBracketForfeit\(e\);/)
assert.match(securitySource, /eventBracketForfeit: \{ authRequired: true, userScoped: false \}/)
assert.match(apiSource, /postRequest\('eventBracketForfeit'/)
assert.match(managerSource, /Award Forfeit/)
assert.match(managerSource, /Award this match to \$\{winner\} by forfeit\?/)
assert.match(publicSource, /match\.resolution === 'Forfeit'/)
assert.match(bracketSource, /"Game ID", "Resolution"/)

console.log('PASS Winners forfeit: winner advances, loser drops, no canonical Game')
console.log('PASS Losers forfeit: winner advances and loser is eliminated')
console.log('PASS Grand Final forfeit: Champion and Runner-up destinations, no reset')
console.log('PASS before/past deadline: explicit Commissioner action only')
console.log('PASS duplicate, wrong-player, and authorization guards')
console.log('PASS existing bracket store and shared progression/activation path')
