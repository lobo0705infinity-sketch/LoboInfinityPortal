import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import vm from 'node:vm'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { getArmyParentFaction, normalizeArmyForDisplay } from '../src/services/armyIdentity.ts'

const backend = readFileSync('backend/ArmyIntelligenceApi.gs', 'utf8')
const registry = readFileSync('backend/ArmyRegistry.gs', 'utf8')
const page = readFileSync('src/pages/ArmyIntelligence.tsx', 'utf8')
const api = readFileSync('src/services/api.ts', 'utf8')
const productionCapture = '.tmp/army-intelligence-full.json'
const fixture = 'scripts/fixtures/army-intelligence-scoped-read-model.json'
const full = JSON.parse(readFileSync(existsSync(productionCapture) ? productionCapture : fixture, 'utf8'))

const projectionStart = backend.indexOf('function buildArmyIntelligencePublicSummaryProjection')
const projectionEnd = backend.indexOf('function rebuildArmyIntelligenceReadModel()', projectionStart)
assert.ok(projectionStart > -1 && projectionEnd > projectionStart, 'Scoped projection helpers must be present.')

const context = vm.createContext({
  getArmyIntelligenceString(value: unknown) {
    return value === null || value === undefined ? '' : String(value).trim()
  },
})
vm.runInContext(`${registry}\n${backend.slice(projectionStart, projectionEnd)}`, context)
const buildSummary = vm.runInContext('buildArmyIntelligencePublicSummaryProjection', context)
const buildFaction = vm.runInContext('buildArmyIntelligencePublicFactionProjection', context)

const summary = JSON.parse(JSON.stringify(buildSummary(full)))
assert.equal(summary.success, true)
assert.equal(summary.scope, 'summary')
assert.ok(Buffer.byteLength(JSON.stringify(summary)) <= 5_000, 'Summary projection must remain at or below 5 KB.')
assert.equal(JSON.stringify(summary).includes('armyCode'), false, 'Summary must not expose Army Codes.')
assert.equal(JSON.stringify(summary).includes('combatGroups'), false, 'Summary must not expose decoded rosters.')

const decoded = full.lists.filter((list: any) =>
  list.status === 'decoded' && list.decoded && ['league', 'casual', 'tournament'].includes(list.sourceType.trim().toLowerCase()),
)
const referenceUnique = deduplicate(decoded)
const oldOptions = buildOldSelectorOptions(referenceUnique)
assert.deepEqual(summary.options, oldOptions, 'Summary selector options must exactly match the legacy full-response projection.')
assert.ok(summary.options.length > 0, 'Production-equivalent selector options must remain available.')

const productionTargets = [
  ['Operations Subsection', 125_000],
  ['PanOceania', 65_000],
  ['Kestrel Colonial Force', 65_000],
  ['Invincible Army', 20_000],
] as const
const targets = existsSync(productionCapture)
  ? productionTargets
  : productionTargets.filter(([faction]) => oldOptions.includes(faction))
const measuredFactionBytes: string[] = []

for (const [faction, maximumBytes] of targets) {
  const scoped = JSON.parse(JSON.stringify(buildFaction(full, faction)))
  const expected = referenceUnique.filter((list: any) => decodedSectorial(list) === faction)
  assert.equal(scoped.success, true)
  assert.equal(scoped.faction, faction)
  assert.equal(scoped.lists.length, expected.length, `${faction} list count must remain exact.`)
  assert.ok(Buffer.byteLength(JSON.stringify(scoped)) <= maximumBytes, `${faction} projection exceeds its bounded target.`)
  measuredFactionBytes.push(`${faction}=${Buffer.byteLength(JSON.stringify(scoped))}`)

  scoped.lists.forEach((actual: any, index: number) => {
    const { results, ...actualList } = actual
    const { resultSet, ...expectedList } = expected[index]
    assert.deepEqual(actualList, expectedList, `${faction} decoded list projection changed.`)
    assert.deepEqual([...results].sort(), [...resultSet].sort(), `${faction} result-filter semantics changed.`)
  })

  const expectedArmyLists = expected.map((list: any) => findArmyList(list, full.armyLists)).filter(Boolean)
  assert.deepEqual(scoped.armyLists, expectedArmyLists, `${faction} Explorer rows changed.`)
  assert.ok(scoped.lists.every((list: any) => decodedSectorial(list) === faction), `${faction} response leaked another scope.`)
}

