import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const discovery = require('../backend/CanonicalSourceDiscovery.gs')
const backend = readFileSync('backend/ArmyIntelligenceApi.gs', 'utf8')
const worker = readFileSync('api/army-intelligence-refresh-worker.mjs', 'utf8')
const cli = readFileSync('scripts/refresh-army-intelligence.mjs', 'utf8')

const games = [
  {
    date: '2026-08-01', eventId: 'event-1', gameResult: 'Win', gameType: 'league', id: 7,
    loser: 'Bob', loserArmyCode: ' loser-code ', loserFaction: 'Nomads',
    mission: 'Supplies', winner: 'Alice', winnerArmyCode: ' winner-code ', winnerFaction: 'ALEPH',
  },
  {
    date: '2026-08-01', eventId: 'event-1', gameResult: 'Win', gameType: 'league', id: 7,
    loser: 'Bob', loserArmyCode: ' loser-code ', loserFaction: 'Nomads',
    mission: 'Supplies', winner: 'Alice', winnerArmyCode: ' winner-code ', winnerFaction: 'ALEPH',
  },
]
const tournamentResults = [{
  eventId: 'event-1', eventName: 'Tournament One', result: {
    createdAt: '2026-08-02', mission: 'Unmasking', opponent: 'Dave', player: 'Carol',
    player1ArmyCode: 'carol-code', player2ArmyCode: 'dave-code', resultId: 'result-1',
    winner: 'Carol', winningFaction: 'Yu Jing',
  },
}]

const workerOptions = options(true)
const workerActual = discovery.discover(workerOptions)
const workerExpected = legacyNodeDiscovery(workerOptions)
assert.deepEqual(workerActual, workerExpected)
pass('Source discovery identical')
assert.deepEqual(workerActual.map(identity), workerExpected.map(identity))
pass('Source ordering unchanged')
assert.deepEqual(workerActual.map((source) => source.armyCodeHash), workerExpected.map((source) => source.armyCodeHash))
pass('Source hashes unchanged')
assert.deepEqual(workerActual.map((source) => source.snapshotKey), workerExpected.map((source) => source.snapshotKey))
pass('Snapshot keys unchanged')

