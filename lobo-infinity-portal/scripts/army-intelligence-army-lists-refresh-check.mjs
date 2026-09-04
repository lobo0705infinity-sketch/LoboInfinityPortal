import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const intelligenceSource = readFileSync('backend/ArmyIntelligenceApi.gs', 'utf8')
const armyListSource = readFileSync('backend/ArmyListApi.gs', 'utf8')
const selected = [
  extractFunction(intelligenceSource, 'refreshArmyIntelligence'),
  extractFunction(intelligenceSource, 'validateArmyIntelligenceRefreshSnapshot'),
  extractFunction(armyListSource, 'getArmyListObjects'),
  extractFunction(armyListSource, 'rebuildArmyListsReadModelPayload'),
  extractFunction(armyListSource, 'getCanonicalGameSubmittedArmyListObjects'),
  extractFunction(armyListSource, 'appendCanonicalGameSubmittedArmyList'),
  extractFunction(armyListSource, 'getPersistedCanonicalArmyListDecode'),
  extractFunction(armyListSource, 'buildCanonicalGameSubmittedArmyListDescription'),
  extractFunction(armyListSource, 'buildCanonicalGameSubmittedArmyListValidation'),
].join('\n')

const armyCode = 'new-canonical-code'
const armyListId = 'new-list-id'
const source = {
  armyCodeHash: hash(armyCode), armyListId, snapshotKey: 'league:81:winner',
  sourceId: '81', sourcePlayer: 'winner', sourceType: 'league',
}
const game = {
  date: '2026-09-03', eventId: 'league', gameType: 'League', id: 81,
  loser: 'Opponent', loserArmyCode: '', loserArmyListId: '', loserFaction: 'Ariadna',
  mission: 'Supplies', sourceIndex: 81, winner: 'Lobo', winnerArmyCode: armyCode,
  winnerArmyListId: armyListId, winnerFaction: 'ALEPH',
}
const persistedLookup = { byArmyCodeHash: {}, byArmyListId: {} }
let readModel = null
let intelligenceRebuilds = 0
let armyListRebuilds = 0
let persistedWrites = 0
let decoderCalls = 0

const sandbox = {
  Array, Boolean, Date, Error, JSON, Number, Object,
  getApiParameters: (event) => event,
  getApiParameter: (parameters, key) => parameters[key] || '',
  buildArmyIntelligenceSources: () => [source],
  findPersistedArmyIntelligenceSnapshot(current, lookup) {
    const persisted = lookup.byArmyListId[current.armyListId] || null
    return persisted && persisted.armyCodeHash === current.armyCodeHash ? persisted : null
  },
  getArmyIntelligenceString: (value) => String(value ?? '').trim(),
  getArmyIntelligenceHash: hash,
  buildPersistedArmyIntelligenceSnapshotRow: (_source, snapshot) => snapshot,
  upsertPersistedArmyIntelligenceSnapshotRows(rows) {
    if (rows.length === 0) return
    persistedWrites += 1
    rows.forEach((snapshot) => {
      const envelope = { ...snapshot, armyCodeHash: source.armyCodeHash, armyListId: source.armyListId }
      persistedLookup.byArmyListId[source.armyListId] = envelope
      persistedLookup.byArmyCodeHash[source.armyCodeHash] = envelope
    })
  },
  rebuildArmyIntelligenceReadModelPayloadAndPersist: () => { intelligenceRebuilds += 1 },
  rebuildArmyListsReadModelPayloadAndPersist() {
    armyListRebuilds += 1
    readModel = sandbox.rebuildArmyListsReadModelPayload()
    return readModel
  },
  invalidatePortalCacheGroup: () => {},
  jsonOutput: (value) => value,
  readArmyListsReadModelPayload: () => readModel,
  buildArmyListCommunitySummary: (lists) => ({ totalLists: lists.length }),
  getCanonicalArmyListRecentGames: () => [game],
  getPersistedArmyIntelligenceSnapshotLookup: () => persistedLookup,
  CanonicalArmyCodeResolver: {
    resolveSubmittedArmyList({ game: current, side }) {
      return {
        armyCode: side === 'winner' ? current.winnerArmyCode : current.loserArmyCode,
        armyListId: side === 'winner' ? current.winnerArmyListId : current.loserArmyListId,
        id: side === 'winner' ? current.winnerArmyListId : current.loserArmyListId,
      }
    },
  },
  getArmyListNumber: Number,
  getArmyListString: (value) => String(value ?? '').trim(),
  formatArmyListDate: (value) => String(value ?? ''),
  getPlayerDisplayName: (player) => player,
  canonicalizeArmyName: (value) => String(value ?? '').trim(),
  canonicalizeArmyParentFaction: (value) => String(value ?? '').trim(),
  CanonicalDecoderGateway: { decode() { decoderCalls += 1; throw new Error('legacy decoder reached') } },
  resolveArmyCodeProfiles() { decoderCalls += 1; throw new Error('profile resolver reached') },
  UrlFetchApp: { fetch() { decoderCalls += 1; throw new Error('UrlFetch reached') } },
}