assert.match(page, /getArmyIntelligenceSummary/)
assert.match(page, /getArmyIntelligenceFaction\(requestedSectorial, \{ signal: controller\.signal \}\)/)
assert.match(page, /return \(\) => controller\.abort\(\)/, 'Selection changes must cancel stale faction requests.')
assert.doesNotMatch(page, /\.getArmyIntelligence\(signal/)
assert.match(api, /getArmyIntelligence[\s\S]*getArmyIntelligenceSummary[\s\S]*getArmyIntelligenceFaction/)
assert.match(backend, /if \(scope\)[\s\S]*scope === "summary"[\s\S]*scope === "faction"/)
assert.match(backend, /if \(readModel\)[\s\S]*return jsonOutput\(readModel\);[\s\S]*rebuildArmyIntelligenceReadModelPayloadAndPersist/, 'Legacy unscoped fallback must remain compatible.')
assert.doesNotMatch(
  backend.slice(projectionStart, projectionEnd),
  /CanonicalDecoderGateway|resolveArmyCodeProfiles|UrlFetchApp|rebuildArmyIntelligence|processAutomationQueue/,
  'Scoped GET helpers must not decode, rebuild, or perform external work.',
)

console.log(`Army Intelligence scoped contract passed: summary=${Buffer.byteLength(JSON.stringify(summary))} bytes, options=${summary.options.length}, ${measuredFactionBytes.join(', ')}.`)

function deduplicate(lists: any[]) {
  const byIdentity = new Map<string, any>()
  lists.forEach((list) => {
    const key = `${normalizePart(list.player)}:${String(list.armyCodeHash).trim().toLowerCase()}`
    if (!key || key === ':') return
    const result = String(list.result || '').trim().toLowerCase()
    const existing = byIdentity.get(key)
    if (existing) {
      if (result) existing.resultSet.add(result)
      return
    }
    byIdentity.set(key, { ...list, resultSet: new Set(result ? [result] : []) })
  })
  return [...byIdentity.values()]
}

function buildOldSelectorOptions(lists: any[]) {
  const options = new Map<string, string>()
  lists.forEach((list) => {
    addOption(options, getArmyParentFaction(list.decoded?.faction) || getArmyParentFaction(list.faction) || normalizeArmyForDisplay(list.faction))
    addOption(options, decodedSectorial(list))
  })
  return [...options.values()].sort((left, right) => left.localeCompare(right))
}

function addOption(options: Map<string, string>, value: string) {
  const display = normalizeDisplay(normalizeArmyForDisplay(value))
  const registryEntry = CANONICAL_ARMY_REGISTRY.find((army) => army.active && army.name === display)
  const key = normalizePart(display).replace(/[^a-z0-9 ]+/g, ' ')
  if (registryEntry && key && !options.has(key)) options.set(key, display)
}

function decodedSectorial(list: any) {
  return normalizeDisplay(normalizeArmyForDisplay(list.decoded?.sectorial || list.sectorial || ''))
}

function normalizeDisplay(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') === 'panoceania' ? 'PanOceania' : value
}

function normalizePart(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function findArmyList(source: any, armyLists: any[]) {
  const sourceId = String(source.sourceId || '').trim()
  const armyCode = String(source.armyCode || '').trim()
  return armyLists.find((list) => sourceId && String(list.id) === sourceId) ||
    armyLists.find((list) => armyCode && String(list.armyCode || '').trim() === armyCode) || null
}