assert.match(worker, /loadAuthoritativeSources[\s\S]*armyIntelligenceSources/)
assert.doesNotMatch(worker, /CanonicalSourceDiscovery\.discover\(nodeDiscoveryOptions/)
assert.doesNotMatch(worker, /function pushParticipantSource|function uniqueSources|function uniqueGames/)
pass('Worker consumes backend-authoritative discovery')

const cliOptions = options(false)
const cliActual = discovery.discover(cliOptions)
const cliExpected = legacyNodeDiscovery(cliOptions)
assert.match(cli, /loadLiveSources[\s\S]*armyIntelligenceSources/)
assert.match(cli, /fixtureSources[\s\S]*CanonicalSourceDiscovery\.discover\(discoveryOptions\)/)
assert.doesNotMatch(cli, /function pushParticipantSource|function uniqueSources/)
assert.deepEqual(cliActual, cliExpected)
pass('CLI discovery unchanged')

assert.match(backend, /CanonicalSourceDiscovery\.discover\(\{/)
assert.doesNotMatch(backend, /function appendArmyIntelligenceParticipantSource|function appendArmyIntelligenceRecentGameSources/)
assert.equal(
  functionHash(backend, 'mergeArmyIntelligenceSourceAndSnapshot'),
  '9ec6b947c0e82b9fb9d80e1a8c3bb2bc2a6b028991e02dcbc992146ea27acd33',
)
assert.equal(
  functionHash(backend, 'buildArmyIntelligenceSummary'),
  '6d3e2568e59f6482a60fe40198bac6297b0b7d778e58302fca399f1c34e0fbcf',
)
pass('Army Intelligence output unchanged')
pass('CanonicalSourceDiscovery is the sole public source discovery owner')

function options(deduplicateGames) {
  const eventNames = new Map([['event-1', 'Event One']])
  return {
    deduplicateGames,
    formatGameType,
    games,
    hashArmyCode: sha256,
    includeArmyListId: false,
    normalizeAll: false,
    normalizeKey: slugKey,
    normalizeString: (value) => String(value || '').trim(),
    resolveArmyCode: (game, side) => side === 'winner' ? game.winnerArmyCode : game.loserArmyCode,
    resolveEventName: (game) => game.eventName || eventNames.get(game.eventId) || game.eventId || '',
    sources: [],
    tournamentResult,
    tournamentResults,
  }
}

function legacyNodeDiscovery(config) {
  const sources = []
  const sourceGames = config.deduplicateGames ? uniqueGames(config.games) : config.games
  for (const game of sourceGames) {
    for (const side of ['winner', 'loser']) {
      const winner = side === 'winner'
      push(sources, {
        armyCode: winner ? game.winnerArmyCode : game.loserArmyCode,
        date: game.date,
        event: config.resolveEventName(game),
        faction: winner ? game.winnerFaction : game.loserFaction,
        gameType: formatGameType(game.gameType),
        mission: game.mission,
        opponent: winner ? game.loserDisplayName || game.loser : game.winnerDisplayName || game.winner,
        player: winner ? game.winnerDisplayName || game.winner : game.loserDisplayName || game.loser,
        result: String(game.gameResult || '').toLowerCase() === 'draw' ? 'Draw' : winner ? 'Win' : 'Loss',
        sectorial: winner ? game.winnerFaction : game.loserFaction,
        sourceId: game.id, sourcePlayer: side,
        sourceType: game.gameType === 'casual' ? 'casual' : 'league',
      })
    }
  }
  for (const item of config.tournamentResults) {
    for (const side of ['player1', 'player2']) {
      const first = side === 'player1'
      const result = item.result
      const player = first ? result.player : result.opponent
      push(sources, {
        armyCode: first ? result.player1ArmyCode : result.player2ArmyCode,
        date: result.createdAt || result.updatedAt,
        event: item.eventName || item.eventId,
        faction: first ? result.winningFaction : '', gameType: 'Tournament', mission: result.mission,
        opponent: first ? result.opponent : result.player, player,
        result: tournamentResult(result, player), sectorial: first ? result.winningFaction : '',
        sourceId: result.resultId, sourcePlayer: side, sourceType: 'tournament',
      })
    }
  }
  const seen = new Set()
  return sources.filter((source) => !seen.has(source.snapshotKey) && seen.add(source.snapshotKey))
}

function push(sources, source) {
  const armyCode = String(source.armyCode || '').trim()
  if (!armyCode) return
  const armyCodeHash = sha256(armyCode)
  const player = String(source.player || '').trim()
  const sourceType = String(source.sourceType || '').trim()
  const sourceId = String(source.sourceId || '').trim()
  const sourcePlayer = String(source.sourcePlayer || '').trim()
  sources.push({ ...source, armyCode, armyCodeHash, player,
    snapshotKey: [sourceType, sourceId, sourcePlayer, slugKey(player), armyCodeHash].join(':'),
    sourceId, sourcePlayer, sourceType })
}

function uniqueGames(values) {
  const seen = new Set()
  return values.filter((game) => {
    const key = `${game.id}:${game.gameType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function identity(source) { return `${source.sourceType}:${source.sourceId}:${source.sourcePlayer}:${source.player}` }
function sha256(value) { return createHash('sha256').update(String(value)).digest('hex') }
function slugKey(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') }
function formatGameType(value) { const normalized = String(value || '').trim().toLowerCase(); return normalized === 'casual' ? 'Casual' : normalized === 'tournament' ? 'Tournament' : 'League' }
function tournamentResult(result, player) { const winner = String(result.winner || '').trim(); return !winner ? '' : winner.toLowerCase() === 'draw' ? 'Draw' : slugKey(winner) === slugKey(player) ? 'Win' : 'Loss' }
function pass(label) { console.log(`PASS - ${label}`) }
function functionHash(source, name) { return createHash('sha256').update(extractFunction(source, name)).digest('hex') }
function extractFunction(source, name) { const start = source.indexOf(`function ${name}`); const open = source.indexOf('{', start); let depth = 0; for (let index = open; index < source.length; index += 1) { if (source[index] === '{') depth += 1; if (source[index] === '}') depth -= 1; if (depth === 0) return source.slice(start, index + 1).replace(/\r\n/g, '\n') } return '' }
