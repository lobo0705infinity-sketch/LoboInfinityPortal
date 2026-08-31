import type { EventBracketData, EventHomeData, EventRegistrationData } from './api'
import { PUBLIC_SNAPSHOT_ID, getPublicSnapshotDataset } from './publicSnapshot'

type SnapshotEvent = Record<string, any> & { id: string; name: string; type: string }

function registrationFor(event: SnapshotEvent): EventRegistrationData {
  const registrations = Array.isArray(event.participants) ? event.participants : []
  const teams = Array.isArray(event.teams) ? event.teams : []
  return {
    capacity: { maximumPlayers: Number(event.capacity || 0), maximumTeams: 0, unlimited: !event.capacity, waitlistEnabled: false },
    captains: registrations.filter((entry: any) => entry?.captain),
    currentPlayer: null,
    eventId: event.id,
    eventName: event.name,
    eventType: event.type,
    freeAgents: registrations.filter((entry: any) => entry?.freeAgent),
    registeredCount: Number(event.registeredCount ?? registrations.length),
    registrationOpen: Boolean(event.registrationOpen),
    registrationWindow: event.registrationWindow ?? { startDate: '', endDate: '' },
    registrations,
    status: String(event.registrationStatus ?? event.status ?? ''),
    teamCount: teams.length,
    teams,
    waitlistCount: Number(event.waitlistCount || 0),
  } as EventRegistrationData
}

export type PublicEventProjection = {
  bracket: EventBracketData
  eventId: string
  generatedAt: string
  home: EventHomeData
  schemaVersion: number
}

export async function getPublicEventProjection(eventId: string, options: { signal?: AbortSignal } = {}) {
  const events = await getPublicSnapshotDataset<SnapshotEvent[]>('events', options.signal)
  const event = events.find((item) => item.id === eventId)
  if (!event) throw new Error('Public event could not be found in the fixed snapshot.')
  const registrations = registrationFor(event)
  const bracketMatches = Array.isArray(event.bracket) ? event.bracket : []
  return {
    eventId,
    generatedAt: PUBLIC_SNAPSHOT_ID,
    schemaVersion: 1,
    home: {
      currentRound: event.currentRound ?? null,
      eligibleOpponents: [],
      event,
      navigation: Array.isArray(event.navigation) ? event.navigation : [],
      news: Array.isArray(event.news) ? event.news : [],
      playerStatus: { captain: false, currentTeam: '', notifications: [], outstandingAction: '', registrationStatus: '', upcomingMatch: '' },
      quickActions: [],
      registration: registrations,
      rounds: Array.isArray(event.rounds) ? event.rounds : [],
      statistics: {
        completedGames: Number(event.completedGames || 0),
        completionPercentage: Number(event.completionPercentage || 0),
        currentRound: String(event.currentRound?.name ?? event.currentRound ?? ''),
        gamesRemaining: Number(event.gamesRemaining || 0),
        lifecycleStage: String(event.lifecycleStage || ''),
        registeredPlayers: Number(event.registeredCount ?? registrations.registeredCount),
        registrationStatus: String(event.registrationStatus ?? event.status ?? ''),
        teams: Array.isArray(event.teams) ? event.teams.length : 0,
      },
      timeline: Array.isArray(event.timeline) ? event.timeline : [],
    } as unknown as EventHomeData,
    bracket: {
      eventId,
      generated: bracketMatches.length > 0,
      matches: bracketMatches,
      missions: Array.isArray(event.bracketMissions) ? event.bracketMissions : [],
      readiness: { ready: bracketMatches.length > 0, blockers: [], warnings: [] },
      tournamentComplete: Boolean(event.champion),
      champion: String(event.champion || ''),
    } as unknown as EventBracketData,
  }
}
