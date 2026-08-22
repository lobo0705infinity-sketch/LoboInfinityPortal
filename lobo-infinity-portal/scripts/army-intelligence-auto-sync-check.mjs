import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectRefreshCandidates } from '../api/army-intelligence-refresh-worker.mjs'

const worker = readFileSync('api/army-intelligence-refresh-worker.mjs', 'utf8')
const api = readFileSync('backend/API.gs', 'utf8')
const intelligence = readFileSync('backend/ArmyIntelligenceApi.gs', 'utf8')
const scheduler = readFileSync('backend/ArmyIntelligenceScheduler.gs', 'utf8')
const submission = readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))

const sources = [
  { snapshotKey: 'known', armyCodeHash: 'known-hash' },
  { snapshotKey: 'new', armyCodeHash: 'new-hash' },
  { snapshotKey: 'failed', armyCodeHash: 'failed-hash' },
]
const state = new Map([
  ['known', {
    armyCodeHash: 'known-hash',
    decoderVersion: 'army-intelligence-decoder-v4',
    hasProfileMetadata: true,
    status: 'decoded',
  }],
  ['failed', {
    armyCodeHash: 'failed-hash',
    decoderVersion: 'army-intelligence-decoder-v4',
    hasProfileMetadata: false,
    status: 'failed',
  }],
])

assert.deepEqual(
  selectRefreshCandidates(sources, state).map((source) => source.snapshotKey),
  ['new', 'failed'],
  'Automatic synchronization must reuse current snapshots and retry only missing/failed snapshots.',
)
assert.match(worker, /isScheduledRequest\(request\)/)
assert.match(worker, /ARMY_INTELLIGENCE_WORKER_TOKEN/)
assert.match(worker, /selectRefreshCandidates\(sources, state\)/)
assert.match(worker, /postSnapshots\(apiUrl, snapshots, upstreamCredential\)/)
assert.match(api, /case "armyIntelligenceSources"[\s\S]*requireArmyIntelligenceWorkerOrPermission/)
assert.match(api, /case "refreshArmyIntelligence"[\s\S]*requireArmyIntelligenceWorkerOrPermission/)
assert.match(intelligence, /requireArmyIntelligenceWorkerOrPermission[\s\S]*requireApiPermission\(e, "manageCache", handler\)/)
assert.match(intelligence, /refreshArmyIntelligence[\s\S]*upsertPersistedArmyIntelligenceSnapshotRows\(rows\)[\s\S]*rebuildArmyIntelligenceReadModelPayloadAndPersist/)
assert.doesNotMatch(
  submission,
  /army-intelligence-refresh-worker|UrlFetchApp/,
  'Canonical game submission must remain independent from external decoding availability.',
)
assert.equal(vercel.crons, undefined, 'Vercel Hobby deployment must not require cron support.')
assert.match(scheduler, /runScheduledArmyIntelligenceRefresh/)
assert.match(scheduler, /UrlFetchApp\.fetch\([\s\S]*ARMY_INTELLIGENCE_SCHEDULER_URL/)
assert.match(scheduler, /Authorization: "Bearer " \+ token/)
assert.match(scheduler, /everyMinutes\(5\)/)
assert.match(scheduler, /getProjectTriggers\(\)[\s\S]*deleteTrigger/)
assert.match(scheduler, /LockService\.getScriptLock\(\)[\s\S]*tryLock/)
assert.doesNotMatch(scheduler, /decodeArmyList|armyCode|buildArmyIntelligence|rebuildGameEngine/i)

console.log('Army Intelligence automatic synchronization checks passed.')
