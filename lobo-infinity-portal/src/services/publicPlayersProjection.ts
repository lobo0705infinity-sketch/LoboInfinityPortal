import { normalizePlayersPayload } from './api'
import type { DivisionStandings } from '../types/dashboard'

export async function getPublicPlayersProjection({
  signal,
}: {
  signal?: AbortSignal
} = {}): Promise<DivisionStandings[]> {
  const startedAt = performance.now()
  const response = await fetch('/api/public-players-projection', { signal })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error || 'Player data could not be loaded.')
  }
  if (payload?.eventId !== '') {
    throw new Error('Public Players projection scope is invalid.')
  }

  const result = normalizePlayersPayload(payload)
  performance.measure('lobo:public-players-projection', {
    start: startedAt,
    end: performance.now(),
    detail: { playerCount: result.reduce((total, division) => total + division.standings.length, 0) },
  })
  return result
}
