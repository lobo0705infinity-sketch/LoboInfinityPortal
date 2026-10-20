import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loboWorkshopMaps, archivedLoboWorkshopMaps, loboWorkshopMapBySlug, loboWorkshopMapSections, resolveLoboWorkshopMapLabel } from '../shared/lobo-workshop-maps.mjs'
import { buildMapRatings } from '../src/public/mapRatings.ts'

assert.equal(loboWorkshopMaps.length, 40)
assert.equal(new Set(loboWorkshopMaps.map(map => map.id)).size, 40)
assert.equal(new Set(loboWorkshopMaps.map(map => map.layoutKey)).size, 25)
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
  const surfaces = bag.ContainedObjects.filter(object => object.LuaScript?.includes('LOBO_MISSION_LINES'))
  assert.equal(surfaces.length, 1, `${map.slug} has one mission marking surface`)
  for (const surface of surfaces) {
    const expectedScale = map.slug === 'uplink-center-1-satellite' ? 48.03 : 24
    if (expectedScale === 48.03) assert.equal(surface.Name, 'BlockSquare')
    assert.equal(surface.Transform.scaleX, expectedScale, `${map.slug} keeps original mat or street-foundation dimensions`)
    assert.equal(surface.Transform.scaleZ, expectedScale)
    assert.ok(surface.LuaScript.includes('thickness=line.thickness/lineScale'), `${map.slug} converts stroke widths to local units`)
    assert.ok(!surface.LuaScript.includes('thickness=line.thickness}'), `${map.slug} avoids oversized strokes`)
  }

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
  if (map.slug.endsWith('-satellite')) {
    assert.equal(map.previewKind, 'diagram')
    assert.equal(map.overhead, map.diagram)
    assert.equal(map.angled, map.diagram)
  } else {
    assert.equal(map.previewKind, 'tts')
    assert.notEqual(map.overhead, map.angled)
  }
}
assert.equal(loboWorkshopMaps.filter(map => map.previewKind === 'diagram').length, 9)
assert.equal(loboWorkshopMaps.filter(map => map.name === 'Azure Circuit').length, 2)
for (const legacy of archivedLoboWorkshopMaps) assert.equal(loboWorkshopMapBySlug.get(legacy.slug)?.id, legacy.id)
const azure = loboWorkshopMaps.find(map => map.name === 'Azure Circuit')
const legacyAzure = archivedLoboWorkshopMaps.find(map => map.name === 'Azure Circuit')
const ratings = buildMapRatings([{ id: 1, mapSlug: legacyAzure.slug, mapRating: 5 }, { id: 2, mapSlug: azure.slug, mapRating: 3 }])
assert.deepEqual(ratings.get(azure.layoutKey), { average: 4, count: 2, rank: 1 })
for (const replacement of loboWorkshopMaps.filter(map => map.slug.endsWith('-satellite'))) {
  const prior = loboWorkshopMapBySlug.get(replacement.slug.replace(/-satellite$/, ''))
  assert.equal(prior.isCurrent, false)
  assert.notEqual(prior.id, replacement.id)
  assert.notEqual(prior.layoutKey, replacement.layoutKey)
  assert.equal(resolveLoboWorkshopMapLabel(prior.workshopBagName).id, prior.id)
  const separate = buildMapRatings([
    { id: 1, mapSlug: prior.slug, mapRating: 5 },
    { id: 2, mapSlug: replacement.slug, mapRating: 1 },
  ])
  assert.equal(separate.get(prior.layoutKey).average, 5)
  assert.equal(separate.get(replacement.layoutKey).average, 1)
}
console.log('Current Workshop catalogue, downloads, mission coverage, archived links and shared ratings passed.')

