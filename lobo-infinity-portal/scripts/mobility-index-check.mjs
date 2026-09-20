import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { mobilityIndex, MOBILITY_WEIGHTS } from '../bot/mobility-index.mjs'
import { lookupMobility, mobilityKey } from '../bot/mobility-lookup.mjs'
import { loadMobilityCatalog } from '../bot/mobility-catalog-store.mjs'
import { classifyTacticalBrief, renderTacticalBrief } from '../bot/inf-list-tactical.mjs'

const catalog = await loadMobilityCatalog()
const source = JSON.parse(gunzipSync(Buffer.from(await readFile('data/infinity-army/mobility-provisional-catalog.json.gz.b64', 'utf8'), 'base64')))
assert.equal(Object.keys(catalog.keys).length, source.entries.length)
assert.equal(catalog.fingerprint, createHash('sha256').update(JSON.stringify({ version: catalog.version, weights: MOBILITY_WEIGHTS, keys: catalog.keys, records: catalog.profiles })).digest('hex'))
for (const profile of source.entries) {
  const rating = mobilityIndex(profile)
  const record = lookupMobility(catalog, profile.id.replaceAll(':', '-'))
  assert.equal(record.status, rating.status, profile.id)
  assert.equal(record.score, rating.score, profile.id)
  if (rating.score !== null) assert.ok(rating.score >= 0 && rating.score <= 100)
}
const p = { mov: [4, 4], ph: 10, skills: [], equipment: [] }
const baseline = mobilityIndex(p)
assert.equal(baseline.components.attackReach, 4 / 11)
assert.equal(baseline.components.dodge, 1 / 5)
assert.ok(mobilityIndex({ ...p, mov: [6, 4] }).score > baseline.score)
assert.ok(mobilityIndex({ ...p, skills: ['Climbing Plus'] }).score > baseline.score)
assert.equal(mobilityIndex({ ...p, mov: null }).score, null)
assert.equal(mobilityIndex({ ...p, skills: ['Terrain'] }).score, null)
assert.throws(() => mobilityIndex(p, { ...MOBILITY_WEIGHTS, dodge: -1 }))
assert.equal(mobilityKey('not-an-id'), null)
const fixture = { version: catalog.version, profiles: [{ score: 10 }, { score: 20 }], keys: { '1:2:1:4:1': 0, '1:2:2:4:1': 1 } }
assert.equal(lookupMobility(fixture, '1-2-1-4-1').score, 10)
assert.equal(lookupMobility(fixture, '1-2-0-4-1'), null)
assert.equal(lookupMobility(fixture, '2-2-1-4-1'), null)
const unambiguous = { ...fixture, keys: { ...fixture.keys, '1:2:2:4:1': 0 } }
assert.equal(lookupMobility(unambiguous, '1-2-0-4-1').score, 10)
const entry = source.entries.find(x => mobilityIndex(x).status === 'rated')
const botProfile = { combinedId: entry.id.replaceAll(':', '-'), unitId: entry.unitId, unitName: 'Fixture', profileName: 'Profile', bs: 13, cc: 10, points: 20, skills: [], equipment: [], weapons: [], linkability: 'unavailable' }
const before = classifyTacticalBrief([botProfile])
const after = classifyTacticalBrief([botProfile], {}, [], [], [], catalog)
assert.equal(after.categories.mobility[0].mobility.score, lookupMobility(catalog, botProfile.combinedId).score)
for (const key of Object.keys(before.categories).filter(x => x !== 'mobility')) {
  const withoutMobility = rows => rows.map(({ mobility, ...rest }) => rest)
  assert.deepEqual(withoutMobility(after.categories[key]), withoutMobility(before.categories[key]), key)
}
const ratedAnalysis = classifyTacticalBrief([botProfile], {}, [{ status: 'matched', key: entry.id, normal: 42 }], [], [], catalog)
assert.equal(ratedAnalysis.categories.gunfighters[0].normal, 42)
assert.equal(ratedAnalysis.categories.gunfighters[0].mobility.score, after.categories.mobility[0].mobility.score)
const markup = []
const image = Buffer.alloc(24)
image.writeUInt32BE(1440, 16); image.writeUInt32BE(1000, 20)
// A page stub checks output contracts; it does not claim to measure browser layout.
const page = {
  setContent: async html => markup.push(html), evaluate: async () => {}, close: async () => {},
  locator: () => ({ evaluateAll: async (_, blocks) => blocks.map(block => ({ ...block, height: 200 })), screenshot: async () => image }),
}
await renderTacticalBrief({ analysis: ratedAnalysis, browser: { newPage: async () => page } })
assert.ok(markup.every(html => !html.includes('Top Mobility') && !html.includes('independent of combat ratings')))
assert.ok(markup.some(html => html.includes('<span>MOBILITY</span>')))
console.log(`PASS - ${source.entries.length} exact profile scores, fingerprint, movement invariants, ambiguous lookup rejection, combat isolation, embedded combat mobility, and no standalone bot section.`)
