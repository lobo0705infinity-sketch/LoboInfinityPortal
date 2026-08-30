import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const properties = new Map()
let rebuildCalls = 0
let rebuildFailures = 0
let markDuringRebuild = false
let dirtyCalls = 0

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : ['2026-08-30T12:00:00.000Z']))
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
      getProperty: (key) => properties.get(key) ?? null,
      setProperty: (key, value) => properties.set(key, value),
    }),
  },
  rebuildEverything() {
    rebuildCalls += 1
    if (markDuringRebuild) {
      markDuringRebuild = false
      context.markCanonicalRebuildRequired_({ reason: 'second-game', targetRow: 76 })
    }
    if (rebuildFailures > 0) {
      rebuildFailures -= 1
      throw new Error('simulated rebuild failure')
    }
  },
  markCanonicalRebuildRecoveryProjectionsDirty_() {
    dirtyCalls += 1
  },
})

vm.runInContext(fs.readFileSync('backend/CanonicalRebuildCoordinator.gs', 'utf8'), context)

const first = context.markCanonicalRebuildRequired_({
  reason: 'canonical-game-append',
  targetRow: 74,
  workflow: 'league',
})
assert.equal(first.required, true)
assert.equal(first.targetRow, 74)

rebuildFailures = 1
assert.throws(
  () => context.coordinateCanonicalRebuild({ rebuildObligation: first, workflow: 'league' }),
  /simulated rebuild failure/,
)
let state = context.getCanonicalRebuildObligation_()
assert.equal(state.required, true, 'Failed immediate rebuild must remain durably required')
assert.equal(state.generation, first.generation)
assert.equal(state.lastFailureStage, 'rebuildEverything')
assert.match(state.lastFailureMessage, /simulated rebuild failure/)

rebuildFailures = 1
let recovery = context.recoverPendingCanonicalRebuildBestEffort_()
assert.equal(recovery.success, false)
assert.equal(context.getCanonicalRebuildObligation_().required, true, 'Failed automation retry must remain dirty')

recovery = context.recoverPendingCanonicalRebuildBestEffort_()
assert.equal(recovery.success, true)
assert.equal(recovery.cleared, true)
assert.equal(context.getCanonicalRebuildObligation_().required, false)
assert.equal(dirtyCalls, 1, 'Successful recovery must invalidate derived public projections once')

const gameA = context.markCanonicalRebuildRequired_({ targetRow: 75, reason: 'game-a' })
markDuringRebuild = true
context.coordinateCanonicalRebuild({ rebuildObligation: gameA, workflow: 'league' })
state = context.getCanonicalRebuildObligation_()
assert.equal(state.required, true, 'A newer game generation must not be cleared by an older rebuild')
assert.equal(state.generation, gameA.generation + 1)

recovery = context.recoverPendingCanonicalRebuildBestEffort_()
assert.equal(recovery.success, true)
assert.equal(context.getCanonicalRebuildObligation_().required, false)

const coordinator = fs.readFileSync('backend/CanonicalRebuildCoordinator.gs', 'utf8')
const submissions = fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
const automation = fs.readFileSync('backend/AutomationApi.gs', 'utf8')
const engine = fs.readFileSync('backend/rebuildGameEngine().gs', 'utf8')
const discovery = fs.readFileSync('backend/CanonicalSourceDiscovery.gs', 'utf8')

assert.match(submissions, /markCanonicalRebuildRequired_[\s\S]*\.appendRow\(row\)/)
assert.match(coordinator, /completeCanonicalRebuildObligation_\(state\.rebuildGeneration\)/)
assert.match(automation, /recoverPendingCanonicalRebuildBestEffort_\(\)/)
assert.match(engine, /validatePersistedGameEngineState_\(engine, analytics\)/)
assert.match(discovery, /winnerArmyListId/)
assert.match(discovery, /loserArmyListId/)

assert.ok(rebuildCalls >= 5, 'Immediate and automation rebuild paths must both execute deterministically')

console.log('Canonical append / rebuild failure durability: PASS')
console.log('Interrupted execution recovery: PASS')
console.log('Failed retry retains obligation: PASS')
console.log('Successful retry clears obligation: PASS')
console.log('Multiple pending games generation safety: PASS')
console.log('Two-sided Army List source discovery contract: PASS')
