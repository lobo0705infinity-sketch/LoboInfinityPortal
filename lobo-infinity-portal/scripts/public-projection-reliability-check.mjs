import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const values = new Map()
const properties = {
  getProperty: (key) => values.get(key) ?? null,
  setProperty: (key, value) => values.set(key, String(value)),
  setProperties: (entries) => Object.entries(entries).forEach(([key, value]) => values.set(key, String(value))),
  deleteProperty: (key) => values.delete(key),
}
let lockAvailable = true
let lockAttempts = 0
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  Object,
  String,
  PropertiesService: { getScriptProperties: () => properties },
  LockService: { getScriptLock: () => ({
    waitLock() {},
    tryLock() { lockAttempts += 1; return lockAvailable },
    releaseLock() {},
  }) },
}
vm.createContext(context)
vm.runInContext(fs.readFileSync('backend/PublicProjectionReliability.gs', 'utf8'), context)

// Owner recovery establishes multiple projection families under one short lock.
context.markPublicProjectionRecoveryBatch_([
  { propertyName: 'PLAYERS', keys: ['players'] },
  { propertyName: 'ANALYTICS', keys: ['league'] },
  { propertyName: 'LEAGUE', keys: ['dashboard'] },
])
assert.equal(lockAttempts, 1)
assert.equal(context.countPendingPublicProjectionObligations_('PLAYERS'), 1)
assert.equal(context.countPendingPublicProjectionObligations_('ANALYTICS'), 1)
assert.equal(context.countPendingPublicProjectionObligations_('LEAGUE'), 1)

// A busy lock fails once and cannot partially mark a batch.
lockAvailable = false
assert.throws(() => context.markPublicProjectionRecoveryBatch_([
  { propertyName: 'BUSY_A', keys: ['a'] },
  { propertyName: 'BUSY_B', keys: ['b'] },
]), /lock is busy/)
assert.equal(values.has('BUSY_A'), false)
assert.equal(values.has('BUSY_B'), false)
lockAvailable = true

const key = 'TEST_PROJECTION_DIRTY'
context.markPublicProjectionRequired_(key, ['players'])
const first = context.getNextPublicProjectionObligation_(key)
assert.equal(first.key, 'players')
context.beginPublicProjectionAttempt_(key, first)

// A publisher/build/write failure never acknowledges the obligation.
context.failPublicProjectionAttempt_(key, first, 'artifact-write', new Error('simulated'))
assert.equal(context.getNextPublicProjectionObligation_(key).requiredGeneration, first.requiredGeneration)

// Last-known-good remains untouched when the write itself throws.
let content = JSON.stringify({ publicationGeneration: 1, value: 'last-known-good' })
const failingFile = { setContent() { throw new Error('write failed') }, getBlob() { return { getDataAsString: () => content } } }
assert.throws(() => context.writeAndValidatePublicProjectionArtifact_(failingFile, { value: 'new' }, first.requiredGeneration))
assert.match(content, /last-known-good/)

// Read-back validation failure cannot satisfy an obligation.
const invalidFile = { setContent() {}, getBlob() { return { getDataAsString: () => '{"publicationGeneration":0}' } } }
assert.throws(() => context.writeAndValidatePublicProjectionArtifact_(invalidFile, {}, first.requiredGeneration), /read-back/)
assert.equal(context.getNextPublicProjectionObligation_(key).dirty, true)

// A newer generation marked while G publishes survives G acknowledgement.
const validFile = {
  setContent(value) { content = value },
  getBlob() { return { getDataAsString: () => content } },
}
const artifactG = context.writeAndValidatePublicProjectionArtifact_(validFile, { value: 'G' }, first.requiredGeneration)
context.markPublicProjectionRequired_(key, ['players'])
const newer = context.getNextPublicProjectionObligation_(key)
assert.ok(newer.requiredGeneration > first.requiredGeneration)
assert.equal(context.acknowledgePublicProjection_(key, first, artifactG).reason, 'newer-generation')
assert.equal(context.getNextPublicProjectionObligation_(key).requiredGeneration, newer.requiredGeneration)

// Only a persisted, read-back-valid artifact at G+1 clears G+1.
const artifactNew = context.writeAndValidatePublicProjectionArtifact_(validFile, { value: 'G+1' }, newer.requiredGeneration)
assert.equal(context.acknowledgePublicProjection_(key, newer, artifactNew).acknowledged, true)
assert.equal(context.getNextPublicProjectionObligation_(key), null)

// Multiple obligations are independent; unprocessed work remains dirty.
context.markPublicProjectionRequired_(key, ['analytics', 'army', 'league', 'players'])
const analytics = context.getNextPublicProjectionObligation_(key)
const completed = context.writeAndValidatePublicProjectionArtifact_(validFile, {}, analytics.requiredGeneration)
context.acknowledgePublicProjection_(key, analytics, completed)
assert.equal(context.countPendingPublicProjectionObligations_(key), 3)

// An interrupted publisher is simply a dirty state with no acknowledgement.
const interrupted = context.getNextPublicProjectionObligation_(key)
context.beginPublicProjectionAttempt_(key, interrupted)
assert.equal(context.getNextPublicProjectionObligation_(key).key, interrupted.key)

const source = fs.readFileSync('backend/PublicProjectionReliability.gs', 'utf8')
assert.match(source, /withPublicProjectionStateLock_/)
assert.match(source, /lastFailureStage/)
assert.match(source, /lastSuccessGeneration/)
assert.match(source, /newer-generation/)
console.log('Prepared projection reliability regression passed.')
