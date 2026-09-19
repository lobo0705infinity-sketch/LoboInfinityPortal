import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CLOSE_COMBAT_CATALOG_SCHEMA } from '../bot/close-combat-catalog.mjs'
import { CLOSE_COMBAT_BENCHMARK_VERSION } from '../bot/close-combat-standard-benchmark.mjs'

const catalog = JSON.parse(await readFile(new URL('../data/infinity-army/close-combat-benchmark.json', import.meta.url), 'utf8'))
assert.equal(catalog.schemaVersion, CLOSE_COMBAT_CATALOG_SCHEMA)
assert.equal(catalog.benchmarkVersion, CLOSE_COMBAT_BENCHMARK_VERSION)
assert.equal(catalog.officialDataVersion, '7.26246.159')
assert.equal(catalog.defenders.length, 8)
assert.equal(catalog.entryCount, catalog.entries.length)
assert.ok(catalog.entryCount > 900)
assert.ok(catalog.sourceAliasCount > catalog.entryCount)
assert.equal(new Set(catalog.entries.map((entry) => entry.key)).size <= catalog.entryCount, true)
for (const entry of catalog.entries) {
  assert.ok(Number.isFinite(entry.rating), entry.name)
  assert.ok(entry.weapons.length, entry.name)
  assert.ok(entry.weapons.every((weapon) => Number.isFinite(weapon.power)), `${entry.name} has a CC weapon without fixed PS`)
  assert.ok(entry.states.some((state) => state.id === 'normal'))
  assert.ok(entry.states.some((state) => state.id === 'reactive'))
  if (entry.skills.some((skill) => /protheion/i.test(skill))) {
    assert.ok(entry.states.some((state) => state.id === 'protheion-1'))
    assert.ok(entry.states.some((state) => state.id === 'protheion-2'))
  }
}
const rankingIdentities = catalog.entries.map((entry) => JSON.stringify([
  normalizeName(entry.name),
  entry.rating,
]))
assert.equal(new Set(rankingIdentities).size, rankingIdentities.length, 'Exact repeated ranking identities must be collapsed')
assert.ok(catalog.entries.some((entry) => entry.skills.some((skill) => /natural born warrior/i.test(skill))))
assert.ok(catalog.entries.some((entry) => entry.skills.some((skill) => /protheion/i.test(skill))))
console.log(`PASS - close-combat catalog ${catalog.fingerprint} contains ${catalog.entryCount} unique ranked CC identities from ${catalog.sourceAliasCount} official aliases.`)

function normalizeName(value) { return String(value).toLowerCase().replace(/^reinf(?:orcements?)?[:.]?\s*/i, '').replace(/\s+(?:reinf\.?|fto)\s*$/i, '').replace(/\s+/g, ' ').trim() }
