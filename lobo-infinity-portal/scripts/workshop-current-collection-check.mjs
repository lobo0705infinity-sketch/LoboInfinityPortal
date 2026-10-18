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
  assert.equal(save.ObjectStates.length, 1, `${map.slug} downloads a single map bag`)
  const bag = save.ObjectStates[0]
  assert.equal(bag.Name, 'Bag')
  assert.equal(bag.GUID, map.guid)
  assert.equal(bag.ContainedObjects.length, map.objectCount, `${map.slug} inventory matches the catalogue`)
  assert.ok(bag.LuaScript.startsWith('--'), `${map.slug} uses the native drop-zone format`)
  const rows = bag.LuaScript.split('\r\n')
  assert.equal(rows.pop(), '', `${map.slug} terminates placement records with CRLF`)
  const ids = new Set()
  for (const row of rows) {
    assert.match(row, /^--[0-9a-f]{6}(,-?\d+\.\d{6}){6}$/)
    const [id, ...fields] = row.slice(2).split(',')
    assert.ok(!ids.has(id), `${map.slug} has no repeated placement GUID`)
    ids.add(id)
    const [x, y, z, ...rotation] = fields.map(Number)
    assert.ok(Math.abs(x) < 44 && Math.abs(y) < 26 && Math.abs(z) < 26, `${map.slug}: ${id} stays inside the Stage clear zone`)
    for (const angle of rotation) {
      assert.ok(angle >= 0 && angle < 360, `${map.slug}: ${id} uses canonical Euler angles`)
      assert.ok(angle === 0 || (angle >= 0.01 && angle <= 359.99), `${map.slug}: ${id} avoids Unity's near-zero Euler wrap`)
      assert.ok(Math.abs(angle - Math.fround(angle)) < 0.0005, `${map.slug}: ${id} meets the Stage alignment tolerance`)
    }
  }
  assert.deepEqual(ids, new Set(bag.ContainedObjects.map(object => object.GUID)))
}
assert.equal(missions.size, 20)
for (const [mission, keys] of missions) assert.equal(new Set(keys).size, 2, `${mission} has two distinct layouts`)
const grouped = loboWorkshopMapSections.flatMap(section => section.layouts.flatMap(layout => layout.saves.map(map => map.id)))
assert.equal(grouped.length, 40)
assert.equal(new Set(grouped).size, 40)
assert.equal(loboWorkshopMapSections.length, 20)
assert.deepEqual(loboWorkshopMapSections.map(section => section.title), [...missions.keys()].sort((a, b) => a.localeCompare(b)))
for (const section of loboWorkshopMapSections) {
  assert.equal(section.layouts.length, 2)
  for (const layout of section.layouts) assert.deepEqual(layout.saves[0].missionSetups, [section.title])
}
for (const map of loboWorkshopMaps) {
  assert.equal(map.previewKind, 'tts')
  assert.notEqual(map.overhead, map.angled)
}
for (const legacy of archivedLoboWorkshopMaps) assert.equal(loboWorkshopMapBySlug.get(legacy.slug)?.id, legacy.id)
const azure = loboWorkshopMaps.find(map => map.name === 'Azure Circuit')
const legacyAzure = archivedLoboWorkshopMaps.find(map => map.name === 'Azure Circuit')
const ratings = buildMapRatings([{ id: 1, mapSlug: legacyAzure.slug, mapRating: 5 }, { id: 2, mapSlug: azure.slug, mapRating: 3 }])
assert.deepEqual(ratings.get(azure.layoutKey), { average: 4, count: 2, rank: 1 })
console.log('Current Workshop catalogue, downloads, mission coverage, archived links and shared ratings passed.')
