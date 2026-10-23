import assert from 'node:assert/strict'
import { resolveAuroraMissionReference } from '../src/config/missionGeistNavigation.ts'
import type { MissionGeistCatalogMission } from '../src/services/publicSnapshot.ts'
const official = (name: string, season: number, current = false): MissionGeistCatalogMission => ({
  id: `s${season}_${name.toLowerCase()}`, name, current, rights: { official: true },
  canonicalUrl: `https://infinitygeist.com/mission/s${season}_${name.toLowerCase()}`,
  sourceCollectionId: `s${season}`, sourceCollectionName: `ITS Season ${season}`,
})
for (const name of ['Frontline', 'Supremacy']) {
  const records = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(season => official(name, season))
  assert.equal(resolveAuroraMissionReference(name, records)?.id, `s16_${name.toLowerCase()}`)
  assert.equal(resolveAuroraMissionReference(name, [...records].reverse())?.id, `s16_${name.toLowerCase()}`)
  assert.equal(records[0].sourceCollectionId, 's6', 'Do not mutate the shared catalogue')
  assert.equal(resolveAuroraMissionReference(name, [...records, official(name, 18, true)])?.current, true)
  assert.equal(resolveAuroraMissionReference(name, records)?.current, false, 'Archive status remains available for the label')
  assert.equal(resolveAuroraMissionReference(name, [{...official(name, 18, true), canonicalUrl: 'javascript:alert(1)'}]), undefined)
  assert.equal(resolveAuroraMissionReference(name, [{...official(name, 18, true), rights: {official: false}}]), undefined)
  assert.equal(resolveAuroraMissionReference(name, []), undefined)
}
console.log('PASS: multi-season Frontline/Supremacy resolve once, newest official archive is labelled, current editions take precedence, unsafe URLs excluded.')
