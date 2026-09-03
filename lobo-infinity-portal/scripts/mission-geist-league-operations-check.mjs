import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const leagueOperations = read('backend/LeagueOperationsApi.gs')
const missionGeistCatalog = read('backend/MissionGeistCatalog.gs')
const exporter = read('backend/PublicSnapshotExporter.gs')
const panel = read('src/components/EventManagerPanel.tsx')
const snapshotClient = read('src/services/publicSnapshot.ts')
const apiTypes = read('src/services/api.ts')
const snapshotTypes = read('src/public/snapshotTypes.ts')

assert.match(leagueOperations, /"Mission 1 Mission Geist ID"/)
assert.match(leagueOperations, /"Mission 2 Mission Geist ID"/)
assert.match(leagueOperations, /mission1GeistId/)
assert.match(leagueOperations, /mission2GeistId/)
assert.doesNotMatch(leagueOperations, /UrlFetchApp/)
assert.match(panel, /getPublicMissionGeistCatalog/)
assert.match(panel, /sourceCollectionName.*—.*option\.name/s)
assert.match(panel, /missionGeistId: mission\.id/)
assert.doesNotMatch(panel, /infinitygeist\.com/)
assert.match(snapshotClient, /getPublicMissionGeistCatalog[\s\S]*getPublicSnapshotDataset<MissionGeistCatalog>\('mission-catalog'/)
assert.match(apiTypes, /missionGeistId\?: string/)
assert.match(snapshotTypes, /missionGeistCanonicalUrl\?: string/)

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  let depth = 0
  let began = false
  let end = start
  for (; end < source.length; end += 1) {
    if (source[end] === '{') { depth += 1; began = true }
    if (source[end] === '}') depth -= 1
    if (began && depth === 0) return source.slice(start, end + 1)
  }
  throw new Error(`could not extract ${name}`)
}

const matchingCatalog = {
  catalog: {
    missions: [{
      id: 's18_provisioning',
      name: 'Provisioning',
      canonicalUrl: 'https://infinitygeist.com/missions/s18_provisioning',
    }],
  },
}
const storageSandbox = {
  Error,
  PropertiesService: { getScriptProperties: () => ({}) },
  String,
  getCanonicalMissionName: (value) => String(value || '').trim(),
  readMissionGeistCachedCatalog_: () => matchingCatalog,
}
vm.createContext(storageSandbox)
vm.runInContext(extractFunction(missionGeistCatalog, 'validatePersistedMissionGeistSelection_'), storageSandbox)
vm.runInContext(extractFunction(leagueOperations, 'validateLeagueOperationsMissionGeistId_'), storageSandbox)
assert.equal(
  storageSandbox.validateLeagueOperationsMissionGeistId_('Provisioning', 's18_provisioning'),
  's18_provisioning',
)
assert.equal(storageSandbox.validateLeagueOperationsMissionGeistId_('Provisioning', ''), '')
assert.throws(
  () => storageSandbox.validateLeagueOperationsMissionGeistId_('Provisioning', 's17_provisioning'),
  /does not match/,
)

const snapshotSandbox = { String }
vm.createContext(snapshotSandbox)
vm.runInContext(extractFunction(exporter, 'buildPublicSnapshotLeagueMission_'), snapshotSandbox)
const identified = snapshotSandbox.buildPublicSnapshotLeagueMission_(
  'Provisioning',
  ['Map A', 'Map B'],
  's18_provisioning',
  matchingCatalog.catalog,
)
assert.deepEqual(JSON.parse(JSON.stringify(identified)), {
  mission: 'Provisioning',
  maps: ['Map A', 'Map B'],
  missionGeistId: 's18_provisioning',
  missionGeistCanonicalUrl: 'https://infinitygeist.com/missions/s18_provisioning',
})
assert.deepEqual(
  JSON.parse(JSON.stringify(snapshotSandbox.buildPublicSnapshotLeagueMission_('Provisioning', ['Map A', 'Map B'], '', matchingCatalog.catalog))),
  { mission: 'Provisioning', maps: ['Map A', 'Map B'] },
)

console.log('Mission Geist League Operations identity regression passed.')
