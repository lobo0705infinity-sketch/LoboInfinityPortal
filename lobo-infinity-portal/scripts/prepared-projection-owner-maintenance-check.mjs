import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const automation = fs.readFileSync('backend/AutomationApi.gs', 'utf8')
const api = fs.readFileSync('backend/API.gs', 'utf8')
const reliability = fs.readFileSync('backend/PublicProjectionReliability.gs', 'utf8')

const wrapper = automation.match(/function runPreparedProjectionRecoveryMaintenance\(\) \{[\s\S]*?\n\}/)?.[0] || ''
assert.ok(wrapper, 'Owner maintenance wrapper must be a top-level no-argument function.')
assert.match(wrapper, /markPublicProjectionRecoveryBatch_\(/)
assert.match(wrapper, /getPreparedProjectionReliabilityStatus_\(\)/)
assert.match(wrapper, /Logger\.log\(JSON\.stringify\(result\)\)/)
assert.doesNotMatch(wrapper, /requireApiPermission|requireArmyIntelligenceWorkerOrPermission|sessionToken|workerToken/)
assert.doesNotMatch(wrapper, /processAutomationQueueBatch|recoverPendingCanonicalRebuild|coordinateCanonicalRebuild|setProperty|deleteProperty|setContent|rebuildGameEngine|decode/)
assert.doesNotMatch(api, /case "runPreparedProjectionRecoveryMaintenance"/)
assert.match(reliability, /function requestPreparedProjectionRecovery\(e\) \{[\s\S]*?requireArmyIntelligenceWorkerOrPermission/)
assert.match(reliability, /acknowledgePublicProjection_[\s\S]*?newer-generation/)
assert.match(reliability, /function markPublicProjectionRecoveryBatch_\(targets\)/)
assert.match(reliability, /tryLock\(1000\)/)
assert.match(reliability, /setProperties\(updates, false\)/)

let markedTargets = null
let logged = ''
let canonicalCalls = 0
const context = {
  EVENT_ENGINE_DEFAULT_EVENT_ID: 'event-current-league',
  PUBLIC_ANALYTICS_DIRTY_EVENTS_PROPERTY: 'analytics',
  PUBLIC_PLAYERS_PROJECTION_DIRTY_PROPERTY: 'players',
  PUBLIC_LEAGUE_WORKSPACE_PROJECTION_DIRTY_PROPERTY: 'league',
  markPublicProjectionRecoveryBatch_(targets) {
    markedTargets = targets
    return { analytics: {}, players: {}, league: {} }
  },
  getPreparedProjectionReliabilityStatus_: () => ({ analytics: {}, players: {}, league: {} }),
  processAutomationQueueBatch() { canonicalCalls += 1 },
  rebuildGameEngine() { canonicalCalls += 1 },
  coordinateCanonicalRebuild() { canonicalCalls += 1 },
  Logger: { log(value) { logged = value } },
  JSON,
  Object,
}
vm.createContext(context)
vm.runInContext(wrapper, context)
const result = context.runPreparedProjectionRecoveryMaintenance()
assert.equal(canonicalCalls, 0)
assert.equal(JSON.stringify(markedTargets.map((target) => target.propertyName)), JSON.stringify(['analytics', 'players', 'league']))
assert.equal(result.publicationsAttempted, 0)
assert.equal(result.publicationsPending, 3)
assert.match(logged, /"recoveryRequested":true/)

console.log('Owner prepared-projection maintenance regression passed.')
