import { normalizeTeamTournamentPayload, type TeamTournamentData } from './api'

export async function getPublicTeamTournamentProjection({
  eventId,
  signal,
}: {
  eventId: string
  signal?: AbortSignal
}): Promise<TeamTournamentData> {
  const startedAt = performance.now()
  const query = new URLSearchParams({ eventId })
  const response = await fetch(`/api/public-team-tournament-projection?${query}`, { signal })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error || 'Team Tournament could not be loaded.')
  }
  if (payload?.tournament?.event?.id !== eventId) {
    throw new Error('Public Team Tournament projection event isolation failed.')
  }

  const result = normalizeTeamTournamentPayload(payload)
  performance.measure('lobo:public-team-tournament-projection', {
    start: startedAt,
    end: performance.now(),
    detail: { eventId },
  })
  return result
}
