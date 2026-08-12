import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const factorySource = fs.readFileSync('backend/CanonicalSnapshotFactory.gs', 'utf8')
const context = vm.createContext({ module: { exports: {} } })
vm.runInContext(factorySource, context)

const factory = context.module.exports
const source = {
  armyCodeHash: 'hash',
  snapshotKey: 'source:1',
}
const failure = {
  decoderVersion: 'army-decoder-v1',
  parserFailure: {
    exception: 'Unexpected EOF at byte 2.',
    location: 'decodeArmyCode',
    reason: 'unexpected EOF',
  },
  parserTrace: [{ label: 'sectorialId', offset: 0 }],
  sharedDecode: {
    exceptions: ['Unexpected EOF at byte 2.'],
    parserWarnings: ['Decoder exception: Unexpected EOF at byte 2.'],
    valid: false,
  },
  success: false,
  warnings: ['Decoder exception: Unexpected EOF at byte 2.'],
}

const failedSnapshot = factory.createLegacyStorageSnapshot(source, null, failure)
assert.equal(failedSnapshot.status, 'failed')
assert.equal(failedSnapshot.decodedJson, '')
assert.deepEqual(JSON.parse(failedSnapshot.error), failure)
assert.deepEqual(Object.keys(failedSnapshot).sort(), [
  'armyCodeHash',
  'decodedAt',
  'decodedJson',
  'error',
  'snapshotKey',
  'status',
])

const successfulSnapshot = {
  decoded: { sectorial: 'O-12' },
  decodedAt: '2026-08-12T00:00:00.000Z',
  error: '',
  snapshotKey: source.snapshotKey,
  status: 'decoded',
}
assert.deepEqual(
  JSON.parse(JSON.stringify(factory.createLegacyStorageSnapshot(source, successfulSnapshot, failure))),
  {
    armyCodeHash: source.armyCodeHash,
    decodedAt: successfulSnapshot.decodedAt,
    decodedJson: JSON.stringify(successfulSnapshot.decoded),
    error: '',
    snapshotKey: source.snapshotKey,
    status: 'decoded',
  },
)

console.log('PASS - Successful decode snapshot unchanged')
console.log('PASS - Failed decode status unchanged')
console.log('PASS - Failed decode payload unchanged')
console.log('PASS - Decoder failure diagnostics preserved')
console.log('PASS - Snapshot schema unchanged')