vm.createContext(sandbox)
vm.runInContext(selected, sandbox)

readModel = sandbox.rebuildArmyListsReadModelPayload()
assert.equal(readModel.lists.length, 1)
assert.equal(readModel.lists[0].validation.status, 'pending')

const snapshot = {
  ...source,
  decoded: {
    armyCode, decoderVersion: 'army-intelligence-decoder-v5', faction: 'ALEPH',
    sectorial: 'OSS', listName: 'Decoded OSS',
    combatGroups: [{ entries: Array.from({ length: 10 }, () => ({})) }],
    totals: { combatGroups: 1, points: 300, swc: 6 }, warnings: [],
  },
  decoderVersion: 'army-intelligence-decoder-v5', status: 'decoded',
}

const response = sandbox.refreshArmyIntelligence({ snapshots: JSON.stringify([snapshot]) })
assert.equal(response.success, true)
assert.equal(persistedWrites, 1)
assert.equal(intelligenceRebuilds, 1)
assert.equal(armyListRebuilds, 1)
let list = sandbox.getArmyListObjects()[0]
assert.equal(list.id, armyListId)
assert.equal(list.validation.status, 'decoded')
assert.equal(list.validation.points, 300)
assert.equal(list.armyName, 'Decoded OSS')

sandbox.refreshArmyIntelligence({ snapshots: JSON.stringify([snapshot]) })
assert.equal(sandbox.getArmyListObjects().length, 1)
assert.equal(sandbox.getArmyListObjects()[0].id, armyListId)
assert.equal(decoderCalls, 0)

const stale = { ...snapshot, armyCodeHash: hash('old-code') }
assert.throws(
  () => sandbox.refreshArmyIntelligence({ snapshots: JSON.stringify([stale]) }),
  /identity mismatch: armyCodeHash/,
)
assert.equal(persistedWrites, 2, 'rejected callbacks must not persist')
assert.equal(armyListRebuilds, 2, 'rejected callbacks must not rebuild')
assert.equal(sandbox.getArmyListObjects()[0].validation.status, 'decoded')
assert.equal(decoderCalls, 0)

const failed = { ...snapshot, decoded: null, error: 'temporary decoder failure', status: 'failed' }
const failedResponse = sandbox.refreshArmyIntelligence({ snapshots: JSON.stringify([failed]) })
assert.equal(failedResponse.updated, 0, 'failed callback must not downgrade a valid persisted decode')
assert.equal(persistedWrites, 2)
assert.equal(sandbox.getArmyListObjects()[0].validation.status, 'decoded')
assert.equal(decoderCalls, 0)

const refresh = extractFunction(intelligenceSource, 'refreshArmyIntelligence')
assert.match(refresh, /upsertPersistedArmyIntelligenceSnapshotRows\(rows\);[\s\S]*rebuildArmyIntelligenceReadModelPayloadAndPersist\(\);[\s\S]*rebuildArmyListsReadModelPayloadAndPersist\(\);/)
assert.doesNotMatch(refresh, /getArmyListObjects|CanonicalDecoderGateway|resolveArmyCodeProfiles|UrlFetchApp/)

console.log('Army Intelligence callback to Army Lists Read Model regression passed.')
console.log('PASS - pending to decoded callback lifecycle made zero legacy decoder and UrlFetch calls')

function hash(value) { return `hash:${String(value ?? '').trim()}` }

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `missing function ${name}`)
  const open = text.indexOf('{', start)
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = open; index < text.length; index += 1) {
    const character = text[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; continue }
    if (character === '{') depth += 1
    if (character === '}' && --depth === 0) return text.slice(start, index + 1)
  }
  throw new Error(`unterminated function ${name}`)
}
