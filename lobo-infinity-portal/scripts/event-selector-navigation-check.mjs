import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const sidebar = read('src/components/Sidebar.tsx')
const mobile = read('src/pages/MobileMenu.tsx')
const selection = read('src/components/useSelectedEventNavigation.ts')
const routing = read('src/components/eventWorkspaceNavigation.ts')
const navigation = read('src/config/eventNavigation.ts')

for (const [surface, source] of [['desktop', sidebar], ['mobile', mobile]]) {
  assert.match(source, /const selectedEvent = eventOptions\.find\(\(event\) => event\.id === selectedEventId\)/, `${surface} derives one event from shared selection`)
  assert.match(source, /selectedEvent \? <EventGroup event=\{selectedEvent\} \/> : null/, `${surface} renders exactly one event group`)
  assert.doesNotMatch(source, /eventOptions\.map\(\(event\) => \(\s*<EventGroup/, `${surface} must not render unselected event containers`)
  assert.match(source, /<EventSelector[\s\S]*?selectedEventId=\{selectedEventId\}/, `${surface} keeps the selector visible`)
  assert.match(source, /buildCapabilityNavigation\(event\)/, `${surface} preserves each selected event's capability links`)
}

assert.match(selection, /useSyncExternalStore/, 'selection must use one shared reactive store')
assert.match(selection, /selectedEventListeners/, 'desktop and mobile subscribe to the same selected event')
assert.match(selection, /sessionStorage\.setItem\(selectedEventStorageKey, eventId\)/, 'selection must survive refresh')
assert.match(selection, /setSelectedEventSnapshot\(knownEventId\)[\s\S]*?resolveEventWorkspacePath/, 'selection updates before navigation')
assert.match(selection, /setSelectedEventSnapshot\(routeEventId\)/, 'direct event routes update the shared selection')

const incompatibleFallback = routing.indexOf("if (preferredCapability) {\n    return buildCapabilityNavigationItem(event, 'overview').to")
const rememberedFallback = routing.indexOf('const rememberedWorkspace = readWorkspaceMemory()[event.id]')
assert.ok(incompatibleFallback >= 0 && incompatibleFallback < rememberedFallback, 'incompatible event routes must redirect to Overview before remembered-route fallback')
assert.ok(routing.includes("if (/^\\/event\\/[^/?#]+\\//.test(pathname))") && routing.includes("return buildCapabilityNavigationItem(event, 'overview').to"), 'unknown event-specific routes must redirect to Overview')
for (const section of ['registration', 'results', 'standings', 'teams', 'bracket', 'rules', 'schedule']) {
  assert.match(routing, new RegExp(`section === '${section}'`), `${section} event routes remain recognized`)
}

for (const eventId of ['event-current-league', 'event-august-2026-team-tournament', 'event-lobo-s-american-top-40']) {
  assert.match(navigation, new RegExp(`id: '${eventId}'`), `${eventId} remains configured`)
}
console.log('Event Selector renders one selected event on desktop/mobile, persists selection, and safely routes incompatible event pages.')
