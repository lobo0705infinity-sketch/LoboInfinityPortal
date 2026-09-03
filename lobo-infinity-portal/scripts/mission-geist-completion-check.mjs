import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const read = (path) => fs.readFileSync(path, 'utf8')
const catalog = read('backend/MissionGeistCatalog.gs')
const bracket = read('backend/DoubleEliminationBracketApi.gs')
const rounds = read('backend/TeamTournamentApi.gs')
const engine = read('backend/EventEngineApi.gs')
const exporter = read('backend/PublicSnapshotExporter.gs')
const manager = read('src/components/EventManagerPanel.tsx')
const tournament = read('src/pages/TeamTournament.tsx')
const publicApp = read('src/public/SnapshotPublicApp.tsx')

function extract(source, name) {
  const start = source.indexOf(`function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  let depth = 0; let began = false
  for (let end = start; end < source.length; end += 1) {
    if (source[end] === '{') { depth += 1; began = true }
    if (source[end] === '}') depth -= 1
    if (began && depth === 0) return source.slice(start, end + 1)
  }
  throw new Error(`unterminated ${name}`)
}

const sandbox = {
  Error, String,
  PropertiesService: { getScriptProperties: () => ({}) },
  getCanonicalMissionName: (value) => String(value || '').trim().toLowerCase(),
  readMissionGeistCachedCatalog_: () => ({ catalog: { missions: [{ id: 's18_test', name: 'The Dig', canonicalUrl: 'https://infinitygeist.com/missions/s18_test' }] } }),
}
vm.createContext(sandbox)
vm.runInContext(extract(catalog, 'validatePersistedMissionGeistSelection_'), sandbox)
assert.equal(sandbox.validatePersistedMissionGeistSelection_('The Dig', 's18_test'), 's18_test')
assert.throws(() => sandbox.validatePersistedMissionGeistSelection_('Double Bind', 's18_test'), /does not match/)
assert.throws(() => sandbox.validatePersistedMissionGeistSelection_('The Dig', 'unknown'), /does not match/)

assert.match(bracket, /"Mission Geist ID"/)
assert.match(engine, /"Mission Geist ID"/)
assert.match(rounds, /validatePersistedMissionGeistSelection_\(mission, params\.missionGeistId\)/)
assert.doesNotMatch(bracket + rounds, /UrlFetchApp|infinitygeist\.com/)
assert.match(manager, /getPublicMissionGeistCatalog/)
assert.match(manager, /missionGeistId: missionDrafts\[round\.key\]/)
assert.match(tournament, /getPublicMissionGeistCatalog/)
assert.match(tournament, /missionGeistId/)
assert.match(exporter, /enrichPublicSnapshotMissionGeistEventState_/)
assert.match(exporter, /missionGeistCanonicalUrl/)
const projectionSandbox = { String, Number, Object, getCanonicalMissionName: sandbox.getCanonicalMissionName }
vm.createContext(projectionSandbox)
vm.runInContext(extract(exporter, 'enrichPublicSnapshotMissionGeistEventState_'), projectionSandbox)
const eventState = {
  top40: { bracketMissions: [{ bracket: 'Winners', bracketRound: 1, mission: 'The Dig', missionGeistId: 's18_test' }], bracket: [{ bracket: 'Winners', bracketRound: 1 }] },
  team: { rounds: [{ mission: 'The Dig', missionGeistId: 's18_test' }] },
  legacy: { rounds: [{ mission: 'The Dig' }] },
}
projectionSandbox.enrichPublicSnapshotMissionGeistEventState_(eventState, sandbox.readMissionGeistCachedCatalog_().catalog)
assert.equal(eventState.top40.bracketMissions[0].missionGeistCanonicalUrl, 'https://infinitygeist.com/missions/s18_test')
assert.equal(eventState.top40.bracket[0].missionGeistCanonicalUrl, 'https://infinitygeist.com/missions/s18_test')
assert.equal(eventState.team.rounds[0].missionGeistCanonicalUrl, 'https://infinitygeist.com/missions/s18_test')
assert.equal('missionGeistCanonicalUrl' in eventState.legacy.rounds[0], false)
assert.throws(() => projectionSandbox.enrichPublicSnapshotMissionGeistEventState_({ bad: { rounds: [{ mission: 'Double Bind', missionGeistId: 's18_test' }] } }, sandbox.readMissionGeistCachedCatalog_().catalog), /does not match/)
assert.match(publicApp, /View Mission/)
assert.match(publicApp, /Courtesy of Mission Geist/)
assert.match(publicApp, /missionGeistCanonicalUrl/)
assert.doesNotMatch(publicApp, /getPublicMissionGeistCatalog|mission-catalog/)
assert.match(publicApp, /!\['missionGeistId','missionGeistCanonicalUrl'\]\.includes\(k\)/)
console.log('PASS: Mission Geist completion identity, projection, and explicit-link boundary')
