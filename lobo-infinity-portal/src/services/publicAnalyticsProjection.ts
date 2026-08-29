import {
  type FactionSummary,
  type LeagueRecordValue,
  type MissionSummary,
} from './api'
import type { DivisionStandings } from '../types/dashboard'

export type PublicAnalyticsProjection = {
  factions: FactionSummary[]
  missions: MissionSummary[]
  players: DivisionStandings[]
  records: Record<string, LeagueRecordValue>
}

export async function getPublicAnalyticsProjection({
  eventId,
  gameType,
  signal,
}: {
  eventId: string
  gameType: string
  signal?: AbortSignal
}): Promise<PublicAnalyticsProjection> {
  const startedAt = performance.now()
  const query = new URLSearchParams({ gameType })
  if (eventId) query.set('eventId', eventId)

  const response = await fetch(`/api/public-analytics-projection?${query}`, { signal })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error || 'Statistics could not be loaded.')
  }

  const projection = payload?.projection
  if (!projection || typeof projection !== 'object') {
    throw new Error('Public analytics projection is invalid.')
  }

  if (eventId && projection.eventId !== eventId) {
    throw new Error('Public analytics projection event isolation failed.')
  }

  const result = projection as PublicAnalyticsProjection

  performance.measure('lobo:public-analytics-projection', {
    start: startedAt,
    end: performance.now(),
    detail: { eventId: projection.eventId, gameType },
  })

  return result
}
