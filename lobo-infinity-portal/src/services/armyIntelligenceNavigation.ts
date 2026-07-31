import { normalizeArmyForDisplay } from '../config/armies'

export const armyIntelligencePath = '/army-intelligence'
export const armyIntelligenceFactionParam = 'faction'

export function buildArmyIntelligenceFactionPath(faction: string) {
  const selectedFaction = normalizeArmyForDisplay(faction).trim()

  if (!selectedFaction) {
    return armyIntelligencePath
  }

  const searchParams = new URLSearchParams()
  searchParams.set(armyIntelligenceFactionParam, selectedFaction)

  return `${armyIntelligencePath}?${searchParams.toString()}`
}

export function readArmyIntelligenceFactionParam(searchParams: URLSearchParams) {
  return normalizeArmyForDisplay(searchParams.get(armyIntelligenceFactionParam) || '').trim()
}
