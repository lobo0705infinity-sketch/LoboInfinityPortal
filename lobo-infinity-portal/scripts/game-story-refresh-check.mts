import assert from 'node:assert/strict'
import { clearPublicSnapshotMemoryCacheForTests, getNewerPublicSnapshotDataset, getPublicSnapshotDataset, PUBLIC_SNAPSHOT_POINTER_URL } from '../src/services/publicSnapshot.ts'
import { getGameIntelligenceLists, getStoryListReadiness } from '../src/services/gameIntelligenceLinks.ts'
import type { ArmyIntelligenceFactionData, RecentGame } from '../src/services/api.ts'

const first = '20260924T190000Z'
const second = '20260924T191000Z'
const pointer = (snapshotId: string) => ({ schemaVersion: 1, snapshotId, sourceCutoff: '2026-09-24', basePath: `public-snapshots/${snapshotId}/` })
const list = { armyListId: 'list-1', player: 'A', status: 'decoded', decoded: { combatGroups: [] } }
const newData = [{ lists: [list] }] as ArmyIntelligenceFactionData[]
const oldData = [{ lists: [] }] as ArmyIntelligenceFactionData[]
const originalFetch = globalThis.fetch
// Game 123's decoder uses the Army export label "Usariadna". It must bind
// to the canonical sectorial without accepting another Ariadna army.
const aliasGame = { winner: 'Defuser', loser: 'xtapro',
  winnerFaction: 'USAriadna Ranger Force', loserFaction: 'O-12',
  winnerArmyListId: '1180466479', loserArmyListId: '4388106048',
  winnerRosterFingerprint: '8'.repeat(64), loserRosterFingerprint: '5'.repeat(64) } as RecentGame
const aliasLists = [
  { ...list, player: 'Defuser', armyListId: '1180466479', sectorial: 'Usariadna', rosterFingerprint: '8'.repeat(64) },
  { ...list, player: 'xtapro', armyListId: '4388106048', sectorial: 'O 12', rosterFingerprint: '5'.repeat(64) },
] as ArmyIntelligenceFactionData['lists']
assert.equal(getStoryListReadiness(aliasGame, aliasLists), 'decoded')
assert.equal(getGameIntelligenceLists(aliasGame, aliasLists).length, 2)
assert.equal(getStoryListReadiness(aliasGame, [{ ...aliasLists[0], sectorial: 'Kosmoflot' }, aliasLists[1]]), 'pending')
let pointerReads = 0
let detailReads = 0
globalThis.fetch = async (input) => {
  const url = String(input)
  if (url === PUBLIC_SNAPSHOT_POINTER_URL) {
    return Response.json(pointer(pointerReads++ ? second : first))
  }
  if (url.endsWith('/army-intelligence-detail.json')) {
    detailReads++
    const snapshotId = url.includes(second) ? second : first
    return Response.json({ schemaVersion: 1, snapshotId, sourceCutoff: '2026-09-24', data: snapshotId === first ? oldData : newData })
  }
  throw new Error(`Unexpected snapshot URL: ${url}`)
}

try {
  clearPublicSnapshotMemoryCacheForTests()
  assert.deepEqual(await getPublicSnapshotDataset<ArmyIntelligenceFactionData[]>('army-intelligence-detail'), oldData)
  const newer = await getNewerPublicSnapshotDataset<ArmyIntelligenceFactionData[]>('army-intelligence-detail', '')
  assert.equal(newer?.snapshotId, second)
  const game = { winner: 'A', loser: 'B', winnerArmyListId: 'list-1', loserArmyListId: 'list-2' } as RecentGame
  assert.equal(getGameIntelligenceLists(game, newer?.data.flatMap((faction) => faction.lists) ?? []).length, 1)
  assert.equal(await getNewerPublicSnapshotDataset('army-intelligence-detail', second), null)
  assert.equal(detailReads, 2, 'same snapshot must not redownload the list payload')
  assert.deepEqual(await getPublicSnapshotDataset<ArmyIntelligenceFactionData[]>('army-intelligence-detail'), oldData,
    'other pages retain the internally consistent pinned generation until navigation reloads')
} finally {
  globalThis.fetch = originalFetch
  clearPublicSnapshotMemoryCacheForTests()
}
console.log('Battle story refresh waits for a newer, game-linked decoded list without mixing snapshot generations.')
