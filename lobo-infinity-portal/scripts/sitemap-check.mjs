import assert from 'node:assert/strict'
import { buildSitemap } from '../api/sitemap.mjs'

const snapshotId = '20260927T160000Z'
const payloads = {
  'current.json': { snapshotId, basePath: `public-snapshots/${snapshotId}/` },
  'games.json': { snapshotId, data: [{ id: 117 }, { id: '../commissioner' }] },
  'events.json': { snapshotId, data: [{ id: 'event-current-league' }] },
  'factions.json': { snapshotId, data: [{ name: 'Yu Jing' }] },
  'missions.json': { snapshotId, data: [{ mission: 'The Dig' }] },
}
const fetchObject = async (url) => ({ ok: true, json: async () => payloads[url.pathname.split('/').at(-1)] })
const { xml, snapshotAvailable } = await buildSitemap({ fetchObject })

assert.equal(snapshotAvailable, true)
assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
for (const path of ['/', '/army-intelligence', '/games/117', '/event/event-current-league', '/factions/Yu%20Jing', '/missions/The%20Dig']) {
  assert.ok(xml.includes(`<loc>https://lobo-infinity-portal.vercel.app${path}</loc>`), path)
}
assert.doesNotMatch(xml, /commissioner/)
assert.equal((xml.match(/<loc>https:\/\/lobo-infinity-portal.vercel.app\//g) ?? []).length, 23)

const fallback = await buildSitemap({ fetchObject: async () => ({ ok: false, status: 503 }) })
assert.equal(fallback.snapshotAvailable, false)
assert.match(fallback.xml, /<loc>https:\/\/lobo-infinity-portal.vercel.app\/army-intelligence<\/loc>/)
assert.doesNotMatch(fallback.xml, /\/games\/117/)

console.log('Sitemap public URL generation and fallback passed.')
