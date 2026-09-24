import assert from 'node:assert/strict'
import { clearPublicSnapshotMemoryCacheForTests, getNewerPublicSnapshotDataset, getPublicSnapshotDataset, PUBLIC_SNAPSHOT_POINTER_URL } from '../src/services/publicSnapshot.ts'
import { getGameIntelligenceLists } from '../src/services/gameIntelligenceLinks.ts'
import type { ArmyIntelligenceFactionData, RecentGame } from '../src/services/api.ts'

const first = '20260924T190000Z'
const second = '20260924T191000Z'
const pointer = (snapshotId: string) => ({ schemaVersion: 1, snapshotId, sourceCutoff: '2026-09-24', basePath: `public-snapshots/${snapshotId}/` })
const list = { armyListId: 'list-1', player: 'A', status: 'decoded', decoded: { combatGroups: [] } }
const newData = [{ lists: [list] }] as ArmyIntelligenceFactionData[]
const oldData = [{ lists: [] }] as ArmyIntelligenceFactionData[]
const originalFetch = globalThis.fetch
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
