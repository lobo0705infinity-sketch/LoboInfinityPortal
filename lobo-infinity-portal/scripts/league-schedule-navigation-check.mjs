import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const eventNavigation = read('src/config/eventNavigation.ts')
const eventCapabilities = read('src/config/eventCapabilities.ts')
const sidebar = read('src/components/Sidebar.tsx')
const mobileMenu = read('src/pages/MobileMenu.tsx')
const app = read('src/App.tsx')

const currentLeague = eventNavigation.match(
  /export const currentEventNavigation:[\s\S]*?capabilities:\s*\[([\s\S]*?)\][\s\S]*?id:\s*'event-current-league'/,
)?.[1] ?? ''
const normalLeague = eventCapabilities.match(
  /const leagueCapabilities:[\s\S]*?=\s*\[([\s\S]*?)\]/,
)?.[1] ?? ''
const teamTournament = eventNavigation.match(
  /export const eventNavigation:[\s\S]*?capabilities:\s*\[([\s\S]*?)\][\s\S]*?id:\s*'event-august-2026-team-tournament'/,
)?.[1] ?? ''
const capabilityNames = (source) => [...source.matchAll(/'([^']+)'/g)].map((match) => match[1])
const expectedLeague = ['overview', 'registration', 'standings', 'statistics', 'rules']

assert.deepEqual(capabilityNames(currentLeague), expectedLeague)
assert.deepEqual(capabilityNames(normalLeague), expectedLeague)
assert.ok(!currentLeague.includes("'schedule'"))
assert.ok(!normalLeague.includes("'schedule'"))

// Desktop and mobile must continue deriving event links from the same canonical builder.
assert.match(sidebar, /buildCapabilityNavigation\(event\)/)
assert.match(mobileMenu, /buildCapabilityNavigation\(event\)/)

// Preserve the Team Tournament capability set exactly; this fix is League-only.
assert.deepEqual(capabilityNames(teamTournament), [
  'overview',
  'registration',
  'teams',
  'pairings',
  'standings',
  'results',
  'statistics',
  'rules',
])
assert.match(eventNavigation, /id:\s*'event-august-2026-team-tournament'/)

// Schedule remains a supported capability and a directly routed page.
assert.match(eventNavigation, /schedule:\s*'\/schedule\?eventId=:eventId'/)
assert.match(app, /<Route path="\/schedule"/)

console.log('League Schedule navigation regression passed.')
