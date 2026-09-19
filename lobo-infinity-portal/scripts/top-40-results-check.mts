import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const navigation = read('../src/config/eventNavigation.ts')
const eventHome = read('../src/pages/EventHome.tsx')
const resultService = read('../src/services/eventResults.ts')

assert.match(navigation, /results: '\/event\/:eventId\/results'/)
assert.doesNotMatch(
  navigation.slice(navigation.indexOf("id: 'event-lobo-s-american-top-40'")),
  /results: '\/event\/:eventId#results'/,
)
assert.match(eventHome, /selectedSection === 'results'/)
assert.match(eventHome, /data-event-section="results"/)
assert.match(eventHome, /<h1 id="event-results-title">Results<\/h1>/)
assert.match(eventHome, /No results have been reported for this event yet\./)
assert.match(eventHome, /getEventResultTimelineItems\(data\.timeline\)/)
assert.doesNotMatch(eventHome, /selectedSection === 'results'[\s\S]{0,500}<EventProgressPanel/)

const compiled = ts.transpileModule(resultService, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} as Record<string, unknown> }
vm.runInNewContext(compiled, { exports: module.exports, module })
const { getEventResultTimelineItems } = module.exports as {
  getEventResultTimelineItems: (items: Array<Record<string, string>>) => Array<Record<string, string>>
}

const top40Game = { body: 'Supplies', timestamp: '2026-08-29', title: 'Alpha defeated Bravo', type: 'Result' }
const projected = getEventResultTimelineItems([
  { body: 'Planning', timestamp: '', title: 'Top 40 created', type: 'Event' },
  top40Game,
  { body: 'Closed', timestamp: '', title: 'Registration Closed', type: 'Registration' },
])
assert.deepEqual(JSON.parse(JSON.stringify(projected)), [top40Game])

const top40Block = navigation.slice(
  navigation.lastIndexOf('capabilities: [', navigation.indexOf("id: 'event-lobo-s-american-top-40'")),
  navigation.indexOf("type: 'Individual Double Elimination'"),
)
assert.match(top40Block, /'overview',[\s\S]*'registration',[\s\S]*'bracket',[\s\S]*'results',[\s\S]*'rules'/)
assert.match(top40Block, /rules: '\/event\/:eventId\/rules'/)
assert.match(top40Block, /results: '\/event\/:eventId\/results'/)

console.log('Top 40 Results routing and projection regression passed.')
