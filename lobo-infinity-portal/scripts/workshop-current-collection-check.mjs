import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path/posix'
import { loboWorkshopMaps, archivedLoboWorkshopMaps, loboWorkshopMapBySlug, loboWorkshopMapSections, resolveLoboWorkshopMapLabel } from '../shared/lobo-workshop-maps.mjs'
import { buildMapRatings } from '../src/public/mapRatings.ts'
import current from '../shared/lobo-workshop-current.json' with { type: 'json' }
import communityArchive from '../shared/lobo-workshop-community-archive-20261116.json' with { type: 'json' }
import { describePublicSearchPage } from '../shared/public-search-content.mjs'

const release = JSON.parse(readFileSync('public'+current.releaseInventory, 'utf8'))
const tableCount = 21
assert.equal(loboWorkshopMaps.length, tableCount)
assert.equal(new Set(loboWorkshopMaps.map(map=>map.id)).size, tableCount)
assert.equal(new Set(loboWorkshopMaps.map(map=>map.layoutKey)).size, tableCount)
const missions=new Map()
for(const map of loboWorkshopMaps){
 assert.equal(map.isCurrent,true)
 assert.equal(map.missionSetups.length,1)
 const mission=map.missionSetups[0];missions.set(mission,[...(missions.get(mission)||[]),map.layoutKey])
 assert.equal(resolveLoboWorkshopMapLabel(map.workshopBagName)?.id,map.id)
 if (map.previewKind === 'workshop') {
  assert.ok(['meridian-exchange', 'vanta-customs-yard', 'veyra-gate'].includes(map.slug))
  assert.ok(!map.overhead && !map.angled && !map.diagram)
  if (!map.download) continue
 }
 for(const url of [map.overhead,map.angled,map.diagram,map.download].filter(Boolean)){
  assert.ok(url.startsWith('/assets/maps/'));assert.ok(existsSync(fileURLToPath(new URL('../public'+url,import.meta.url))),url)
 }
 const bytes=readFileSync('public'+map.download)
 const bagSha256=createHash('sha256').update(bytes).digest('hex')
 assert.equal(map.previewBagSha256,bagSha256,`${map.name}: previews match the current published bag`)
 const preview=JSON.parse(readFileSync('public'+map.previewManifest,'utf8'))
 assert.equal(preview.bagSha256,bagSha256)
 assert.equal(preview.slug,map.slug)
 for(const view of ['overhead','angled']) {
  assert.ok(map[view].endsWith('/'+preview.views[view]))
  const image=readFileSync('public'+map[view])
  assert.equal(image.toString('ascii',0,4),'RIFF')
  assert.equal(image.toString('ascii',8,12),'WEBP')
  assert.ok(image.length>10000,`${map.name}: substantial ${view} preview`)
 }

 const expected=release.maps.find(item=>item.kind==='general'&&item.guid===map.guid)
 assert.ok(expected);assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256,'Published bag matches release inventory')
 const save=JSON.parse(bytes);assert.equal(save.ObjectStates.length,1)
 const bag=save.ObjectStates[0];assert.equal(bag.Name,'Bag');assert.equal(bag.GUID,map.guid)
 assert.equal(bag.Nickname,map.workshopBagName)
 assert.equal(bag.ContainedObjects.length,map.objectCount)
 assert.ok(bag.LuaScript.endsWith('\n'),'Stage script ends with a complete line')
 assert.ok(!/\r(?!\n)/.test(bag.LuaScript),'Stage script has no bare CR characters')
 const ids=new Set();const family=new Set()
 function collect(o){family.add(o.GUID);Object.values(o.States||{}).forEach(collect)}
 bag.ContainedObjects.forEach(collect)
 for(const row of bag.LuaScript.split(/\r?\n/).filter(row => /^--[0-9a-f]{6},/.test(row))){
  assert.match(row,/^--[0-9a-f]{6}(,-?\d+(?:\.\d+)?(?:e[+-]?\d+)?){6}$/)
  const [id,...fields]=row.slice(2).split(',');assert.ok(!ids.has(id));ids.add(id)
  assert.ok(family.has(id),`${map.slug}: placement resolves to a root or alternate state`)
  for(const n of fields.map(Number))assert.ok(Number.isFinite(n)&&Math.abs(n)<1000)
  for(const angle of fields.slice(3).map(Number))assert.ok(Math.abs(angle-Math.fround(angle))<.0005,'Native rotation meets the Stage alignment tolerance')
 }
 for(const object of bag.ContainedObjects)assert.ok(ids.has(object.GUID),'Every root has a deployment record')
 const controllers=bag.ContainedObjects.filter(o=>o.LuaScript?.includes('LOBO_STANDARD_VERSION=1'))
 assert.equal(controllers.length,1,`${map.slug}: one approved controller`)
 const controls=controllers[0]
 assert.ok(controls,`${map.slug}: current map controls exist`)
 const actions = ['loboRotateMap180','loboStandardClear','loboStandardGrid','loboStandardMissionOpen','loboZonePickColor','loboStandardInvoke']
 assert.ok(controls.LuaScript.includes('LOBO_STANDARD_VERSION=1'),`${map.slug}: approved standard owner`)
 for(const fn of actions)assert.ok(controls.LuaScript.includes('function '+fn+'('),`${map.slug}: ${fn}`)
 if(map.guid==='1008da'){
  assert.equal(map.name,'Kestrel Lunar Base');assert.equal(bag.ContainedObjects.length,69)
  assert.equal(bag.ContainedObjects.filter(o=>o.Tags?.includes('building')).length,19)
  assert.ok(!controls.LuaScript.includes("label='MAP CONTROLS'"),'Approved R14 removes the board-side button')
  // Kestrel now uses the shared standard owner, verified above.
  assert.ok(bag.ContainedObjects.every(o=>o.Name!=='Chip'))
  assert.equal(bag.ContainedObjects.filter(o=>o.Nickname?.startsWith('Data-Harvester ')).length,0)
 }
}
assert.equal(missions.size, 20)
for (const [mission, keys] of missions) assert.equal(new Set(keys).size, mission === 'Crossing Lines' ? 2 : 1, `${mission} has its retained layouts`)
const grouped = loboWorkshopMapSections.flatMap(section => section.layouts.flatMap(layout => layout.saves.map(map => map.id)))
assert.equal(grouped.length, tableCount)
assert.equal(new Set(grouped).size, tableCount)
assert.equal(loboWorkshopMapSections.length, 20)
assert.deepEqual(loboWorkshopMapSections.map(section => section.title), [...missions.keys()].sort((a, b) => a.localeCompare(b)))
for (const section of loboWorkshopMapSections) {
  assert.equal(section.layouts.length, section.title === 'Crossing Lines' ? 2 : 1)
  for (const layout of section.layouts) assert.deepEqual(layout.saves[0].missionSetups, [section.title])
}
for (const map of loboWorkshopMaps) {
  if (map.previewKind === 'workshop') continue
  if (map.previewKind === 'diagram') {
    assert.ok(['port-meridian', 'saltwick-floodgate'].includes(map.slug))
    assert.equal(map.overhead, map.diagram)
    assert.equal(map.angled, map.diagram)
    continue
  }
  assert.ok(['tts', 'geometry'].includes(map.previewKind))
  assert.notEqual(map.overhead, map.angled)
  if (map.slug.endsWith('-satellite') && map.previewKind === 'tts') {
    assert.equal(map.captureDate, '2026-10-20')
    assert.notEqual(map.overhead, map.diagram)
    assert.notEqual(map.angled, map.diagram)
  }
}
assert.equal(loboWorkshopMaps.filter(map => map.previewKind === 'tts').length, 0)
assert.equal(loboWorkshopMaps.filter(map => map.previewKind === 'geometry').length, tableCount)
assert.equal(loboWorkshopMaps.filter(map => map.previewKind === 'workshop').length, 0)
assert.equal(loboWorkshopMaps.filter(map => map.previewKind === 'diagram').length, 0)
const portMeridian = loboWorkshopMapBySlug.get('port-meridian')
const meridianBlocks = loboWorkshopMapBySlug.get('last-launch-2')
assert.equal(portMeridian.name, 'Port Meridian')
assert.equal(meridianBlocks.name, 'Meridian Blocks')
assert.equal(meridianBlocks.isCurrent, false)
assert.notEqual(portMeridian.layoutKey, meridianBlocks.layoutKey)
assert.equal(resolveLoboWorkshopMapLabel(meridianBlocks.workshopBagName).slug, meridianBlocks.slug)
assert.equal(communityArchive.hiddenNames.length, 16)
const archivedSetups = communityArchive.maps.filter(map => map.portalHidden)
assert.equal(archivedSetups.length, 21)
for (const map of archivedSetups) {
  assert.ok(!loboWorkshopMaps.some(active => active.guid === map.guid))
  assert.equal(loboWorkshopMapBySlug.get(map.slug).portalHidden, true)
  assert.equal(describePublicSearchPage(`/maps/${map.slug}`), null)
}
for (const name of communityArchive.hiddenNames) {
  assert.ok(!loboWorkshopMaps.some(map => map.name === name))
}
const azure = archivedLoboWorkshopMaps.find(map => map.slug === 'akial-interference-2')
const legacyAzure = archivedLoboWorkshopMaps.find(map => map.name === 'Azure Circuit' && map.layoutKey === azure.layoutKey && map.slug !== azure.slug)
const ratings = buildMapRatings([{ id: 1, mapSlug: legacyAzure.slug, mapRating: 5 }, { id: 2, mapSlug: azure.slug, mapRating: 3 }])
assert.deepEqual(ratings.get(azure.layoutKey), { average: 4, count: 2, rank: 1 })
assert.ok(missions.has('Akial Interference') && missions.has('Evacuation'))
const palace = loboWorkshopMapBySlug.get('azure-palace')
assert.equal(palace.guid, '87b699')
assert.deepEqual(palace.missionSetups, ['Crossing Lines'])
assert.equal(palace.reviewStatus, 'approved')
assert.match(palace.installer, /Azure-Palace-Workshop-Installer-R9\.zip$/)
const saltwick = loboWorkshopMapBySlug.get('saltwick-floodgate')
assert.equal(saltwick.guid, '1002d9')
assert.deepEqual(saltwick.missionSetups, ['Area of Interest'])
assert.equal(saltwick.reviewStatus, 'approved')
assert.equal(saltwick.objectCount, 67)
assert.match(saltwick.installer, /Saltwick-Floodgate-Workshop-Installer-R4\.zip$/)
const cairnfall = loboWorkshopMapBySlug.get('battleground-1')
assert.equal(cairnfall.guid, '100326')
assert.deepEqual(cairnfall.missionSetups, ['Battleground'])
assert.equal(cairnfall.reviewStatus, 'approved')
assert.equal(cairnfall.objectCount, 87)
assert.match(cairnfall.installer, /Cairnfall-Sanctuary-Final-Workshop-Installer\.zip$/)
const vanta = loboWorkshopMapBySlug.get('vanta-customs-yard')
assert.equal(vanta.guid, '810053')
assert.deepEqual(vanta.missionSetups, ['B-Pong'])
assert.equal(vanta.objectCount, 53)
assert.match(vanta.installer, /Vanta-Customs-Yard-Workshop-Installer-R4\.zip$/)
assert.ok(existsSync('public' + vanta.installer))
assert.equal(dirname(current.installer), dirname(current.releaseInventory))
assert.ok(loboWorkshopMaps.some(map => map.installer === current.installer), 'The collection installer belongs to a current map')
assert.ok(existsSync('public' + cairnfall.installer))
assert.ok(existsSync('public' + saltwick.installer))
assert.ok(existsSync('public' + palace.installer))
assert.notEqual(palace.layoutKey, loboWorkshopMapBySlug.get('veyra-gate').layoutKey)
assert.ok(describePublicSearchPage('/maps').links.some(link => link.href === '/maps/azure-palace'))
const leviathan = loboWorkshopMapBySlug.get('leviathans-wake')
assert.equal(leviathan.guid, 'af0667')
assert.deepEqual(leviathan.missionSetups, ['Evacuation'])
assert.equal(leviathan.objectCount, 41)
assert.ok(existsSync('public' + leviathan.installer))
const leviathanBag = JSON.parse(readFileSync('public' + leviathan.download)).ObjectStates[0]
assert.ok(!leviathanBag.ContainedObjects.some(o => ['0424ea', 'a6739a', 'e6af7a'].includes(o.GUID)))
for (const guid of ['43cf48', '3e440a', '0e94af', 'c65672']) assert.ok(leviathanBag.ContainedObjects.some(o => o.GUID === guid))
assert.match(describePublicSearchPage('/maps/leviathans-wake').title, /Leviathan/)
assert.ok(describePublicSearchPage('/maps').links.some(link => link.href === '/maps/leviathans-wake'))
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

