import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/DoubleEliminationBracketApi.gs', 'utf8')
const managerSource = fs.readFileSync('src/components/EventManagerPanel.tsx', 'utf8')
const publicSource = fs.readFileSync('src/pages/EventHome.tsx', 'utf8')
const apiSource = fs.readFileSync('src/services/api.ts', 'utf8')
const routerSource = fs.readFileSync('backend/API.gs', 'utf8')
const timezone = 'America/New_York'

function formatDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date)
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}-${part('minute')}-${part('second')}`.replace(/ (\d\d)-(\d\d)-(\d\d)$/, ' $1:$2:$3')
}

const context = vm.createContext({
  console, Date, Set,
  Session: { getScriptTimeZone: () => timezone },
  Utilities: {
    formatDate,
    parseDate(value) {
      const [date, time] = String(value).split(' ')
      return new Date(`${date}T${time}-04:00`)
    },
  },
  getEventManagerString: (value) => value == null ? '' : String(value).trim(),
})
vm.runInContext(source, context)

const fixedNow = new Date('2026-09-03T20:17:00-04:00')
const sizes = [2, 3, 5, 8, 17, 28, 37, 40]
const entrants = (count) => Array.from({ length: count }, (_, index) => ({
  player: `Player ${index + 1}`, seed: index + 1, itsName: `ITS${index + 1}`, faction: `Faction ${index + 1}`,
}))

for (const size of sizes) {
  const matches = context.buildDoubleEliminationBracket_('event-fixture', entrants(size))
  context.activatePlayableEventBracketMatches_(matches, fixedNow)
  const active = matches.filter((match) => match.status === 'Active')
  const pending = matches.filter((match) => match.status === 'Pending')
  const byes = matches.filter((match) => match.status === 'Bye Advanced')
  assert.ok(active.length > 0, `${size}: initial playable matches activate`)
  assert.ok(pending.length > 0, `${size}: unresolved future matches remain Pending`)
  for (const match of active) {
    assert.ok(match.playerA && match.playerA !== 'BYE' && match.playerB && match.playerB !== 'BYE')
    const activated = context.parseEventBracketTimestamp_(match.activatedAt)
    const deadline = context.parseEventBracketTimestamp_(match.deadline)
    assert.equal(deadline.getTime() - activated.getTime(), 7 * 24 * 60 * 60 * 1000, `${size}: exact seven-day deadline`)
  }
  for (const match of byes) {
    assert.equal(match.activatedAt, '')
    assert.equal(match.deadline, '')
  }
  const lifecycleBefore = active.map((match) => [match.matchId, match.activatedAt, match.deadline])
  context.activatePlayableEventBracketMatches_(matches, new Date(fixedNow.getTime() + 60_000))
  assert.deepEqual(active.map((match) => [match.matchId, match.activatedAt, match.deadline]), lifecycleBefore, `${size}: activation is idempotent`)
  console.log(`PASS ${size}: ${active.length} Active, ${pending.length} Pending, ${byes.length} bye-resolved, deadline PASS`)
}

const two = context.buildDoubleEliminationBracket_('event-two', entrants(2))
context.activatePlayableEventBracketMatches_(two, fixedNow)
assert.equal(two.find((match) => match.matchId === 'W1-M1').status, 'Active')
assert.equal(two.find((match) => match.matchId === 'GF-M1').status, 'Pending')

const activeFixture = two.find((match) => match.matchId === 'W1-M1')
const automaticDeadline = activeFixture.deadline
const changedDeadline = context.validateEventBracketDeadline_(activeFixture.activatedAt, '2026-09-12 18:00:00')
assert.equal(changedDeadline, '2026-09-12 18:00:00')
assert.equal(activeFixture.activatedAt, '2026-09-03 20:17:00')
assert.notEqual(changedDeadline, automaticDeadline)
assert.throws(() => context.validateEventBracketDeadline_(activeFixture.activatedAt, '2026-09-03 20:16:00'), /after Activated At/)

activeFixture.deadline = '2026-09-01 20:17:00'
assert.equal(activeFixture.status, 'Active')
assert.equal(activeFixture.winner, '')
assert.equal(activeFixture.loser, '')

assert.match(source, /function updateEventBracketDeadline\(e\)[\s\S]*requireApiPermission\(e, "runSeasonControl"/)
assert.match(source, /LockService\.getScriptLock\(\)/)
assert.match(source, /activatePlayableEventBracketMatches_\(matches, new Date\(\)\)/)
assert.match(source, /"Activated At", "Deadline"/)
assert.doesNotMatch(source, /EVENT_PROVISIONING_TOKEN|submitLeagueResult|createGame|assignMission/i)
assert.match(routerSource, /case "eventBracketDeadline":\s*return updateEventBracketDeadline\(e\);/)
assert.match(apiSource, /postRequest\('eventBracketDeadline'/)
assert.match(managerSource, /No active bracket matches\./)
assert.match(managerSource, /type="datetime-local"/)
assert.match(publicSource, /Past Deadline/)
assert.match(publicSource, /Waiting for opponent/)
assert.doesNotMatch(publicSource, /Edit Deadline/)
console.log('PASS repeated activation: original timestamp and deadline preserved')
console.log('PASS past deadline: Active with no winner, loser, or progression')
console.log('PASS manual deadline edit: Activated At unchanged')
console.log('PASS unauthorized edit: protected by runSeasonControl; provisioning token is not accepted')
console.log('PASS bracket match lifecycle and rolling deadline contract')
