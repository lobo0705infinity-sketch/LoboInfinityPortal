import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'

const backend = readFileSync(new URL('../backend/TeamTournamentApi.gs', import.meta.url), 'utf8')
const parser = backend.match(/function parseTeamTournamentCanonicalDate_\(value\) \{[\s\S]*?\n\}/)?.[0]
const numberParser = backend.match(/function getTeamTournamentCanonicalGameNumber_\(game\) \{[\s\S]*?\n\}/)?.[0]
const comparator = backend.match(/function compareTeamTournamentCanonicalGames_\(left, right\) \{[\s\S]*?\n\}/)?.[0]
assert.ok(parser && numberParser && comparator)

const context = vm.createContext({
  Date,
  Number,
  String,
  isFinite,
  isNaN,
  getTeamTournamentString: (value) => String(value ?? ''),
})
vm.runInContext(`${parser};${numberParser};${comparator};this.compare=compareTeamTournamentCanonicalGames_;this.parse=parseTeamTournamentCanonicalDate_`, context)

const source = [
  { id: 9, date: '2026-01-02' },
  { id: 10, date: '2026-01-02' },
  { id: 100, date: '2026-01-02' },
  { id: 8, date: '2025-12-31T23:59:59.000Z' },
  { id: 7, date: '2027-01-01' },
  { id: 6, date: '2/1/2026' },
  { id: 5, date: 'not-a-date' },
  { id: 4 },
  { id: 3 },
  { id: 2, date: '2026-01-02' },
  { id: 'tie', date: 'not-a-date' },
]
const decorated = source.map((game, sourceIndex) => ({ game, sourceIndex }))
const ordered = decorated.slice().sort(context.compare).map(({game}) => game.id)
assert.deepEqual(ordered, [7, 6, 100, 10, 9, 2, 8, 5, 4, 3, 'tie'])
assert.equal(context.parse('2/30/2026'), null)
assert.equal(context.parse('2026-02-30'), null)
assert.equal(context.parse('2026-08-02T04:00:00.000Z'), Date.UTC(2026, 7, 2, 4))
assert.equal(context.parse(1770000000000), 1770000000000)
assert.equal(context.parse('1770000000'), 1770000000000)
assert.deepEqual(source.map((game) => game.id), [9, 10, 100, 8, 7, 6, 5, 4, 3, 2, 'tie'])

console.log('PASS - Team Tournament canonical results order by valid date descending, numeric game number descending, invalid dates last, with stable ties and immutable source.')
