import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { buildOfficialCombatSource } from '../bot/official-combat-source.mjs'
import { buildCanonicalCloseCombatProfiles } from '../bot/close-combat-canonicalizer.mjs'
import { lookupCloseCombatRatings } from '../bot/close-combat-catalog.mjs'
import { readArtifact } from './benchmark-artifacts.mjs'
import { GUNFIGHTER_BENCHMARK_VERSION } from '../bot/gunfighter-standard-benchmark.mjs'
import { ARO_BENCHMARK_VERSION } from '../bot/aro-benchmark-catalog.mjs'
import { CLOSE_COMBAT_BENCHMARK_VERSION } from '../bot/close-combat-standard-benchmark.mjs'

const dir = 'data/infinity-army/'
const capture = await readArtifact(dir + 'benchmark-official-source.json.gz.b64')
const source = buildOfficialCombatSource(capture)
const g = await readArtifact(dir + 'gunfighter-benchmark-catalog.json')
const a = await readArtifact(dir + 'aro-benchmark-catalog.json.gz.b64')
const cc = await readArtifact(dir + 'close-combat-benchmark.json')
const m = JSON.parse(await readFile('src/data/mobility-index.json', 'utf8'))
const audit = JSON.parse(await readFile('src/data/profile-audit.json', 'utf8'))
const mobile = JSON.parse(await readFile('src/data/mobile-gunfighter.json', 'utf8'))
assert.equal(g.benchmarkVersion, GUNFIGHTER_BENCHMARK_VERSION)
assert.equal(a.benchmarkVersion, ARO_BENCHMARK_VERSION)
assert.equal(cc.benchmarkVersion, CLOSE_COMBAT_BENCHMARK_VERSION)
const keys = source.profiles.map(p => p.id).sort()
for (const catalog of [g, a]) {
  assert.deepEqual(catalog.entries.map(e => e.key).sort(), keys)
  assert.equal(catalog.entryCount, keys.length)
  for (const entry of catalog.entries) for (const state of entry.result.states) assert.ok(Number.isFinite(state.rating) && state.rating >= 0 && state.rating <= 100, entry.key)
}
for (const catalog of [g, a, cc]) {
  assert.equal(catalog.source.captureFingerprint, source.captureFingerprint)
  assert.equal(catalog.source.rulesVersion, source.rulesVersion)
}
assert.deepEqual(Object.keys(m.keys).sort(), keys)
assert.deepEqual(Object.keys(audit.keys).sort(), keys)
assert.equal(m.sourceFingerprint, source.captureFingerprint)
assert.equal(a.source.gunfighterCatalogFingerprint, g.fingerprint)
assert.equal(mobile.gunfighterFingerprint, g.fingerprint)
assert.equal(mobile.mobilityFingerprint, m.fingerprint)
assert.equal(mobile.profileAuditFingerprint, audit.fingerprint)
for (const state of ['normal', 'fireteam']) {
  const expected = g.entries.filter(e => m.profiles[m.keys[e.key]].status === 'rated' && e.result.states.some(s => s.id === state && Number.isFinite(s.rating))).map(e => e.key).sort()
  const actual = Object.keys(mobile.keys).filter(key => mobile.profiles[mobile.keys[key]][state] != null).sort()
  assert.deepEqual(actual, expected, `Complete ${state} mobility-adjusted cohort; no silent omissions`)
  assert.equal(mobile.coverage[state], expected.length)
}
const byKey = new Map(source.profiles.map(p => [p.id, p]))
for (const catalog of [g, a]) for (const entry of catalog.entries) {
  const p = byKey.get(entry.key)
  const linked = entry.result.states.some(s => s.id === 'fireteam')
  assert.equal(linked, p.fireteamCapable, entry.key)
  if (linked) assert.ok(audit.memberships[audit.profiles[audit.keys[entry.key]].m].length, entry.key)
  for (const state of entry.result.states) for (const used of state.weaponsUsed || []) {
    assert.ok(p.weapons.some(w => used.weapon === w.name || used.weapon.startsWith(w.name + ' (')), `${entry.key}: weapon not in official profile: ${used.weapon}`)
  }
}
const ccKeys = buildCanonicalCloseCombatProfiles({ official: capture }).flatMap(p => p.aliases.map(a => a.key)).sort()
const aliases = cc.entries.flatMap(e => e.aliases.map(a => a.key)).sort()
assert.deepEqual(aliases, ccKeys)
assert.equal(new Set(aliases).size, aliases.length, 'One CC result per exact profile identity')
const ccBySectorial = new Map()
for (const key of ccKeys) {
  const [sectorialId, unitId, groupId, optionId, profileId] = key.split(':').map(Number)
  if (!ccBySectorial.has(sectorialId)) ccBySectorial.set(sectorialId, [])
  ccBySectorial.get(sectorialId).push({ unitId, groupId, optionId, profileId })
}
for (const [sectorialId, members] of ccBySectorial) {
  const results = lookupCloseCombatRatings(cc, { sectorialId, combatGroups: [{ members }] })
  assert.equal(results.length, members.length)
  for (const result of results) assert.equal(result.status, 'matched', `${sectorialId}:${result.key}`)
}
for (const name of ['gunfighter-benchmark-catalog.json', 'aro-benchmark-catalog.json', 'close-combat-benchmark.json']) {
  const archiveName = name + '.gz.b64'
  const archive = await readFile(dir + archiveName, 'utf8')
  const parts = (await readdir(dir)).filter(n => n.startsWith(archiveName + '.part-')).sort()
  const assembled = (await Promise.all(parts.map(n => readFile(dir + n, 'utf8')))).join('')
  assert.equal(assembled, archive, name + ': no stale chunks')
  if (name !== 'aro-benchmark-catalog.json') assert.equal(gunzipSync(Buffer.from(archive, 'base64')).toString(), await readFile(dir + name, 'utf8'))
}
console.log(`PASS: shared provenance, ${keys.length} exact shooting/ARO/mobility identities, ${aliases.length} exact CC aliases, legal Fireteams, printed weapons, dependent fingerprints and archive parity.`)
