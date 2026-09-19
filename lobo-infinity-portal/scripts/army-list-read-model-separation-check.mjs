import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync('backend/ArmyListApi.gs', 'utf8')
const selected = [
  'getArmyListObjects',
  'rebuildArmyListsReadModelPayload',
  'getCanonicalGameSubmittedArmyListObjects',
  'appendCanonicalGameSubmittedArmyList',
  'getPersistedCanonicalArmyListDecode',
  'buildCanonicalGameSubmittedArmyListDescription',
  'buildCanonicalGameSubmittedArmyListValidation',
].map((name) => extractFunction(source, name)).join('\n')

let readModelPayload = {
  success: true,
  lists: [fixtureList('persisted', 'decoded')],
}
let canonicalReads = 0
let intelligenceReads = 0
let decoderCalls = 0
const games = [fixtureGame('new-code', 'new-id')]
const intelligence = { byArmyCodeHash: {}, byArmyListId: {} }

const sandbox = {
  Array,
  Boolean,
  CanonicalDecoderGateway: { decode() { decoderCalls += 1; throw new Error('legacy decoder reached') } },
  CanonicalArmyCodeResolver: {
    resolveSubmittedArmyList({ game, side }) {
      return {
        armyCode: side === 'winner' ? game.winnerArmyCode : game.loserArmyCode,
        armyListId: side === 'winner' ? game.winnerArmyListId : game.loserArmyListId,
        id: side === 'winner' ? game.winnerArmyListId : game.loserArmyListId,
      }
    },
  },
  readArmyListsReadModelPayload: () => readModelPayload,
  buildArmyListCommunitySummary: (lists) => ({ totalLists: lists.length }),
  getCanonicalArmyListRecentGames: () => { canonicalReads += 1; return games },
  getPersistedArmyIntelligenceSnapshotLookup: () => { intelligenceReads += 1; return intelligence },
  getArmyIntelligenceHash: hash,
  getArmyListNumber: Number,
  getArmyListString: (value) => String(value ?? '').trim(),
  formatArmyListDate: (value) => String(value ?? ''),
  getPlayerDisplayName: (player) => `Display ${player}`,
  canonicalizeArmyName: (value) => String(value ?? '').trim(),
  canonicalizeArmyParentFaction: (value) => String(value ?? '').trim(),
  resolveArmyCodeProfiles() { decoderCalls += 1; throw new Error('profile resolver reached') },
  UrlFetchApp: { fetch() { decoderCalls += 1; throw new Error('UrlFetch reached') } },
}

vm.createContext(sandbox)
vm.runInContext(selected, sandbox)
sandbox.rebuildArmyListsReadModelPayload =
  vm.runInContext('rebuildArmyListsReadModelPayload', sandbox)

assert.deepEqual(plain(sandbox.getArmyListObjects()), plain(readModelPayload.lists))
assert.equal(canonicalReads, 0, 'ordinary reads must not reconstruct canonical lists')
assert.equal(intelligenceReads, 0, 'ordinary reads must not load decoder enrichment')
assert.equal(decoderCalls, 0, 'ordinary reads must not decode')

readModelPayload = null
assert.deepEqual(plain(sandbox.getArmyListObjects()), [], 'missing read model must fail closed')
readModelPayload = { lists: 'corrupt' }
assert.deepEqual(plain(sandbox.getArmyListObjects()), [], 'invalid list shape must fail closed')
sandbox.readArmyListsReadModelPayload = () => { throw new SyntaxError('corrupt JSON') }
assert.deepEqual(plain(sandbox.getArmyListObjects()), [], 'corrupt read model must fail closed')
assert.equal(decoderCalls, 0, 'read-model failures must not trigger decoder fallback')

const rebuiltPending = sandbox.rebuildArmyListsReadModelPayload()
assert.equal(canonicalReads, 1, 'rebuild must read canonical submissions directly')
assert.equal(intelligenceReads, 1, 'rebuild must load persisted intelligence once')
assert.equal(rebuiltPending.lists.some((list) => list.id === 'new-id'), true)
assert.equal(rebuiltPending.lists.find((list) => list.id === 'new-id').validation.status, 'pending')
assert.equal(decoderCalls, 0, 'pending rebuild must not decode')

const matched = buildSnapshot('new-code', 'new-id')
intelligence.byArmyListId['new-id'] = matched
intelligence.byArmyCodeHash[hash('new-code')] = matched
const rebuiltDecoded = sandbox.rebuildArmyListsReadModelPayload()
const decoded = rebuiltDecoded.lists.find((list) => list.id === 'new-id')
assert.equal(decoded.validation.status, 'decoded')
assert.equal(decoded.validation.points, 300)

const stale = buildSnapshot('old-code', 'new-id')
intelligence.byArmyListId['new-id'] = stale
intelligence.byArmyCodeHash = { [hash('old-code')]: stale }
const rebuiltChanged = sandbox.rebuildArmyListsReadModelPayload()
assert.equal(rebuiltChanged.lists.find((list) => list.id === 'new-id').validation.status, 'pending')
assert.equal(decoderCalls, 0, 'stale enrichment must not trigger decoder fallback')

assert.doesNotMatch(extractFunction(source, 'getArmyListObjects'), /getCanonicalGameSubmittedArmyListObjects|CanonicalDecoderGateway|resolveArmyCodeProfiles|UrlFetchApp/)
assert.doesNotMatch(extractFunction(source, 'rebuildArmyListsReadModelPayload'), /getArmyListObjects\s*\(/)
assert.match(extractFunction(source, 'rebuildArmyListsReadModelPayload'), /getCanonicalGameSubmittedArmyListObjects\s*\(/)

console.log('Army Lists Read Model separation regression passed.')
console.log('PASS - ordinary reads and rebuilds made zero legacy decoder and UrlFetch calls')

function fixtureList(id, status) {
  return { id, approved: true, player: 'Lobo', validation: { status } }
}

function fixtureGame(code, id) {
  return {
    date: '2026-09-03', eventId: 'event', gameType: 'League', id: 81,
    loser: 'Opponent', loserArmyCode: '', loserArmyListId: '', loserFaction: 'Ariadna',
    mission: 'Supplies', sourceIndex: 81, winner: 'Lobo', winnerArmyCode: code,
    winnerArmyListId: id, winnerFaction: 'ALEPH',
  }
}

function buildSnapshot(armyCode, armyListId) {
  return {
    armyCodeHash: hash(armyCode), armyListId, status: 'decoded',
    decoded: {
      armyCode, combatGroups: [{ entries: Array.from({ length: 10 }, () => ({})) }],
      faction: 'ALEPH', listName: 'Persisted Army', sectorial: 'OSS',
      totals: { combatGroups: 1, points: 300, swc: 6 }, warnings: [],
    },
  }
}

function hash(value) { return `hash:${String(value ?? '').trim()}` }
function plain(value) { return JSON.parse(JSON.stringify(value)) }

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
