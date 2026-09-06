import assert from 'node:assert/strict'
import { buildCanonicalDataset, resolveCanonicalWeaponRecords } from './infinity-army-canonical-dataset.mjs'

const metadata = { weapons: [
  { id: 1, name: 'AP HMG', type: 'WEAPON', burst: '4' },
  { id: 2, name: 'Combi Rifle', type: 'WEAPON', burst: '3' },
  { id: 3, name: 'Armed Turret', mode: 'Rifle', burst: '3' },
  { id: 3, name: 'Armed Turret', mode: 'AP Rifle', burst: '3' },
  { id: 6, name: 'Flammenspeer', mode: 'Blast Mode', burst: '1' },
  { id: 6, name: 'Flammenspeer', mode: 'Hit Mode', burst: '1' },
  { id: 7, name: 'Heavy Rocket Launcher', mode: 'Blast Mode', burst: '2' },
  { id: 7, name: 'Heavy Rocket Launcher', mode: 'Hit Mode', burst: '2' },
  { id: 8, name: 'Armed Turret', mode: 'Rifle', burst: '4' },
  { id: 8, name: 'Armed Turret', mode: 'Missile Launcher', burst: '1' },
  { id: 4, name: 'Deployable Device', burst: '-' },
  { id: 5, name: 'Unknown Weapon' },
] }
const payload = { version: '7.test', url: 'https://infinitytheuniverse.com/army/units/en/10', units: [{ id: 10 }], fireteamChart: { teams: [] } }
const dataset = buildCanonicalDataset({ metadata, payloads: [payload], capturedAt: '2026-01-01T00:00:00.000Z' })
assert.match(dataset.datasetId, /^iad-[a-f0-9]{24}$/)
assert.equal(dataset.officialUnitVersion, '7.test')
assert.ok(dataset.sourceUrls.includes(payload.url))
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 1 }])[0].burst, 4)
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 2 }])[0].burst, 3)
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 4 }])[0].burstStatus, 'not-applicable')
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 5 }])[0].burstStatus, 'unknown')
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 3 }])[0].burst, 3)
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 6 }])[0].burst, 1)
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 6 }])[0].modeResolution, 'ambiguous')
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 7 }])[0].burst, 2)
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 8 }])[0].burstStatus, 'ambiguous')
assert.equal(resolveCanonicalWeaponRecords(dataset, [{ id: 3, mode: 'AP Rifle' }])[0].burst, 3)
const same = buildCanonicalDataset({ metadata, payloads: [payload], capturedAt: 'different' })
assert.equal(dataset.datasetId, same.datasetId)
const changed = buildCanonicalDataset({ metadata: { weapons: [...metadata.weapons, { id: 6, name: 'New', burst: '1' }] }, payloads: [payload] })
assert.notEqual(dataset.datasetId, changed.datasetId)
console.log('Canonical dataset provenance and mode-isolation checks passed.')
