import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const resolver = require('../backend/CanonicalArmyCodeResolver.gs')
const backend = read('backend/ArmyIntelligenceApi.gs')
const armyLists = read('backend/ArmyListApi.gs')
const worker = read('api/army-intelligence-refresh-worker.mjs')
const cli = read('scripts/refresh-army-intelligence.mjs')
const discovery = read('backend/CanonicalSourceDiscovery.gs')
const snapshotFactory = read('backend/CanonicalSnapshotFactory.gs')

const normalizeString = (value) => String(value || '').trim()
const normalizeNumber = (value) => Number(value) || 0
const getKey = (player, faction) => `${normalizeString(player).toLowerCase()}:${normalizeString(faction).toLowerCase()}`
const listsById = {
  12: { armyCode: ' list-id-code ', faction: 'ALEPH', player: 'Alice', playerDisplayName: 'Alice Prime' },
  13: { armyCode: 'fallback-code', faction: 'Nomads', player: 'Bob', playerDisplayName: 'Robert' },
}
const playerFactionLookup = resolver.buildPlayerFactionLookup(listsById, getKey)

const cases = [
  [{ directCode: ' direct ', armyListId: 12, player: 'Alice', faction: 'ALEPH' }, 'direct'],
  [{ directCode: '', armyListId: 12, player: 'Alice', faction: 'ALEPH' }, 'list-id-code'],
  [{ directCode: '', armyListId: 999, player: 'Robert', faction: 'Nomads' }, 'fallback-code'],
  [{ directCode: '', armyListId: '', player: 'Nobody', faction: 'Unknown' }, ''],
]

for (const [input, expected] of cases) {
  assert.equal(resolver.resolveWithFallback({
    ...input,
    getPlayerFactionKey: getKey,
    listsById,
    normalizeString,
    playerFactionLookup,
  }), expected)
}
pass('Army Code resolution identical')

const game = {
  id: 9,
  sourceIndex: 9,
  winnerArmyCode: ' code-with-_ separators ',
  winnerArmyListId: 42,
  loserArmyCode: '',
  loserArmyListId: '',
}
const winner = resolver.resolveSubmittedArmyList({ game, normalizeNumber, normalizeString, side: 'winner' })
assert.deepEqual(winner, { armyCode: 'code-with-_ separators', armyListId: 42, id: 42 })
const loser = resolver.resolveSubmittedArmyList({ game, normalizeNumber, normalizeString, side: 'loser' })
assert.deepEqual(loser, { armyCode: '', armyListId: 0, id: 900000020 })
assert.equal(
  resolver.buildArmyCodeId(' code-with-_ separators ', normalizeString),
  legacyArmyCodeId(' code-with-_ separators '),
)
pass('Army List ID resolution unchanged')
assert.equal(playerFactionLookup['alice prime:aleph'].armyCode, ' list-id-code ')
assert.equal(playerFactionLookup['robert:nomads'].armyCode, 'fallback-code')
pass('Player/faction fallback unchanged')

assert.match(backend, /CanonicalArmyCodeResolver\.resolveWithFallback\(\{/)
assert.doesNotMatch(backend, /function getArmyIntelligenceGameArmyCode|function getArmyIntelligencePlayerFactionArmyCode|function getArmyIntelligencePlayerFactionListLookup/)
assert.match(armyLists, /CanonicalArmyCodeResolver\.resolveSubmittedArmyList\(\{/)
assert.match(armyLists, /CanonicalArmyCodeResolver\.buildArmyCodeId\(/)
assert.match(armyLists, /CanonicalArmyCodeResolver\.buildGameSideId\(/)
assert.match(worker, /loadAuthoritativeSources[\s\S]*armyIntelligenceSources/)
assert.doesNotMatch(worker, /CanonicalArmyCodeResolver\.resolveGameSideCode\(/)
assert.match(cli, /CanonicalArmyCodeResolver\.resolveGameSideCode\(/)

const workerCode = resolver.resolveGameSideCode(game, 'winner', normalizeString)
assert.equal(workerCode, 'code-with-_ separators')
pass('Worker resolution unchanged')
assert.equal(resolver.resolveGameSideCode(game, 'loser', normalizeString), '')
pass('CLI resolution unchanged')
assert.equal(workerCode, normalizeString(game.winnerArmyCode))
pass('Decoder input unchanged')
assert.equal(workerCode, normalizeString(game.winnerArmyCode))
pass('Snapshot input unchanged')

assert.equal(
  functionHash(backend, 'mergeArmyIntelligenceSourceAndSnapshot'),
  '9ec6b947c0e82b9fb9d80e1a8c3bb2bc2a6b028991e02dcbc992146ea27acd33',
)
assert.equal(
  functionHash(backend, 'buildArmyIntelligenceSummary'),
  '6d3e2568e59f6482a60fe40198bac6297b0b7d778e58302fca399f1c34e0fbcf',
)
pass('Army Intelligence output unchanged')
assert.equal(
  createHash('sha256').update(discovery).digest('hex'),
  '5eb62663ba0828bef86648ea3858b8da3fed726361a8587a0335c9375500b31e',
)
assert.match(snapshotFactory, /createSourceRefreshSnapshot/)
pass('Source Discovery unchanged and Snapshot Factory owns source snapshots')
pass('CanonicalArmyCodeResolver is the sole public Army Code resolution owner')

function legacyArmyCodeId(value) {
  const identity = normalizeString(value).replace(/\s+/g, '').replace(/-/g, '').replace(/_/g, '')
  if (!identity) return 0
  let hash = 5381
  for (let index = 0; index < identity.length; index += 1) hash = (hash * 33) ^ identity.charCodeAt(index)
  return 800000000 + (hash >>> 0)
}
function read(path) { return readFileSync(path, 'utf8').replace(/\r\n/g, '\n') }
function pass(label) { console.log(`PASS - ${label}`) }
function functionHash(source, name) { return createHash('sha256').update(extractFunction(source, name)).digest('hex') }
function extractFunction(source, name) { const start = source.indexOf(`function ${name}`); const open = source.indexOf('{', start); let depth = 0; for (let index = open; index < source.length; index += 1) { if (source[index] === '{') depth += 1; if (source[index] === '}') depth -= 1; if (depth === 0) return source.slice(start, index + 1) } return '' }
