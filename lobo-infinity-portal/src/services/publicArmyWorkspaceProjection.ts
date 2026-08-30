import {
  buildSubmittedArmyListLibraryFromSources,
  normalizeArmyIntelligenceFactionProjection,
  normalizeArmyIntelligenceSummaryProjection,
  type ArmyIntelligenceFactionData,
  type ArmyIntelligenceSummaryData,
  type SubmittedArmyListEntry,
} from './api'

async function readSection(section: string, options: { faction?: string; signal?: AbortSignal } = {}) {
  const query = new URLSearchParams({ section })
  if (options.faction) query.set('faction', options.faction)
  const startedAt = performance.now()
  const response = await fetch(`/api/public-army-workspace-projection?${query}`, { signal: options.signal })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true || payload?.projection == null) {
    throw new Error(payload?.error || 'Army public data could not be loaded.')
  }
  performance.measure(`lobo:public-army-${section}`, { start: startedAt, end: performance.now() })
  return payload.projection
}

export const publicArmyWorkspace = {
  getArmyLists: async (signal?: AbortSignal): Promise<SubmittedArmyListEntry[]> => {
    const artifact = await readSection('armyLists', { signal })
    return buildSubmittedArmyListLibraryFromSources(
      artifact?.games,
      artifact?.casualGames,
      artifact?.tournamentGames,
      artifact?.events,
    )
  },
  getIntelligenceSummary: async (signal?: AbortSignal): Promise<ArmyIntelligenceSummaryData> =>
    normalizeArmyIntelligenceSummaryProjection(await readSection('intelligenceSummary', { signal })),
  getIntelligenceFaction: async (faction: string, signal?: AbortSignal): Promise<ArmyIntelligenceFactionData> =>
    normalizeArmyIntelligenceFactionProjection(await readSection('intelligenceFaction', { faction, signal })),
}
