import type { ArmyIntelligenceArmyList } from './api'

export function getCanonicalArmyListForIntelligenceSource(
  source: { armyCode: string; sourceId: string },
  canonicalArmyLists: ArmyIntelligenceArmyList[],
) {
  const canonicalSourceId = source.sourceId.trim()
  const sourceArmyCode = source.armyCode.trim()

  if (canonicalSourceId) {
    const idMatch = canonicalArmyLists.find((list) => String(list.id) === canonicalSourceId)

    if (idMatch) {
      return idMatch
    }
  }

  if (!sourceArmyCode) {
    return null
  }

  return canonicalArmyLists.find((list) => list.armyCode.trim() === sourceArmyCode) ?? null
}
