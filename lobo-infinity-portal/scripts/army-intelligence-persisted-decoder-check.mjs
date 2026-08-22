#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const intelligence = read('backend/ArmyIntelligenceApi.gs')
const armyLists = read('backend/ArmyListApi.gs')
const router = read('backend/API.gs')
const worker = read('api/army-intelligence-refresh-worker.mjs')
const client = read('src/services/api.ts')

assert.match(
  router,
  /case "armyIntelligenceSources"[\s\S]*requireArmyIntelligenceWorkerOrPermission/,
  'Authoritative Army Intelligence sources must be Commissioner-protected.',
)
assert.match(
  router,
  /case "refreshArmyIntelligence"[\s\S]*requireArmyIntelligenceWorkerOrPermission/,
  'Snapshot ingestion must be Commissioner-protected.',
)
assert.match(worker, /loadAuthoritativeSources[\s\S]*armyIntelligenceSources/)
assert.match(worker, /createSourceRefreshSnapshot/)
assert.match(worker, /Object\.entries\(credential\)[\s\S]*body\.set\(key, value\)/)
assert.doesNotMatch(worker, /authToken|Sign in with Google/)
assert.match(client, /sessionToken: getActiveNativeSessionToken\(\)/)

assert.doesNotMatch(
  extractFunction(intelligence, 'buildArmyIntelligenceListsFromCanonicalSources'),
  /CanonicalDecoderGateway|UrlFetchApp/,
)
assert.doesNotMatch(
  extractFunction(armyLists, 'buildArmyIntelligenceForGameEngineRows'),
  /CanonicalDecoderGateway|UrlFetchApp/,
)
assert.doesNotMatch(
  extractFunction(intelligence, 'getDeterministicArmyIntelligenceLists'),
  /buildCurrentDeterministicArmyIntelligenceRows|buildApprovedArmyListIntelligenceRows|CanonicalDecoderGateway/,
)
assert.match(
  extractFunction(armyLists, 'buildArmyIntelligenceForGameEngineRows'),
  /Persisted Army Intelligence snapshot is missing/,
  'A missing snapshot must be reported without external-decode fallback.',
)

const context = {
  Utilities: {
    Charset: { UTF_8: 'UTF_8' },
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest(_algorithm, value) {
      return Array.from(createHash('sha256').update(String(value)).digest())
        .map((byte) => (byte > 127 ? byte - 256 : byte))
    },
  },
}
vm.createContext(context)
vm.runInContext(intelligence, context)

const armyCode = 'authoritative-army-code'
const hash = createHash('sha256').update(armyCode).digest('hex')
const source = {
  armyCodeHash: hash,
  armyListId: '47',
  snapshotKey: `league:73:winner:lobo:${hash}`,
  sourceId: '73',
  sourcePlayer: 'winner',
  sourceType: 'league',
}
const snapshot = {
  ...source,
  decoded: { armyCode, decoderVersion: 'army-intelligence-decoder-v4' },
  decoderVersion: 'army-intelligence-decoder-v4',
  status: 'decoded',
}

assert.doesNotThrow(() => context.validateArmyIntelligenceRefreshSnapshot(source, snapshot))
assert.throws(
  () => context.validateArmyIntelligenceRefreshSnapshot(source, { ...snapshot, armyListId: '48' }),
  /identity mismatch: armyListId/,
)
assert.throws(
  () => context.validateArmyIntelligenceRefreshSnapshot(source, {
    ...snapshot,
    decoded: { ...snapshot.decoded, armyCode: 'different-code' },
  }),
  /Army Code mismatch/,
)

console.log('PASS: persisted Vercel Army Intelligence decoder boundary')

function read(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)
  assert.notEqual(start, -1, `Missing function ${name}.`)
  const brace = source.indexOf('{', start)
  let depth = 0
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  throw new Error(`Unterminated function ${name}.`)
}
