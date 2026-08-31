import type { TeamTournamentData } from './api'
import { getPublicSnapshotDataset } from './publicSnapshot'

export async function getPublicTeamTournamentProjection({ eventId, signal }: { eventId: string; signal?: AbortSignal }): Promise<TeamTournamentData> {
  const [events, games] = await Promise.all([
    getPublicSnapshotDataset<Array<Record<string, any>>>('events', signal),
    getPublicSnapshotDataset<Array<Record<string, any>>>('games', signal),
  ])
  const event = events.find((item) => item.id === eventId)
  if (!event) throw new Error('Team Tournament could not be found in the fixed snapshot.')
  const registrations = Array.isArray(event.participants) ? event.participants : []
  const teams = Array.isArray(event.teams) ? event.teams : []
  const pairings = Array.isArray(event.pairings) ? event.pairings : []
  return {
    champion: event.champion ?? null,
    completedMatches: Number(event.completedGames || 0),
    currentRound: event.currentRound ?? null,
    event,
    freeAgents: registrations.filter((entry: any) => entry?.freeAgent),
    invitations: [],
    latestResults: games.filter((game) => game.eventId === eventId),
    news: Array.isArray(event.news) ? event.news : [],
    pairings,
    quickActions: [],
    registeredTeams: teams.length,
    registration: {
      capacity: { maximumPlayers: 0, maximumTeams: 0, unlimited: true, waitlistEnabled: false },
      captains: registrations.filter((entry: any) => entry?.captain), currentPlayer: null,
      eventId, eventName: event.name, eventType: event.type,
      freeAgents: registrations.filter((entry: any) => entry?.freeAgent),
      registeredCount: Number(event.registeredCount ?? registrations.length), registrationOpen: Boolean(event.registrationOpen),
      registrationWindow: event.registrationWindow ?? { startDate: '', endDate: '' }, registrations,
      status: String(event.registrationStatus ?? event.status ?? ''), teamCount: teams.length, teams, waitlistCount: Number(event.waitlistCount || 0),
    },
    rounds: Array.isArray(event.rounds) ? event.rounds : [],
    standings: Array.isArray(event.standings) ? event.standings : [],
    status: String(event.status || ''),
    teams,
    timeline: Array.isArray(event.timeline) ? event.timeline : [],
    resultStatuses: Array.isArray(event.resultStatuses) ? event.resultStatuses : [],
    tournamentResults: Array.isArray(event.results) ? event.results : [],
    upcomingPairings: pairings.filter((pairing: any) => !pairing?.completed),
  } as unknown as TeamTournamentData
}
