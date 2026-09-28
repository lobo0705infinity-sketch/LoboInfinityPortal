import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSitemap } from '../api/sitemap.mjs'

const { redirects, rewrites } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
for (const [source, destination] of [['/hall-of-fame', '/analytics'], ['/rivalries', '/compare']]) {
  assert.ok(redirects.some(redirect => redirect.source === source && redirect.destination === destination && redirect.permanent === true))
  assert.ok(!rewrites.some(rewrite => rewrite.source.includes(source.slice(1))))
}

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
for (const path of ['/', '/little-helper', '/army-intelligence', '/games/117', '/event/event-current-league', '/factions/Yu%20Jing', '/missions/The%20Dig']) {
  assert.ok(xml.includes(`<loc>https://lobo-infinity-portal.vercel.app${path}</loc>`), path)
}
assert.doesNotMatch(xml, /commissioner/)
assert.doesNotMatch(xml, /\/hall-of-fame|\/rivalries/)
assert.equal((xml.match(/<loc>https:\/\/lobo-infinity-portal.vercel.app\//g) ?? []).length, 22)

const fallback = await buildSitemap({ fetchObject: async () => ({ ok: false, status: 503 }) })
assert.equal(fallback.snapshotAvailable, false)
assert.match(fallback.xml, /<loc>https:\/\/lobo-infinity-portal.vercel.app\/army-intelligence<\/loc>/)
assert.match(fallback.xml, /<loc>https:\/\/lobo-infinity-portal.vercel.app\/little-helper<\/loc>/)
assert.doesNotMatch(fallback.xml, /\/games\/117/)
assert.doesNotMatch(fallback.xml, /\/hall-of-fame|\/rivalries/)

console.log('Sitemap public URL generation and fallback passed.')
