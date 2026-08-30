import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/ArmyIntelligenceScheduler.gs', 'utf8')
let held = false
let lockAttempts = 0
const events = []
let responseCode = 200

const context = {
  Date,
  JSON,
  Number,
  String,
  Logger: { log() {} },
  LockService: {
    getScriptLock: () => ({
      tryLock() {
        lockAttempts += 1
        if (held) return false
        held = true
        events.push('lock')
        return true
      },
      releaseLock() {
        held = false
        events.push('release')
      },
    }),
  },
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: () => 'worker-token' }),
  },
  UrlFetchApp: {
    fetch(url) {
      assert.equal(held, false, `Script Lock must be released before remote dispatch: ${url}`)
      events.push(`fetch:${url}`)
      return {
        getResponseCode: () => responseCode,
        getContentText: () => JSON.stringify({ decoded: 0, failed: 0, remaining: 0, success: responseCode === 200, updated: 0 }),
      }
    },
  },
}
vm.createContext(context)
vm.runInContext(source, context)

const first = context.runScheduledArmyIntelligenceRefresh()
assert.equal(first.success, true)
assert.equal(events[0], 'lock')
assert.equal(events[1], 'release')
assert.match(events[2], /army-intelligence-refresh-worker/)
assert.match(events[3], /automation-queue-worker/)
assert.equal(held, false)

// A later scheduler invocation can coordinate normally; durable workers remain idempotent.
context.runScheduledArmyIntelligenceRefresh()
assert.equal(lockAttempts, 2)
assert.equal(held, false)

// HTTP failures happen after release and cannot leak the scheduler lock.
responseCode = 502
assert.throws(() => context.runScheduledArmyIntelligenceRefresh(), /Scheduled maintenance worker failed/)
assert.equal(held, false)

// A thrown remote call is converted to failure only after the lock was released.
context.UrlFetchApp.fetch = () => {
  assert.equal(held, false)
  throw new Error('remote unavailable')
}
assert.throws(() => context.runScheduledArmyIntelligenceRefresh(), /Scheduled maintenance worker failed/)
assert.equal(held, false)

assert.doesNotMatch(source, /try\s*\{[\s\S]*runScheduledMaintenanceWorker_[\s\S]*finally\s*\{\s*lock\.releaseLock/)
console.log('Scheduler lock-boundary regression passed.')
