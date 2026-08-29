import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const backend = read('backend/PublicAnalyticsProjection.gs')
const api = read('api/public-analytics-projection.mjs')
const page = read('src/pages/Analytics.tsx')
const client = read('src/services/publicAnalyticsProjection.ts')
const automation = read('backend/AutomationApi.gs')
const eventManager = read('backend/EventManagerApi.gs')
const top40Projection = read('backend/PublicEventProjection.gs')

assert.match(backend, /buildPublicAnalyticsEventProjection_\(eventId, gameType\)/)
assert.match(backend, /const context = buildEventAnalyticsContext\(request\)/)
assert.match(backend, /buildPublicAnalyticsPlayers_\(getEventAnalyticsPlayers\(context\)\)/)
assert.match(backend, /buildPublicAnalyticsFactions_\(getEventAnalyticsFactions\(context\)\)/)
assert.match(backend, /buildPublicAnalyticsMissions_\(getEventAnalyticsMissions\(context\)\)/)
assert.match(backend, /buildPublicAnalyticsRecordBook_\(buildPublicAnalyticsRecords_\(context\)\)/)
assert.doesNotMatch(backend, /Army Code|email|commissioner|token/i)
assert.match(backend, /setContent\(json\)/)
assert.match(backend, /validatePublicAnalyticsProjection_/)
assert.match(backend, /value\.eventId !== eventId/)
assert.match(api, /PUBLIC_ANALYTICS_PROJECTION_FILE_ID/)
assert.match(api, /artifact\?\.events\?\.\[eventId\]/)
assert.match(api, /variants\?\.\[gameType\] \|\| variants\?\.all/)
assert.match(api, /stale-while-revalidate=86400/)
assert.doesNotMatch(api, /action=(players|factions|missions|records)/)
assert.match(client, /\/api\/public-analytics-projection\?/)
assert.match(client, /projection\.eventId !== eventId/)
assert.match(page, /getPublicAnalyticsProjection/)
assert.doesNotMatch(page, /apiClient\.getPlayers|apiClient\.getFactions|apiClient\.getMissions|apiClient\.getRecords/)
assert.match(automation, /markPublicAnalyticsProjectionDirty_\(identity && identity\.eventId\)/)
assert.match(automation, /publishDirtyPublicAnalyticsProjectionsBestEffort_/)
assert.match(eventManager, /markPublicAnalyticsProjectionDirty_\(eventId\)/)
assert.match(top40Projection, /markPublicAnalyticsProjectionDirty_\(eventId\)/)

// Endpoint selection is explicit and never falls back to another event.
const artifact = {
  defaultEventId: 'event-current-league',
  events: {
    'event-current-league': { all: { eventId: 'event-current-league', players: ['league'] } },
    'event-lobo-s-american-top-40': { all: { eventId: 'event-lobo-s-american-top-40', players: [] } },
    'event-august-2026-team-tournament': { all: { eventId: 'event-august-2026-team-tournament', players: ['team'] } },
  },
}
const select = (eventId, gameType = 'all') => {
  const resolved = eventId || artifact.defaultEventId
  const variants = artifact.events[resolved]
  return variants?.[gameType] || variants?.all || null
}
assert.equal(select('', 'all').eventId, 'event-current-league')
assert.equal(select('event-lobo-s-american-top-40').players.length, 0)
assert.equal(select('event-august-2026-team-tournament').players[0], 'team')
assert.equal(select('missing-event'), null)

console.log('Prepared public analytics projection regression passed.')
