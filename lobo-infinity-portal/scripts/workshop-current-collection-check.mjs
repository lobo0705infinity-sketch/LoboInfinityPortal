import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loboWorkshopMaps, archivedLoboWorkshopMaps, loboWorkshopMapBySlug, loboWorkshopMapSections, resolveLoboWorkshopMapLabel } from '../shared/lobo-workshop-maps.mjs'
import { buildMapRatings } from '../src/public/mapRatings.ts'

assert.equal(loboWorkshopMaps.length, 40)
assert.equal(new Set(loboWorkshopMaps.map(map => map.id)).size, 40)
assert.equal(new Set(loboWorkshopMaps.map(map => map.layoutKey)).size, 16)
const missions = new Map()
for (const map of loboWorkshopMaps) {
  assert.equal(map.missionSetups.length, 1)
  const mission = map.missionSetups[0]
  missions.set(mission, [...(missions.get(mission) || []), map.layoutKey])
  assert.equal(resolveLoboWorkshopMapLabel(map.workshopBagName)?.id, map.id)
  for (const url of [map.overhead, map.angled, map.diagram, map.download]) {
    assert.ok(url?.startsWith('/assets/maps/'))
    assert.ok(existsSync(fileURLToPath(new URL(`../public${url}`, import.meta.url))), url)
  }
  const save = JSON.parse(readFileSync(fileURLToPath(new URL(`../public${map.download}`, import.meta.url)), 'utf8'))
  assert.equal(save.ObjectStates.length, map.objectCount, `${map.slug} count matches its downloadable save`)
}
assert.equal(missions.size, 20)
for (const [mission, keys] of missions) assert.equal(new Set(keys).size, 2, `${mission} has two distinct layouts`)
const grouped = loboWorkshopMapSections.flatMap(section => section.layouts.flatMap(layout => layout.saves.map(map => map.id)))
assert.equal(grouped.length, 40)
assert.equal(new Set(grouped).size, 40)
assert.deepEqual(loboWorkshopMapSections.map(section => section.layouts.reduce((n, layout) => n + layout.saves.length, 0)), [28, 8, 4])
for (const legacy of archivedLoboWorkshopMaps) assert.equal(loboWorkshopMapBySlug.get(legacy.slug)?.id, legacy.id)
const azure = loboWorkshopMaps.find(map => map.name === 'Azure Circuit')
const legacyAzure = archivedLoboWorkshopMaps.find(map => map.name === 'Azure Circuit')
const ratings = buildMapRatings([{ id: 1, mapSlug: legacyAzure.slug, mapRating: 5 }, { id: 2, mapSlug: azure.slug, mapRating: 3 }])
assert.deepEqual(ratings.get(azure.layoutKey), { average: 4, count: 2, rank: 1 })
console.log('Current Workshop catalogue, downloads, mission coverage, archived links and shared ratings passed.')
