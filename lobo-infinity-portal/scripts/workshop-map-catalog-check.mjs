import assert from 'node:assert/strict'
import { serialize } from 'bson'
import {
  cleanWorkshopMapName,
  extractWorkshopMapCatalog,
  fetchWorkshopMapCatalog,
} from '../bot/workshop-map-catalog.mjs'

const workshop = {
  id: '3719263238',
  title: "Lobo's Infinity Maps",
  updatedAt: 1_790_034_517,
  contentId: 'content-1',
  fileSize: 0,
  fileUrl: 'https://cdn.steamusercontent.com/workshop-fixture',
  previewUrl: 'https://images.steamusercontent.com/workshop-preview.jpg',
  url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238',
}
const mapBag = {
  Name: 'Bag',
  GUID: 'abc123',
  Nickname: 'SET_LL Map 15 The Dig/Provisioning',
  Description: 'League table',
  GMNotes: '',
  Tags: [],
  ContainedObjects: [{ Name: 'BlockSquare', GUID: '000001', Transform: { posX: 1, posY: 2, posZ: 3 } }],
}
const explicitIdMapBag = {
  Name: 'Bag',
  GUID: 'def456',
  Nickname: 'SET_ Renamed Table',
  Description: 'lobo-map-id: permanent-table',
  GMNotes: '',
  Tags: [],
  ContainedObjects: [{ Name: 'Custom_Model', GUID: '000002' }],
}
const save = {
  SaveName: "Lobo's Infinity Maps",
  ObjectStates: [
    { Name: 'Notecard', GUID: 'note01', Nickname: 'Normal Maps' },
    mapBag,
    explicitIdMapBag,
  ],
}
const raw = serialize(save)

assert.equal(cleanWorkshopMapName(' SET_  Map   Name '), 'Map Name')
const catalog = extractWorkshopMapCatalog(raw, workshop)
assert.equal(catalog.saveName, "Lobo's Infinity Maps")
assert.equal(catalog.mapCount, 2)
assert.equal(catalog.maps[0].id, '3719263238:abc123')
assert.equal(catalog.maps[0].name, 'LL Map 15 The Dig/Provisioning')
assert.equal(catalog.maps[0].objectCount, 1)
assert.equal(catalog.maps[0].source, 'lobo-workshop')
assert.equal(catalog.maps[1].id, '3719263238:permanent-table')

const changedRaw = serialize({
  ...save,
  ObjectStates: [save.ObjectStates[0], { ...mapBag, ContainedObjects: [{ ...mapBag.ContainedObjects[0], Transform: { posX: 9, posY: 2, posZ: 3 } }] }, explicitIdMapBag],
})
const changedCatalog = extractWorkshopMapCatalog(changedRaw, workshop)
assert.notEqual(changedCatalog.maps[0].contentSignature, catalog.maps[0].contentSignature)

const fetched = await fetchWorkshopMapCatalog({ ...workshop, fileSize: raw.length }, async (url) => {
  assert.equal(url, workshop.fileUrl)
  return {
    ok: true,
    headers: { get: (name) => name === 'content-length' ? String(raw.length) : null },
    arrayBuffer: async () => raw,
  }
})
assert.equal(fetched.mapCount, 2)

await assert.rejects(
  fetchWorkshopMapCatalog({ ...workshop, fileSize: raw.length + 1 }, async () => ({
    ok: true,
    headers: { get: () => String(raw.length) },
    arrayBuffer: async () => raw,
  })),
  /did not match Steam metadata/,
)

console.log('Workshop map catalog checks passed.')
