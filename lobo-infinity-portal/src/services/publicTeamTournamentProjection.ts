import type { TeamTournamentData } from './api'

export async function getPublicTeamTournamentProjection({ eventId, signal }: { eventId: string; signal?: AbortSignal }): Promise<TeamTournamentData> {
  const response = await fetch(`/api/public-team-tournament-projection?eventId=${encodeURIComponent(eventId)}`, { signal })
  const payload = await response.json() as { error?: string; success?: boolean; tournament?: TeamTournamentData }
  if (!response.ok || payload.success !== true || !payload.tournament) {
    throw new Error(payload.error || 'Team Tournament could not be loaded.')
  }
  if (payload.tournament.event.id !== eventId) {
    throw new Error('Team Tournament event isolation failed.')
  }
  return payload.tournament
}
