import { normalizeArmyForDisplay, resolveArmyIdentity } from './armyIdentity.ts'

export const armyIntelligencePath = '/army-intelligence'
export const armyIntelligenceFactionParam = 'faction'

export function buildArmyIntelligenceFactionPath(faction: string) {
  const selectedFaction = resolveArmyIdentity(faction)?.id || normalizeArmyForDisplay(faction).trim()

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

export function buildArmyListsFactionPath(faction: string) {
  const selectedFaction = normalizeArmyForDisplay(faction).trim()
  const params = new URLSearchParams()
  if (selectedFaction) params.set('faction', selectedFaction)
  return `/army-lists${params.size ? `?${params.toString()}` : ''}`
}
