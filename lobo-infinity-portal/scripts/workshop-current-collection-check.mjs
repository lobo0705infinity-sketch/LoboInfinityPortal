import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { loboWorkshopMaps, archivedLoboWorkshopMaps, loboWorkshopMapBySlug, loboWorkshopMapSections, resolveLoboWorkshopMapLabel } from '../shared/lobo-workshop-maps.mjs'
import { buildMapRatings } from '../src/public/mapRatings.ts'
const release = JSON.parse(readFileSync('public/assets/maps/seven-map-update-20261102-r1/release-inventory.json', 'utf8'))
assert.equal(loboWorkshopMaps.length,40)
assert.equal(new Set(loboWorkshopMaps.map(map=>map.id)).size,40)
assert.equal(new Set(loboWorkshopMaps.map(map=>map.layoutKey)).size,32)
const missions=new Map()
for(const map of loboWorkshopMaps){
 assert.equal(map.isCurrent,true)
 assert.equal(map.missionSetups.length,1)
 const mission=map.missionSetups[0];missions.set(mission,[...(missions.get(mission)||[]),map.layoutKey])
 assert.equal(resolveLoboWorkshopMapLabel(map.workshopBagName)?.id,map.id)
 for(const url of [map.overhead,map.angled,map.diagram,map.download]){
  assert.ok(url?.startsWith('/assets/maps/'));assert.ok(existsSync(fileURLToPath(new URL('../public'+url,import.meta.url))),url)
 }
 const bytes=readFileSync('public'+map.download)
 const expected=release.maps.find(item=>item.kind==='general'&&item.guid===map.guid)
 assert.ok(expected);assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256,'Published bag matches release inventory')
 const save=JSON.parse(bytes);assert.equal(save.ObjectStates.length,1)
 const bag=save.ObjectStates[0];assert.equal(bag.Name,'Bag');assert.equal(bag.GUID,map.guid)
 assert.equal(bag.Nickname,map.workshopBagName)
 assert.equal(bag.ContainedObjects.length,map.objectCount)
 assert.ok(bag.LuaScript.endsWith('\r\n'),'Native Stage loader terminates with CRLF')
 assert.ok(!/(?<!\r)\n/.test(bag.LuaScript),'Native Stage loader uses CRLF throughout')
 const ids=new Set();const family=new Set()
 function collect(o){family.add(o.GUID);Object.values(o.States||{}).forEach(collect)}
 bag.ContainedObjects.forEach(collect)
 for(const row of bag.LuaScript.split('\r\n').filter(Boolean)){
  assert.match(row,/^--[0-9a-f]{6}(,-?\d+(?:\.\d+)?(?:e[+-]?\d+)?){6}$/)
  const [id,...fields]=row.slice(2).split(',');assert.ok(!ids.has(id));ids.add(id)
  assert.ok(family.has(id),`${map.slug}: placement resolves to a root or alternate state`)
  for(const n of fields.map(Number))assert.ok(Number.isFinite(n)&&Math.abs(n)<1000)
  for(const angle of fields.slice(3).map(Number))assert.ok(Math.abs(angle-Math.fround(angle))<.0005,'Native rotation meets the Stage alignment tolerance')
 }
 for(const object of bag.ContainedObjects)assert.ok(ids.has(object.GUID),'Every root has a deployment record')
 const controls=bag.ContainedObjects.find(o=>o.LuaScript?.includes('local universalConfig='))
 assert.ok(controls,`${map.slug}: current map controls exist`)
 for(const fn of ['loboUniversalBooty','loboUniversalMetaChemistry','loboUniversalDeployment0','loboUniversalDeployment4','loboUniversalDeployment8'])assert.ok(controls.LuaScript.includes('function '+fn+'('),`${map.slug}: ${fn}`)
 if(map.guid==='1008da'){
  assert.equal(map.name,'Kestrel Lunar Base');assert.equal(bag.ContainedObjects.length,68)
  assert.equal(bag.ContainedObjects.filter(o=>o.Tags?.includes('building')).length,19)
  assert.ok(!controls.LuaScript.includes("label='MAP CONTROLS'"),'Approved R14 removes the board-side button')
  assert.ok(controls.LuaScript.includes('LOBO_UI_KESTREL_READY'))
  assert.ok(bag.ContainedObjects.every(o=>o.Name!=='Chip'))
  assert.equal(bag.ContainedObjects.filter(o=>o.Nickname?.startsWith('Data-Harvester ')).length,0)
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
  assert.ok(['tts', 'geometry'].includes(map.previewKind))
  assert.notEqual(map.overhead, map.angled)
  if (map.slug.endsWith('-satellite') && map.previewKind === 'tts') {
    assert.equal(map.captureDate, '2026-10-20')
    assert.notEqual(map.overhead, map.diagram)
    assert.notEqual(map.angled, map.diagram)
  }
}
assert.equal(loboWorkshopMaps.filter(map => map.previewKind === 'tts').length, 31)
assert.equal(loboWorkshopMaps.filter(map => map.previewKind === 'geometry').length, 9)
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
