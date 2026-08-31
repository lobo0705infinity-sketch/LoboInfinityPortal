import {
  normalizeArmyIntelligenceFactionProjection,
  normalizeArmyIntelligenceSummaryProjection,
  type ArmyIntelligenceFactionData,
  type ArmyIntelligenceSummaryData,
  type SubmittedArmyListEntry,
} from './api'
import { getPublicSnapshotDataset } from './publicSnapshot'

type SnapshotArmyList = Omit<SubmittedArmyListEntry, 'armyCode' | 'gameType' | 'result'> & {
  armyLink?: string
  armyName?: string
  gameType: string
  result: string
}

export const publicArmyWorkspace = {
  getArmyLists: async (signal?: AbortSignal): Promise<SubmittedArmyListEntry[]> => {
    const lists = await getPublicSnapshotDataset<SnapshotArmyList[]>('army-lists', signal)
    return lists.map((list) => ({
      ...list,
      armyCode: '',
      armyLink: list.armyLink ?? '',
      armyName: list.armyName ?? '',
      gameType: normalizeGameType(list.gameType),
      result: normalizeResult(list.result),
    }))
  },
  getIntelligenceSummary: async (signal?: AbortSignal): Promise<ArmyIntelligenceSummaryData> => {
    const summary = await getPublicSnapshotDataset<unknown[]>('army-intelligence-summary', signal)
    return normalizeArmyIntelligenceSummaryProjection(summary[0])
  },
  getIntelligenceFaction: async (
    faction: string,
    signal?: AbortSignal,
  ): Promise<ArmyIntelligenceFactionData> => {
    const details = await getPublicSnapshotDataset<Array<{ faction: string }>>(
      'army-intelligence-detail', signal,
    )
    const detail = details.find((item) => item.faction === faction)
    if (!detail) throw new Error('Army Intelligence detail is unavailable for this faction.')
    return normalizeArmyIntelligenceFactionProjection(detail)
  },
}

function normalizeGameType(value: string): SubmittedArmyListEntry['gameType'] {
  if (/casual/i.test(value)) return 'Casual'
  if (/tournament/i.test(value)) return 'Tournament'
  return 'League'
}

function normalizeResult(value: string): SubmittedArmyListEntry['result'] {
  if (value === 'Loss' || value === 'Draw') return value
  return 'Win'
}
