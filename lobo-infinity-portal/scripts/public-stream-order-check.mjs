import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseCanonicalStreamDate, sortPublicStreamsByDate } from '../src/public/streamOrdering.ts'

const streams = [
  { id: 'july', date: '7/5/2026', active: true },
  { id: 'august', date: '2026-08-02', active: true },
  { id: 'year-boundary', date: '2027-01-01', active: true },
  { id: 'same-date-a', date: '2026-08-02', active: true },
  { id: 'missing', date: '', active: true },
  { id: 'invalid', date: '2026-02-30', active: true },
  { id: 'hidden', date: '2026-12-31', active: false },
]
const visible = streams.filter((stream) => stream.active)
const original = JSON.stringify(visible)
const sorted = sortPublicStreamsByDate(visible)
assert.deepEqual(sorted.map((stream) => stream.id), [
  'year-boundary', 'august', 'same-date-a', 'july', 'missing', 'invalid',
])
assert.equal(JSON.stringify(visible), original, 'canonical source array was mutated')
assert.equal(parseCanonicalStreamDate('2026-02-30'), null)
assert.equal(parseCanonicalStreamDate('2026/8/2'), null)
assert.equal(parseCanonicalStreamDate('not-a-date'), null)
assert.equal(parseCanonicalStreamDate(' 2026-08-02 '), Date.UTC(2026, 7, 2))
assert.equal(parseCanonicalStreamDate('2026-08-02T04:00:00.000Z'), Date.UTC(2026, 7, 2, 4))

const app = readFileSync(new URL('../src/public/SnapshotPublicApp.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/public/SnapshotPublicApp.css', import.meta.url), 'utf8')
const exporter = readFileSync(new URL('../backend/PublicSnapshotExporter.gs', import.meta.url), 'utf8')
assert.match(app, /sortPublicStreamsByDate\(community\.streams as PublicStream\[\]\)/)
assert.match(app, /className="snapshot-streams-thumbnail"/)
assert.match(app, /className="snapshot-streams-watch"/)
assert.match(css, /@media \(max-width: 760px\)/, 'public streams need a mobile projection')
assert.match(exporter, /String\(stream\.active\)\.toLowerCase\(\) !== "false"/, 'hidden streams must stay out of the public projection')

console.log('PASS - public streams sort newest-first with explicit date parsing, stable ties, invalid dates last, and immutable input.')
