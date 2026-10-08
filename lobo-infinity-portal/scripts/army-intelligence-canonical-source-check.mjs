import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createHash } from 'node:crypto'

// An out-of-date generated table must not hide canonical Kosmoflot games or
// replace a missing Kosmoflot code with another Ariadna sectorial's roster.
const lists = {
  kosmo: { armyCode: 'kosmoflot-code', faction: 'Kosmoflot', player: 'Lobo' },
  tak: { armyCode: 'tak-code', faction: 'Tartary Army Corps', player: 'Lobo' },
}
const canonical = [
  { id: 80, gameType: 'casual', date: '2026-09-02', winner: 'Lobo', loser: 'Opponent',
    winnerFaction: 'Kosmoflot', loserFaction: 'O-12', winnerArmyListId: 'kosmo' },
  { id: 124, gameType: 'league', date: '2026-10-06', winner: 'Lobo', loser: 'Chainsaw',
    winnerFaction: 'Kosmoflot', loserFaction: 'Tartary Army Corps', winnerArmyCode: 'new-kosmoflot-code' },
]
let generatedReads = 0
const context = vm.createContext({
  getArmyIntelligenceSourceListLookup: () => lists,
  getAllRecentGameObjectsFromCanonicalResponses: () => canonical,
  buildRecentGameResponse: (game) => ({ ...game, winnerDisplayName: game.winner, loserDisplayName: game.loser }),
  getAllRecentGameObjects: () => {
    generatedReads += 1
    return [{ ...canonical[0], winnerFaction: 'Oban', winnerArmyCode: 'oban-code' }]
  },
  formatArmyIntelligenceGameType: (value) => value === 'casual' ? 'Casual' : 'League',
  getArmyIntelligenceHash: (value) => createHash('sha256').update(value).digest('hex'),
})
for (const file of ['ArmyRegistry.gs', 'CanonicalArmyCodeResolver.gs', 'CanonicalSourceDiscovery.gs', 'ArmyIntelligenceApi.gs']) {
  vm.runInContext(fs.readFileSync(`backend/${file}`, 'utf8'), context, { filename: file })
}
context.getArmyIntelligenceHash = (value) => createHash('sha256').update(value).digest('hex')

const sources = context.buildArmyIntelligenceSources()
assert.equal(generatedReads, 0)
assert.equal(sources.length, 2)
assert.deepEqual(Array.from(sources, (source) => source.sourceId), ['80', '124'])
assert.deepEqual(Array.from(sources, (source) => source.sourceType), ['casual', 'league'])
assert.deepEqual(Array.from(sources, (source) => source.armyCode), ['kosmoflot-code', 'new-kosmoflot-code'])
assert.ok(sources.every((source) => source.sectorial === 'Kosmoflot'))

const projectedLists = sources.map((source) => ({ ...source, status: 'decoded', decoded: { faction: 'Ariadna', sectorial: 'Kosmoflot', combatGroups: [] } }))
const summary = context.buildArmyIntelligencePublicSummaryProjection({ lists: projectedLists, summary: { decodedLists: 2 } })
assert.ok(summary.options.includes('Kosmoflot'), 'Decoded canonical Kosmoflot sources must appear in the dropdown')
const detail = context.buildArmyIntelligencePublicFactionProjection({ lists: projectedLists, armyLists: [] }, 'Kosmoflot')
assert.equal(detail.lists.length, 2)

delete lists.kosmo
canonical[1].winnerArmyCode = ''
assert.equal(context.buildArmyIntelligenceSources().length, 0, 'Missing Kosmoflot codes must not fall back to the same player’s TAK roster')
assert.notEqual(context.getArmyIntelligencePlayerFactionKey('Lobo', 'Kosmoflot'), context.getArmyIntelligencePlayerFactionKey('Lobo', 'Tartary Army Corps'))
console.log('Canonical Army Intelligence source discovery and exact-sectorial fallback: PASS')
