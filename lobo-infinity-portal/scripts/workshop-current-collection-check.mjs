import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loboWorkshopMaps, archivedLoboWorkshopMaps, loboWorkshopMapBySlug, loboWorkshopMapSections, resolveLoboWorkshopMapLabel } from '../shared/lobo-workshop-maps.mjs'
import { buildMapRatings } from '../src/public/mapRatings.ts'

assert.equal(loboWorkshopMaps.length, 40)
assert.equal(new Set(loboWorkshopMaps.map(map => map.id)).size, 40)
assert.equal(new Set(loboWorkshopMaps.map(map => map.layoutKey)).size, 28)
const missions = new Map()
for (const map of loboWorkshopMaps) {
  assert.equal(map.isCurrent, true, `${map.slug} is a current setup`)
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
  const stateGuids = object => [object.GUID, ...Object.values(object.States ?? {}).flatMap(stateGuids)]
  const expectedIds = map.previewKind === 'render'
    ? bag.ContainedObjects.flatMap(stateGuids)
    : bag.ContainedObjects.map(object => object.GUID)
  assert.deepEqual(ids, new Set(expectedIds))
  if (map.previewKind === 'render') {
    const mats = bag.ContainedObjects.filter(object => object.GridProjection)
    assert.equal(mats.length, 1, `${map.slug} projects the grid only on its custom mat`)
    assert.equal(mats[0].Name, 'Custom_Model')
    assert.equal(mats[0].Transform.scaleX, 1)
    assert.equal(mats[0].Transform.scaleZ, 1)
    const controllers = bag.ContainedObjects.filter(object => object.LuaScript?.includes('function redrawOverlays'))
    assert.equal(controllers.length, 1, `${map.slug} has one mission/deployment controller`)
    assert.equal(controllers[0].Name, 'BlockSquare', `${map.slug} controls load independently of model assets`)
    assert.notEqual(controllers[0].GUID, mats[0].GUID)
    assert.ok(controllers[0].LuaScript.includes('function checkDeployment'))
    assert.ok(controllers[0].LuaScript.includes('Wait.time(checkDeployment,.5,-1)'))
    assert.equal(mats[0].Transform.posY, 3.5, `${map.slug} supports 2.5-inch pits above the table`)
    assert.ok(mats[0].CustomMesh.DiffuseURL.endsWith('/old-quarter-street-materials.jpg'))
    assert.ok(controllers[0].LuaScript.includes('function setDeploymentSideA'))
    assert.ok(controllers[0].LuaScript.includes('function setDeploymentSideB'))
    assert.ok(!controllers[0].LuaScript.includes(':gmatch('), `${map.slug} avoids the reported TTS pattern failure`)
    assert.ok(!bag.ContainedObjects.some(object => object.CustomMesh?.MeshURL.includes('hyperthermal-tech')))
    const rubble = bag.ContainedObjects.filter(object => /wall-rubble(?:-medium|-large)?\.obj$/.test(object.CustomMesh?.MeshURL ?? ''))
    assert.equal(rubble.length, 16, `${map.slug} includes sixteen rubble clusters`)
    assert.equal(new Set(rubble.map(object => object.CustomMesh.MeshURL)).size, 3)
  }
  const surfaces = bag.ContainedObjects.filter(object => object.LuaScript?.includes('LOBO_MISSION_LINES'))
  assert.equal(surfaces.length, map.previewKind === 'render' ? 0 : 1, `${map.slug} has one applicable mission marking surface`)
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
  assert.ok(['tts', 'render'].includes(map.previewKind))
  assert.notEqual(map.overhead, map.angled)
  if (map.slug.endsWith('-satellite') && map.previewKind === 'tts') {
    assert.equal(map.captureDate, '2026-10-20')
    assert.notEqual(map.overhead, map.diagram)
    assert.notEqual(map.angled, map.diagram)
  }
}
assert.equal(loboWorkshopMaps.filter(map => map.previewKind === 'tts').length, 39)
assert.equal(loboWorkshopMaps.filter(map => map.previewKind === 'render').length, 1)
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

