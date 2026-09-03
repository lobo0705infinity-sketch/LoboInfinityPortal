import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/MissionGeistCatalog.gs', 'utf8')
const exporter = fs.readFileSync('backend/PublicSnapshotExporter.gs', 'utf8')
const api = fs.readFileSync('backend/API.gs', 'utf8')
const snapshotClient = fs.readFileSync('src/services/publicSnapshot.ts', 'utf8')

assert.match(exporter, /missionCatalog = getMissionGeistCatalogForPublicSnapshot_\(\)/)
assert.match(exporter, /"mission-catalog": missionCatalog/)
assert.match(snapshotClient, /'mission-catalog'/)
assert.doesNotMatch(api, /MissionGeist|mission-geist|infinitygeist/i)
assert.doesNotMatch(snapshotClient, /infinitygeist\.com/i)

function extract(name) {
  const start = source.indexOf(`function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  let depth = 0; let began = false; let end = start
  for (; end < source.length; end += 1) {
    if (source[end] === '{') { depth += 1; began = true }
    if (source[end] === '}') depth -= 1
    if (began && depth === 0) { end += 1; break }
  }
  return source.slice(start, end)
}

const listing = {
  schemaVersion: '1.0.0', contentHash: 'sha256-example', generatedAt: '2026-09-02T00:00:00Z',
  source: { attribution: 'Courtesy of Mission Geist' },
  seasons: [{
    id: 'its-17', name: 'ITS Season 17', current: true,
    missions: [{
      id: 's17-annihilation', name: 'Annihilation', canonicalUrl: 'https://infinitygeist.com/mission/s17-annihilation',
      rights: { ip: 'Corvus Belli', official: true },
    }],
  }],
}

const sandbox = {
  Array, Date, Error, JSON, Math, Number, Object, String,
  MISSION_GEIST_CATALOG_SCHEMA_VERSION: 1,
  MISSION_GEIST_CACHE_TTL_MS: 6 * 60 * 60 * 1000,
  MISSION_GEIST_CACHE_MANIFEST_PROPERTY: 'MISSION_GEIST_CATALOG_CACHE_MANIFEST',
  MISSION_GEIST_CACHE_FOLDER_PROPERTY: 'MISSION_GEIST_CATALOG_CACHE_FOLDER_ID',
  MISSION_GEIST_CACHE_FOLDER_NAME: 'Lobo Mission Geist Catalog Cache',
}
vm.createContext(sandbox)
for (const name of [
  'copyMissionGeistRights_', 'validateMissionGeistCatalog_', 'buildMissionGeistCatalog_',
  'parseMissionGeistCatalogJson_', 'isMissionGeistCacheManifest_',
  'readMissionGeistCachedCatalog_', 'isMissionGeistCachedCatalogFresh_',
  'getMissionGeistCatalogForPublicSnapshot_',
]) vm.runInContext(extract(name), sandbox)

const catalog = sandbox.buildMissionGeistCatalog_(listing)
assert.deepEqual(JSON.parse(JSON.stringify(catalog)), {
  schemaVersion: '1.0.0', contentHash: 'sha256-example', generatedAt: '2026-09-02T00:00:00Z',
  attribution: 'Courtesy of Mission Geist',
  missions: [{
    id: 's17-annihilation', name: 'Annihilation', canonicalUrl: 'https://infinitygeist.com/mission/s17-annihilation',
    rights: { ip: 'Corvus Belli', official: true }, sourceCollectionId: 'its-17',
    sourceCollectionName: 'ITS Season 17', current: true,
  }],
})

let fetchCalls = 0
const properties = {
  values: {
    MISSION_GEIST_CATALOG_CACHE_MANIFEST: JSON.stringify({
      schemaVersion: 1, fileId: 'cached-file', contentHash: 'sha256-example', cachedAt: new Date().toISOString(),
    }),
  },
  getProperty(key) { return this.values[key] || '' },
  setProperty(key, value) { this.values[key] = value },
}
sandbox.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
sandbox.PropertiesService = { getScriptProperties: () => properties }
sandbox.DriveApp = { getFileById: () => ({ getBlob: () => ({ getDataAsString: () => JSON.stringify(catalog) }) }) }
sandbox.UrlFetchApp = { fetch() { fetchCalls += 1; throw new Error('fresh cache should not fetch') } }
assert.equal(sandbox.getMissionGeistCatalogForPublicSnapshot_().contentHash, 'sha256-example')
assert.equal(fetchCalls, 0)

console.log('Mission Geist catalog regression passed: snapshot-only cached catalog with no Portal runtime request.')
