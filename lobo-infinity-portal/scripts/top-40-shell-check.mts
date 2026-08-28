import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import type { LeagueEvent } from '../src/types/dashboard.ts'

function loadTypeScriptModule(path: string) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const module = { exports: {} as Record<string, unknown> }
  const context = {
    exports: module.exports,
    module,
    require: () => ({}),
  }
  vm.runInNewContext(compiled, context)
  return module.exports
}

const navigationModule = loadTypeScriptModule('../src/config/eventNavigation.ts')
const capabilityModule = loadTypeScriptModule('../src/config/eventCapabilities.ts')
const {
  buildCapabilityNavigation,
  currentEventNavigation,
  eventNavigation,
  eventNavigationOptions,
} = navigationModule as typeof import('../src/config/eventNavigation.ts')
const { resolveEventCapabilities } =
  capabilityModule as typeof import('../src/config/eventCapabilities.ts')

const managerSource = readFileSync(
  new URL('../src/components/EventManagerPanel.tsx', import.meta.url),
  'utf8',
)
const eventHomeSource = readFileSync(
  new URL('../src/pages/EventHome.tsx', import.meta.url),
  'utf8',
)
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

const existingEventTypes = [
  'League',
  'Team Tournament',
  'ITS Tournament',
  'Narrative Campaign',
  'Casual Event',
  'Custom',
]
for (const type of existingEventTypes) {
  assert.match(managerSource, new RegExp(`<option>${type}</option>`))
}
assert.match(
  managerSource,
  /<option>Individual Double Elimination<\/option>/,
)

const top40 = eventNavigation.find(
  (event) => event.type === 'Individual Double Elimination',
)
assert.ok(top40, 'Top 40 navigation configuration must exist.')
assert.equal(top40.id, 'event-lobo-s-american-top-40')
assert.equal(top40.label, "Lobo's American Top 40")

const event = {
  capabilities: [],
  id: top40.id,
  type: top40.type,
} as LeagueEvent
const expectedCapabilities = [
  'overview',
  'registration',
  'bracket',
  'players',
  'results',
  'statistics',
  'rules',
]
assert.deepEqual(Array.from(resolveEventCapabilities(event)), expectedCapabilities)
assert.deepEqual(Array.from(top40.capabilities), expectedCapabilities)

const navigation = buildCapabilityNavigation(top40)
assert.deepEqual(
  Array.from(navigation, (item) => item.label),
  ['Overview', 'Registration', 'Bracket', 'Players', 'Results', 'Statistics', 'Rules'],
)
assert.deepEqual(
  Array.from(navigation, (item) => item.to),
  [
    '/event/event-lobo-s-american-top-40',
    '/event/event-lobo-s-american-top-40/registration',
    '/event/event-lobo-s-american-top-40/bracket',
    '/players?eventId=event-lobo-s-american-top-40',
    '/event/event-lobo-s-american-top-40#results',
    '/analytics?eventId=event-lobo-s-american-top-40',
    '/event/event-lobo-s-american-top-40#rules',
  ],
)
for (const excluded of ['teams', 'standings', 'schedule', 'submitResult', 'pairings']) {
  assert.ok(!top40.capabilities.includes(excluded as never))
}
assert.doesNotMatch(JSON.stringify(navigation), /match.?finder/i)
assert.equal(
  eventNavigationOptions.find((item) => item.id === top40.id),
  top40,
  'Shared desktop/mobile event options must include the same Top 40 configuration.',
)

assert.deepEqual(Array.from(currentEventNavigation.capabilities), [
  'overview',
  'registration',
  'standings',
  'statistics',
  'rules',
])
const teamTournament = eventNavigation.find(
  (item) => item.id === 'event-august-2026-team-tournament',
)
assert.deepEqual(Array.from(teamTournament?.capabilities ?? []), [
  'overview',
  'registration',
  'teams',
  'pairings',
  'standings',
  'results',
  'statistics',
  'rules',
])

assert.match(appSource, /path="\/event\/:eventId\/:section"/)
assert.match(eventHomeSource, /type EventHomeSection = 'bracket' \| 'overview' \| 'registration'/)
assert.match(eventHomeSource, /selectedSection === 'bracket'/)
assert.match(eventHomeSource, /data-event-section="bracket"/)
assert.match(eventHomeSource, />Tournament Bracket<\/h1>/)
assert.match(
  eventHomeSource,
  /The double-elimination bracket will be published here\./,
)
assert.doesNotMatch(eventHomeSource, /Generate Bracket|generateBracket|bracketRecords|matchAdvancement/)

console.log('Top 40 event shell checks passed')
