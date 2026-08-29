import {
  normalizeDashboardPayload,
  normalizeFactionsPayload,
  normalizeLeagueOperationsPayload,
  normalizeMissionsPayload,
  normalizePlayersPayload,
  type FactionSummary,
  type LeagueOperationsData,
  type MissionSummary,
} from './api'
import type { DashboardData, DivisionKey, DivisionStandings } from '../types/dashboard'

type LeagueSection = 'dashboard' | 'factions' | 'missions' | 'leagueOperations'

async function readSection(section: LeagueSection, signal?: AbortSignal) {
  const startedAt = performance.now()
  const response = await fetch(`/api/public-league-workspace-projection?section=${section}`, { signal })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true || payload?.projection == null) {
    throw new Error(payload?.error || 'League public data could not be loaded.')
  }
  performance.measure(`lobo:public-league-${section}`, { start: startedAt, end: performance.now() })
  return payload.projection
}

export const publicLeagueWorkspace = {
  getDashboard: async (signal?: AbortSignal): Promise<DashboardData> =>
    normalizeDashboardPayload(await readSection('dashboard', signal)),
  getFactions: async (signal?: AbortSignal): Promise<FactionSummary[]> =>
    normalizeFactionsPayload(await readSection('factions', signal)),
  getMissions: async (scope: string, signal?: AbortSignal): Promise<MissionSummary[]> => {
    const scopes = await readSection('missions', signal)
    return normalizeMissionsPayload(scopes?.[scope])
  },
  getLeagueOperations: async (signal?: AbortSignal): Promise<LeagueOperationsData> =>
    normalizeLeagueOperationsPayload(await readSection('leagueOperations', signal)),
  getStandings: async (
    division: DivisionKey,
    signal?: AbortSignal,
  ): Promise<DivisionStandings> => {
    const dashboard = await readSection('dashboard', signal)
    const divisions = normalizePlayersPayload({
      divisions: dashboard?.divisionStandings,
      success: true,
    })
    const selected = divisions.find((item) => item.division === division)
    if (!selected) throw new Error('Prepared League standings are unavailable for this division.')
    return selected
  },
}
