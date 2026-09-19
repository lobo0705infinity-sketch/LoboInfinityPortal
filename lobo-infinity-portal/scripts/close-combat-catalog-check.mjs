import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CLOSE_COMBAT_CATALOG_SCHEMA, rankArmyCloseCombat, rankSubmittedCloseCombat } from '../bot/close-combat-catalog.mjs'
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
  assert.ok(entry.states.every((state) => Number.isFinite(state.percentile) && ['S', 'A', 'B', 'C', 'D', 'F'].includes(state.grade)))
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
const tierFixture = { schemaVersion: CLOSE_COMBAT_CATALOG_SCHEMA, entries: [{ key: '99:2:3:1', rating: 71, grade: 'A', percentile: 88, name: 'TEST CC', aliases: [{ sectorialId: 502 }], weapons: [], states: [{ id: 'normal', label: 'Normal active-turn CC', rating: 71, grade: 'A', percentile: 88, weaponsUsed: [] }] }] }
const ranked = rankArmyCloseCombat(tierFixture, { sectorialId: 502, combatGroups: [{ members: [{ combinedId: '502-99-2-3-1', unitId: 99, groupId: 2, optionId: 3, profileId: 1, unitName: 'Test CC' }] }] })
assert.equal(ranked[0].grade, 'A')
assert.equal(ranked[0].states[0].percentile, 88)
const collisionFixture = { schemaVersion: CLOSE_COMBAT_CATALOG_SCHEMA, entries: [
  { key: '701:1:1:1', name: 'KINNARA Scoutbots — KINNARA Scoutbots', points: 23, rating: 50.23, grade: 'A', percentile: 91.97, aliases: [{ sectorialId: 703, name: 'KINNARA Scoutbots' }], weapons: [], states: [] },
  { key: '701:1:1:1', name: 'SHARVARA HoundBots — SHARVARA', points: 18, rating: 37.34, grade: 'A', percentile: 83.57, aliases: [{ sectorialId: 703, name: 'SHARVARA HoundBots' }], weapons: [], states: [] },
] }
const collisionRanked = rankSubmittedCloseCombat(collisionFixture, [
  { combinedId: '703-1901-1-1-1', unitName: 'KINNARA Scoutbots', profileName: 'KINNARA Scoutbots', points: 23 },
  { combinedId: '703-1899-1-1-1', unitName: 'SHARVARA HoundBots', profileName: 'SHARVARA', points: 18 },
], { sectorialId: 703 })
assert.deepEqual(collisionRanked.map((entry) => entry.result.name), ['KINNARA Scoutbots — KINNARA Scoutbots', 'SHARVARA HoundBots — SHARVARA'])
console.log(`PASS - close-combat catalog ${catalog.fingerprint} contains ${catalog.entryCount} unique ranked CC identities from ${catalog.sourceAliasCount} official aliases.`)

function normalizeName(value) { return String(value).toLowerCase().replace(/^reinf(?:orcements?)?[:.]?\s*/i, '').replace(/\s+(?:reinf\.?|fto)\s*$/i, '').replace(/\s+/g, ' ').trim() }
