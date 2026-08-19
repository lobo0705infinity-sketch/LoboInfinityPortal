import type { ArmyIntelligenceArmyList } from './api'

export function getCanonicalArmyListBySourceId(
  sourceId: string,
  canonicalArmyLists: ArmyIntelligenceArmyList[],
) {
  const canonicalSourceId = sourceId.trim()

  if (!canonicalSourceId) {
    return null
  }

  return canonicalArmyLists.find((list) => String(list.id) === canonicalSourceId) ?? null
}
