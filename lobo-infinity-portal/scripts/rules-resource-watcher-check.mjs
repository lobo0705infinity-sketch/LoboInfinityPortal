import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkRulesResources,
  diffMapCatalog,
  diffWorkshopItems,
  fetchWorkshopItems,
  parseMapCatalog,
  selectRecentBaselineMaps,
  slugifyMapName,
} from '../bot/rules-resource-watcher.mjs'

const mapsApiUrl = 'http://51.255.44.29/infinity/api/maps'
const mapsPageUrl = 'http://51.255.44.29/infinity/maps'
const nowMs = Date.parse('2026-09-22T12:00:00Z')
const oldMap = {
  id: 1,
  name: 'Abandonned Factory',
  created_at: '2026-09-18T08:35:14Z',
  json: { SaveName: 'SET_Abandonned_Factory', ObjectStates: [{ GUID: 'old' }] },
  images: ['http://51.255.44.29/infinity/api/tts-maps/1/pictures/factory.jpg'],
}
const oilRefinery = {
  id: 27,
  name: 'Oil Refinery',
  created_at: '2026-09-21T11:12:59Z',
  json: { SaveName: 'SET_Oil_Refinery', ObjectStates: [{ GUID: 'oil' }] },
  images: [
    'http://51.255.44.29/infinity/api/tts-maps/27/pictures/oil_refinery_02.jpg',
    'http://51.255.44.29/infinity/api/tts-maps/27/pictures/oil_refinery_01.jpg',
  ],
}

assert.equal(slugifyMapName('Oil Refinery'), 'oil-refinery')
assert.equal(slugifyMapName('L’Île Bleue'), 'l-ile-bleue')
const parsed = parseMapCatalog([oilRefinery, oldMap], { mapsApiUrl, mapsPageUrl })
assert.deepEqual(parsed.map((map) => map.id), ['1', '27'])
assert.equal(parsed[1].pageUrl, 'http://51.255.44.29/infinity/maps?map=oil-refinery')
assert.equal(parsed[1].jsonUrl, 'http://51.255.44.29/infinity/api/tts-maps/27/json')
assert.equal(parsed[1].images.length, 2)
assert.deepEqual(selectRecentBaselineMaps(parsed, { nowMs }).map((map) => map.id), ['27'])

const changedOilRefinery = parseMapCatalog([{ ...oilRefinery, name: 'Oil Refinery v2' }], { mapsApiUrl, mapsPageUrl })[0]
const diff = diffMapCatalog(parsed, [parsed[0], changedOilRefinery])
assert.equal(diff.added.length, 0)
assert.equal(diff.updated[0].id, '27')
assert.equal(diff.updated[0].previous.name, 'Oil Refinery')

const directory = await mkdtemp(join(tmpdir(), 'rules-resource-watcher-'))
const statePath = join(directory, 'state.json')
let mapsPayload = [oldMap, oilRefinery]
let changed = null
let workshopUpdatedAt = 1_790_034_517
const requestedUrls = []
const fetchImpl = async (url) => {
  requestedUrls.push(String(url))
  return String(url).includes('GetPublishedFileDetails')
    ? { ok: true, json: async () => ({ response: { publishedfiledetails: [{ result: 1, publishedfileid: '3719263238', title: "Lobo's Infinity Maps", time_updated: workshopUpdatedAt }] } }) }
    : { ok: true, json: async () => mapsPayload }
}
const silent = { info() {}, error() {} }
const checkOptions = {
  url: mapsApiUrl,
  mapsPageUrl,
  statePath,
  fetchImpl,
  logger: silent,
  now: () => nowMs,
  onChange: async (event) => { changed = event },
}
const baselineResult = await checkRulesResources(checkOptions)
assert.equal(baselineResult.status, 'BASELINED')
assert.deepEqual(changed.changes.added.map((map) => map.id), ['27'])
assert.equal(changed.changes.workshops[0].id, '3719263238')
assert.equal(requestedUrls[0], mapsApiUrl)
assert.equal((await checkRulesResources(checkOptions)).status, 'UNCHANGED')

mapsPayload = [...mapsPayload, {
  id: 28,
  name: 'Orbital Garden',
  created_at: '2026-09-22T11:00:00Z',
  json: { SaveName: 'SET_Orbital_Garden', ObjectStates: [{ GUID: 'new' }] },
  images: ['http://51.255.44.29/infinity/api/tts-maps/28/pictures/orbital_garden.jpg'],
}]
const mapResult = await checkRulesResources(checkOptions)
assert.equal(mapResult.status, 'CHANGED')
assert.deepEqual(changed.changes.added.map((map) => map.id), ['28'])
assert.equal(JSON.parse(await readFile(statePath, 'utf8')).maps.length, 3)
assert.equal(Object.hasOwn(JSON.parse(await readFile(statePath, 'utf8')).maps[0], 'json'), false)

workshopUpdatedAt += 1
const workshopResult = await checkRulesResources(checkOptions)
assert.equal(workshopResult.status, 'CHANGED')
assert.equal(changed.changes.workshops[0].id, '3719263238')
assert.equal((await fetchWorkshopItems(['3719263238'], fetchImpl))[0].title, "Lobo's Infinity Maps")
assert.equal(diffWorkshopItems(
  [{ id: '3719263238', title: "Lobo's Infinity Maps", updatedAt: 1 }],
  [{ id: '3719263238', title: "Lobo's Infinity Maps", updatedAt: 2 }],
).length, 1)

const legacyStatePath = join(directory, 'legacy-state.json')
await writeFile(legacyStatePath, JSON.stringify({
  bodySha256: 'LEGACY',
  links: [],
  workshops: [{ id: '3719263238', title: "Lobo's Infinity Maps", updatedAt: workshopUpdatedAt }],
}))
const migrated = await checkRulesResources({ ...checkOptions, statePath: legacyStatePath })
assert.equal(migrated.status, 'MIGRATED')
assert.deepEqual(migrated.changes.added.map((map) => map.id), ['27', '28'])
assert.equal(migrated.changes.workshops[0].id, '3719263238')

console.log('Rules resource watcher checks passed.')
