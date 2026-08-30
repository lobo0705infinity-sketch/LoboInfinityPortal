import assert from 'node:assert/strict'
import fs from 'node:fs'

const automation = fs.readFileSync('backend/AutomationApi.gs', 'utf8')
const api = fs.readFileSync('backend/API.gs', 'utf8')
const reliability = fs.readFileSync('backend/PublicProjectionReliability.gs', 'utf8')

const wrapper = automation.match(/function runPreparedProjectionRecoveryMaintenance\(\) \{[\s\S]*?\n\}/)?.[0] || ''
assert.ok(wrapper, 'Owner maintenance wrapper must be a top-level no-argument function.')
assert.match(wrapper, /markCanonicalRebuildRecoveryProjectionsDirty_\(\)/)
assert.match(wrapper, /processAutomationQueueBatch\(\)/)
assert.match(wrapper, /getPreparedProjectionReliabilityStatus_\(\)/)
assert.match(wrapper, /Logger\.log\(JSON\.stringify\(result\)\)/)
assert.doesNotMatch(wrapper, /requireApiPermission|requireArmyIntelligenceWorkerOrPermission|sessionToken|workerToken/)
assert.doesNotMatch(wrapper, /setProperty|deleteProperty|setContent|rebuildGameEngine|decode/)
assert.doesNotMatch(api, /case "runPreparedProjectionRecoveryMaintenance"/)
assert.match(reliability, /function requestPreparedProjectionRecovery\(e\) \{[\s\S]*?requireArmyIntelligenceWorkerOrPermission/)
assert.match(reliability, /acknowledgePublicProjection_[\s\S]*?newer-generation/)

console.log('Owner prepared-projection maintenance regression passed.')
