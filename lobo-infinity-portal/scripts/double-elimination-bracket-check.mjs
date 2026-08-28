import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/DoubleEliminationBracketApi.gs', 'utf8')
const context = vm.createContext({ console, Set })
vm.runInContext(source, context)

const sizes = [2, 3, 4, 5, 8, 9, 16, 17, 28, 32, 37, 40]
const expectedByes = new Map([[2,0],[3,1],[4,0],[5,3],[8,0],[9,7],[16,0],[17,15],[28,4],[32,0],[37,27],[40,24]])

function entrants(count) {
  return Array.from({ length: count }, (_, index) => ({
    faction: `Faction ${index + 1}`,
    itsName: `ITS${index + 1}`,
    player: `Player ${index + 1}`,
    seed: index + 1,
  }))
}

for (const size of sizes) {
  const field = entrants(size)
  const first = context.buildDoubleEliminationBracket_('event-fixture', field)
  const second = context.buildDoubleEliminationBracket_('event-fixture', field)
  assert.deepEqual(first, second, `${size}: bracket must be deterministic`)
  assert.equal(context.validateDoubleEliminationBracket_(first, field), true)
  let capacity = 2
  while (capacity < size) capacity *= 2
  const initial = first.filter((match) => match.bracket === 'Winners' && match.bracketRound === 1)
  const byes = initial.flatMap((match) => [match.playerA, match.playerB]).filter((player) => player === 'BYE')
  assert.equal(byes.length, expectedByes.get(size), `${size}: bye count`)
  assert.equal(capacity - size, byes.length, `${size}: capacity`)
  assert.equal(first.filter((match) => match.bracket === 'Grand Final').length, 1, `${size}: one Grand Final`)
  assert.equal(first.some((match) => /reset/i.test(match.matchId)), false, `${size}: no reset`)
  const gf = first.find((match) => match.matchId === 'GF-M1')
  assert.equal(gf.nextWinnerMatch, 'CHAMPION')
  assert.equal(gf.nextLoserMatch, 'RUNNER_UP')
  assert.equal(first.filter((match) => match.bracket === 'Winners').at(-1).nextWinnerMatch, 'GF-M1')
  assert.equal(first.filter((match) => match.bracket === 'Losers').at(-1).nextWinnerMatch, 'GF-M1')
  const playerAppearances = initial.flatMap((match) => [match.playerA, match.playerB]).filter((player) => player !== 'BYE')
  assert.equal(new Set(playerAppearances).size, size, `${size}: entrants appear once initially`)
  console.log(`PASS ${size}: capacity ${capacity}, byes ${byes.length}, structural PASS`)
}

assert.match(source, /requireApiPermission\(e, "runSeasonControl"/)
assert.match(source, /LockService\.getScriptLock\(\)/)
assert.match(source, /readEventBracketMatches_\(eventId\)\.length > 0/)
assert.match(source, /buildEventBracketReadiness_\(event, participants\)/)
assert.match(source, /if \(!getEventByIdNoEnsure\(eventId\)\) throw new Error\("Event not found\."\);\s*const event = getEventById\(eventId\);/)
assert.doesNotMatch(source, /submitLeagueResult|submitCasualResult|saveTeamTournamentResult|createGame/i)
console.log('PASS: deterministic double-elimination bracket generator contract')
