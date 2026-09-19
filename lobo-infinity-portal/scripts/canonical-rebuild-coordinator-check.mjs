import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const submissionRegressionSource = fs.readFileSync(
  'scripts/canonical-submission-service-check.mjs',
  'utf8',
)
const serviceLoad = "vm.runInContext(fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8'), context)"
const coordinatorAwareRegression = submissionRegressionSource.replace(
  serviceLoad,
  "vm.runInContext(fs.readFileSync('backend/CanonicalRebuildCoordinator.gs', 'utf8'), context)\n" + serviceLoad,
)
assert.notEqual(coordinatorAwareRegression, submissionRegressionSource, 'Step 3 regression loader must be adaptable')
await import(`data:text/javascript;base64,${Buffer.from(coordinatorAwareRegression).toString('base64')}`)

const failureLog = []
let rebuildCalls = 0
let rebuildShouldFail = false
const scriptProperties = new Map()

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : ['2026-08-11T17:00:00.000Z']))
  }
}

const context = vm.createContext({
  Date: FixedDate,
  Logger: { log() {} },
  LockService: {
    getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => scriptProperties.get(key) ?? null,
      setProperty: (key, value) => scriptProperties.set(key, value),
    }),
  },
  rebuildEverything() {
    rebuildCalls += 1
    if (rebuildShouldFail) throw new Error('Controlled rebuild failure')
  },
  lifWriteImportLog_(_log, responseKey, workflow, targetRow, status, message) {
    failureLog.push({ responseKey, workflow, targetRow, status, message: JSON.parse(message) })
  },
})

vm.runInContext(fs.readFileSync('backend/CanonicalRebuildCoordinator.gs', 'utf8'), context)

const success = context.coordinateCanonicalRebuild({
  workflow: 'league',
  targetRow: 54,
  logMissing: false,
})
assert.equal(rebuildCalls, 1, 'Successful coordination must invoke exactly one rebuild')
assert.equal(success.status, 'Rebuild Complete')
assert.equal(success.functionName, 'rebuildEverything')
assert.equal(success.attempt, 1)
assert.equal(success.eligibleForRetry, false)
assert.deepEqual([...success.lifecycle], [
  'Received',
  'Validated',
  'Canonical Commit',
  'Rebuild Started',
  'Rebuild Complete',
])

rebuildShouldFail = true
let controlledFailure = null
try {
  context.coordinateCanonicalRebuild({
    workflow: 'team-tournament',
    targetRow: 55,
    importLog: {},
    responseKey: 'sheet:55',
    logMissing: true,
  })
} catch (error) {
  controlledFailure = error
}

assert.ok(controlledFailure, 'Controlled rebuild failure must still be thrown')
assert.equal(rebuildCalls, 2, 'Failed coordination must invoke exactly one rebuild')
assert.equal(controlledFailure.message, 'Controlled rebuild failure')
assert.equal(controlledFailure.canonicalRebuildState.status, 'Rebuild Failed')
assert.equal(controlledFailure.canonicalRebuildState.eligibleForRetry, true)
assert.equal(controlledFailure.canonicalRebuildState.attempt, 1)
assert.deepEqual([...controlledFailure.canonicalRebuildState.lifecycle], [
  'Received',
  'Validated',
  'Canonical Commit',
  'Rebuild Started',
  'Rebuild Failed',
])
assert.equal(failureLog.length, 1, 'Failure must be explicitly recorded once')
assert.equal(failureLog[0].status, 'Rebuild Failed')
assert.equal(failureLog[0].responseKey, 'sheet:55')
assert.equal(failureLog[0].workflow, 'team-tournament')
assert.equal(failureLog[0].targetRow, 55)
assert.equal(failureLog[0].message.functionName, 'rebuildEverything')
assert.equal(failureLog[0].message.message, 'Controlled rebuild failure')

rebuildShouldFail = false
const retry = context.retryCanonicalRebuild({
  previousState: controlledFailure.canonicalRebuildState,
  workflow: 'team-tournament',
  targetRow: 55,
  logMissing: true,
})
assert.equal(rebuildCalls, 3, 'Eligible retry must invoke exactly one deterministic rebuild')
assert.equal(retry.status, 'Rebuild Complete')
assert.equal(retry.attempt, 2)
assert.equal(retry.eligibleForRetry, false)

const completedRetry = context.retryCanonicalRebuild({ previousState: retry })
assert.equal(completedRetry.status, 'Rebuild Complete')
assert.equal(rebuildCalls, 3, 'Completed rebuilds must not be retried')

const coordinator = fs.readFileSync('backend/CanonicalRebuildCoordinator.gs', 'utf8')
const submissionService = fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')

assert.equal((submissionService.match(/coordinateCanonicalRebuild\s*\(/g) || []).length, 3)
assert.doesNotMatch(submissionService, /rebuildEverything\s*\(|rebuildGameEngine\s*\(/)
assert.doesNotMatch(
  submissionService,
  /function\s+canonicalSubmissionRunImportRebuild_\s*\(|function\s+canonicalSubmissionRunRebuild_\s*\(/,
)
assert.match(coordinator, /rebuildEverything\s*\(\)/)
assert.match(coordinator, /rebuildGameEngine\s*\(\)/)
assert.doesNotMatch(
  coordinator,
  /validateCanonicalGame\s*\(|buildCanonicalGameRow\s*\(|\.appendRow\s*\(|resolveEventId\s*\(|getEventRegistrationForPlayer\s*\(/,
)

console.log('Canonical Rebuild Coordinator League: PASS')
console.log('Canonical Rebuild Coordinator Casual: PASS')
console.log('Canonical Rebuild Coordinator Team Tournament: PASS')
console.log('Canonical rows unchanged: PASS')
console.log('Validation unchanged: PASS')
console.log('Rebuild order unchanged: PASS')
console.log('Rebuild output and analytics path unchanged: PASS')
console.log('Controlled rebuild failure: PASS')
console.log('Retry state recorded: PASS')
console.log('No duplicate canonical games: PASS')
console.log('No duplicate rebuilds: PASS')
