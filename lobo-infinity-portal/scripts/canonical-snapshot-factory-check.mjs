import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const factory = require('../backend/CanonicalSnapshotFactory.gs')
const root = process.cwd()
const factorySource = read('backend/CanonicalSnapshotFactory.gs')
const armyListSource = read('backend/ArmyListApi.gs')
const intelligenceSource = read('backend/ArmyIntelligenceApi.gs')
const workerSource = read('api/army-intelligence-refresh-worker.mjs')
const cliSource = read('scripts/refresh-army-intelligence.mjs')

const OriginalDate = globalThis.Date
globalThis.Date = class extends OriginalDate {
  constructor(...args) {
    super(...(args.length ? args : ['2026-08-12T12:34:56.789Z']))
  }
}

try {
  const decoded = {
    decoderVersion: 'army-intelligence-decoder-v4',
    points: 300,
    profiles: [{ combatGroup: 1, name: 'Fusilier' }],
    sharedDecode: {
      armyName: 'Test List',
      combatGroups: 1,
      faction: 'PanOceania',
      raw: 'army-code',
      sectorial: 'Military Orders',
    },
    success: true,
    swc: 6,
    unitCount: 10,
  }

  const deterministic = factory.createDeterministicSnapshot({ id: 42 }, decoded)
  assert.deepEqual(deterministic, {
    decoderVersion: 'army-intelligence-decoder-v4',
    id: 'army-list-42',
    timestamp: '2026-08-12T12:34:56.789Z',
    generated: true,
    source: 'Army Lists sheet',
    units: decoded.profiles,
    unitCount: 10,
    points: 300,
    swc: 6,
  })
  pass('Deterministic snapshot identical')

  const legacy = factory.createLegacySnapshot(
    { snapshotKey: 'league:42:winner' },
    decoded,
    (unit) => ({ ...unit, normalized: true }),
    String,
  )
  assert.deepEqual(legacy, {
    decoded: {
      armyCode: 'army-code',
      combatGroups: [{
        combatGroup: 1,
        entries: [{ combatGroup: 1, name: 'Fusilier', normalized: true }],
      }],
      decoderVersion: 'army-intelligence-decoder-v4',
      faction: 'PanOceania',
      listName: 'Test List',
      orderCounts: {
        impetuous: 0,
        irregular: 0,
        lieutenant: 0,
        regular: 10,
        tacticalAwareness: 0,
      },
      sectorial: 'Military Orders',
      totals: { combatGroups: 1, points: 300, swc: 6 },
      units: [{ combatGroup: 1, name: 'Fusilier', normalized: true }],
    },
    decodedAt: '2026-08-12T12:34:56.789Z',
    error: '',
    snapshotKey: 'league:42:winner',
    status: 'decoded',
  })
  assert.equal(
    factory.createLegacySnapshot({}, { success: false }, () => ({}), String),
    null,
  )
  assert.deepEqual(
    factory.createLegacyStorageSnapshot(
      { armyCodeHash: 'hash', snapshotKey: 'failed:key' },
      null,
    ),
    {
      armyCodeHash: 'hash',
      decodedAt: '',
      decodedJson: '',
      error: 'Army Code could not be decoded.',
      snapshotKey: 'failed:key',
      status: 'failed',
    },
  )
  pass('Legacy snapshot identical')

  const successfulRefresh = factory.createRefreshSnapshot('worker:key', decoded, '', 'decoded')
  const failedRefresh = factory.createRefreshSnapshot('worker:failed', null, 'decode failed', 'failed')
  assert.deepEqual(successfulRefresh, {
    decoded,
    decodedAt: '2026-08-12T12:34:56.789Z',
    error: '',
    snapshotKey: 'worker:key',
    status: 'decoded',
  })
  assert.deepEqual(failedRefresh, {
    decoded: null,
    decodedAt: '2026-08-12T12:34:56.789Z',
    error: 'decode failed',
    snapshotKey: 'worker:failed',
    status: 'failed',
  })
  assertDelegates(workerSource)
  pass('Worker snapshot identical')
  assertDelegates(cliSource)
  pass('CLI snapshot identical')

  assert.deepEqual(Object.keys(deterministic), [
    'decoderVersion', 'id', 'timestamp', 'generated', 'source',
    'units', 'unitCount', 'points', 'swc',
  ])
  assert.deepEqual(Object.keys(successfulRefresh), [
    'decoded', 'decodedAt', 'error', 'snapshotKey', 'status',
  ])
  pass('Snapshot schema unchanged')
  assert.equal(deterministic.decoderVersion, decoded.decoderVersion)
  assert.equal(legacy.decoded.decoderVersion, decoded.decoderVersion)
  pass('Snapshot version unchanged')

  assert.equal(
    functionHash(armyListSource, 'buildArmyDiagnosticDecode'),
    '8f505a4195dd323bebd87f5499d213c3f90059afba77a6480f877a9c1d55c04e',
  )
  assert.equal(
    functionHash(intelligenceSource, 'buildDeterministicArmyIntelligenceDecodedEntry'),
    'dc4b740eefab23226dbcac5455d388562672a3d6e68722746ba996551875cb58',
  )
  pass('Decoder output unchanged')

  assert.equal(
    functionHash(intelligenceSource, 'mergeArmyIntelligenceSourceAndSnapshot'),
    '9ec6b947c0e82b9fb9d80e1a8c3bb2bc2a6b028991e02dcbc992146ea27acd33',
  )
  assert.equal(
    functionHash(armyListSource, 'buildArmyIntelligenceRow'),
    'a34cf4ddbc637dced0c76c9e2644c866a0d8825bca9dabe791e983b0b9f0dd4c',
  )
  pass('Army Intelligence output unchanged')

  assert.ok(factorySource.includes('var CanonicalSnapshotFactory'))
  assert.ok(!armyListSource.includes('function buildArmyDiagnosticSnapshot('))
  assert.ok(!intelligenceSource.includes('function buildLegacyArmyIntelligenceSnapshot('))
  assert.ok(!workerSource.includes('snapshots.push({'))
  assert.ok(!cliSource.includes('snapshots.push({'))
  pass('CanonicalSnapshotFactory is the sole public snapshot construction owner')
} finally {
  globalThis.Date = OriginalDate
}

function assertDelegates(source) {
  assert.ok(source.includes("require('../backend/CanonicalSnapshotFactory.gs')"))
  assert.equal(
    source.match(/CanonicalSnapshotFactory\.createRefreshSnapshot\(/g)?.length,
    2,
  )
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')
}

function functionHash(source, name) {
  return createHash('sha256').update(extractFunction(source, name)).digest('hex')
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)
  const braceStart = source.indexOf('{', start)
  let depth = 0
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  return ''
}

function pass(label) {
  console.log(`PASS - ${label}`)
}
