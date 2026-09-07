import assert from 'node:assert/strict'
import { selectRefreshCandidates } from '../api/army-intelligence-refresh-worker.mjs'
import { buildTacticalAnalysis } from '../src/services/armyIntelligenceTacticalAnalysis.ts'
import { ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION, snapshotHasCompleteTacticalMetadata } from './army-intelligence-snapshot-schema.mjs'

const source = { armyCodeHash: 'hash', snapshotKey: 'casual:82:winner:defuser:hash' }
const weapon = (name: string, burst: number) => ({ name, burst, burstStatus: 'canonical', source: 'iad-fixture' })
const profile = (combinedId: string, unit: string, bs: number, weapons: Array<{ name: string; burst: number }>, skills: string[] = []) => ({
  bs, combatGroup: 1, combinedId, unit, profile: unit, skills, equipment: [], weapons: weapons.map((item) => item.name),
  weaponProfiles: weapons.map((item) => weapon(item.name, item.burst)), fireteamEligibility: { state: 'verified-false', verified: false, teams: [] },
  chainOfCommand: false, doctor: false, engineer: false, forwardObserver: false, hacker: false, lieutenant: false,
  orderTypes: ['regular'], points: 1, specialist: false, structure: null, swc: 0, troopType: 'MI', wounds: 1,
})
const decoded = {
  armyCode: 'fixture', decoderVersion: 'army-intelligence-decoder-v5', tacticalSchemaVersion: ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION,
  enrichment: { status: 'complete' }, faction: 'Ariadna', sectorial: 'USAriadna Ranger Force', listName: 'Bald Burgers',
  totals: { combatGroups: 1, points: 300, swc: 5 }, orderCounts: { regular: 10, irregular: 0, impetuous: 0, lieutenant: 1 },
  combatGroups: [{ combatGroup: 1, entries: [
    profile('304-777-1-4-1', 'UNKNOWN RANGER', 13, [{ name: 'AP Spitfire', burst: 4 }], ['Courage', 'Mimetism [-3]', 'Tactical Awareness']),
    profile('304-775-1-2862-1', 'BLACKJACK AP HMG', 13, [{ name: 'AP Heavy Machine Gun', burst: 4 }, { name: 'Panzerfaust', burst: 1 }]),
    profile('304-775-1-2863-1', 'BLACKJACK T2 SNIPER', 13, [{ name: 'T2 Sniper Rifle', burst: 2 }]),
    profile('304-232-1-4-1', 'MINUTEMAN', 13, [{ name: 'Missile Launcher', burst: 1 }]),
    profile('304-230-1-5-1', 'GRUNT', 11, [{ name: 'AP Sniper Rifle', burst: 2 }]),
  ] }],
}
const current = { armyCodeHash: 'hash', decoderVersion: 'army-intelligence-decoder-v5', hasProfileMetadata: true, hasTacticalMetadata: true, status: 'decoded' }

assert.deepEqual(selectRefreshCandidates([source], new Map([[source.snapshotKey, current]])), [source], 'missing schema version must invalidate an otherwise current snapshot')
assert.deepEqual(selectRefreshCandidates([source], new Map([[source.snapshotKey, { ...current, tacticalSchemaVersion: ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION, hasTacticalMetadata: false }]])), [source], 'incomplete tactical metadata must bypass normal freshness')

const list = { ...source, tacticalSchemaVersion: ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION, status: 'decoded', decoded }
assert.equal(snapshotHasCompleteTacticalMetadata(list), true)
assert.equal(snapshotHasCompleteTacticalMetadata({ ...list, decoded: { ...decoded, combatGroups: [{ combatGroup: 1, entries: [{ ...decoded.combatGroups[0].entries[0], bs: null }] }] } }), false)
assert.equal(snapshotHasCompleteTacticalMetadata({ ...list, decoded: { ...decoded, combatGroups: [{ combatGroup: 1, entries: [{ ...decoded.combatGroups[0].entries[0], weaponProfiles: [{ name: 'AP Spitfire', burst: null, burstStatus: 'unknown' }] }] }] } }), false)

const analysis = buildTacticalAnalysis([list] as never)
const apex = analysis.categories.find((category) => category.id === 'apex')!.profiles
const aro = analysis.categories.find((category) => category.id === 'aro')!.profiles
assert.ok(apex.some((item) => item.unit === 'UNKNOWN RANGER' && item.bs === 13 && item.weapons.some((item) => item.name === 'AP Spitfire' && item.burst === 4)))
assert.equal(apex.filter((item) => item.unit.startsWith('BLACKJACK')).length, 1, 'AP HMG Blackjack must be restored as Apex')
for (const expected of ['BLACKJACK AP HMG', 'BLACKJACK T2 SNIPER', 'MINUTEMAN', 'GRUNT']) assert.ok(aro.some((item) => item.unit === expected), `${expected} must be restored as an ARO piece`)
const hiddenAnalysis = buildTacticalAnalysis([{ ...list, decoded: { ...decoded, combatGroups: [{ combatGroup: 1, entries: [profile('hidden', 'HIDDEN SCOUT', 11, [{ name: 'Rifle', burst: 3 }], ['Hidden Deployment'])] }] } }] as never)
assert.ok(hiddenAnalysis.categories.find((category) => category.id === 'alternative')!.profiles.some((item) => item.unit === 'HIDDEN SCOUT'), 'Hidden Deployment categorization remains intact')

console.log('Army Intelligence refresh pipeline passed (schema invalidation, stale selection, metadata completeness, exact USAriadna tactical recovery).')
