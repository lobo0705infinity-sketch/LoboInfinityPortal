import { applyTop40MapAssignments, withTop40RoundMaps } from '../../shared/top40-round-maps.mjs'
import { getTop40LivePublicData } from './top40LivePublicData'
import type { EventBracketData, EventHomeData, EventRegistrationData } from './api'
import { getPinnedPublicSnapshot, getPublicSnapshotDataset } from './publicSnapshot'

type SnapshotEvent = Record<string, unknown> & { id: string; name: string; type: string; participants?: EventRegistrationData['registrations']; teams?: EventRegistrationData['teams']; bracket?: EventBracketData['matches']; currentRound?: { name?: string } | string }

function registrationFor(event: SnapshotEvent): EventRegistrationData {
  const registrations = Array.isArray(event.participants) ? event.participants : []
  const teams = Array.isArray(event.teams) ? event.teams : []
  return {
    capacity: { maximumPlayers: Number(event.capacity || 0), maximumTeams: 0, unlimited: !event.capacity, waitlistEnabled: false },
    captains: registrations.filter((entry) => entry?.captain),
    currentPlayer: null,
    eventId: event.id,
    eventName: event.name,
    eventType: event.type,
    freeAgents: registrations.filter((entry) => entry?.freeAgent),
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
  if (eventId === 'event-lobo-s-american-top-40') {
    try {
      const live = (await getTop40LivePublicData()).projection
      const current = await getPinnedPublicSnapshot(options.signal)
      if (live?.home?.event?.id === eventId && live.bracket?.eventId === eventId && Date.parse(live.generatedAt) >= Date.parse(current.sourceCutoff)) return applyTop40MapAssignments(live)
    } catch { /* Keep the validated fixed snapshot available during publication outages. */ }
  }
  const snapshot = await getPinnedPublicSnapshot(options.signal)
  const events = await getPublicSnapshotDataset<SnapshotEvent[]>('events', options.signal)
  const event = events.find((item) => item.id === eventId)
  if (!event) throw new Error('Public event could not be found in the fixed snapshot.')
  const compatibleEvent = {
    ...event,
    capabilities: Array.isArray(event.capabilities) ? event.capabilities : [],
  }
  const registrations = registrationFor(event)
  const rawMissions = Array.isArray(event.bracketMissions) ? event.bracketMissions as EventBracketData['missions'] : []
  const missions = eventId === 'event-lobo-s-american-top-40' ? withTop40RoundMaps(rawMissions) : rawMissions
  const bracketMatches = (Array.isArray(event.bracket) ? event.bracket : []).map((match) => {
    const assignment = missions.find((item) => item.bracket === match.bracket && Number(item.bracketRound) === Number(match.bracketRound))
      ?? (match.matchId === 'GF-M2' ? missions.find((item) => item.bracket === 'Grand Final' && Number(item.bracketRound) === 1) : undefined)
    return { ...match, eventId, mission: match.mission || assignment?.mission || '' }
  })
  const registered = registrations.registrations.filter((item) => item.status === 'Registered')
  const seeded = registered.filter((item) => Number.isInteger(Number(item.seed)) && Number(item.seed) >= 1 && Number(item.seed) <= registered.length)
  const registrationClosed = /closed/i.test(registrations.status)
  const reasons: string[] = []
  if (!registrationClosed) reasons.push('Close registration before preparing the bracket.')
  if (registered.length < 2) reasons.push('At least two registered players are required.')
  if (seeded.length !== registered.length || new Set(seeded.map((item) => Number(item.seed))).size !== registered.length) reasons.push('Assign unique seeds from 1 through N.')
  if (Number(event.capacity) > 0 && registered.length > Number(event.capacity)) reasons.push('Registered players exceed event capacity.')
  const firstFinal = bracketMatches.find((match) => match.matchId === 'GF-M1')
  const resetFinal = bracketMatches.find((match) => match.matchId === 'GF-M2')
  const decidingFinal = resetFinal && resetFinal.status !== 'Not Required' ? resetFinal : firstFinal
  const champion = decidingFinal?.status === 'Completed' ? String(decidingFinal.winner || '') : ''
  return applyTop40MapAssignments({
    eventId,
    generatedAt: snapshot.snapshotId,
    schemaVersion: 1,
    home: {
      currentRound: event.currentRound ?? null,
      eligibleOpponents: [],
      event: compatibleEvent,
      navigation: Array.isArray(event.navigation) ? event.navigation : [],
      news: Array.isArray(event.news) ? event.news : [],
      playerStatus: { captain: false, currentTeam: '', notifications: [], outstandingAction: '', registrationStatus: '', upcomingMatch: '' },
      quickActions: [],
      registration: registrations,
      rounds: Array.isArray(event.rounds) ? event.rounds : [],
      statistics: {
        completedGames: Number(event.completedGames || 0),
        completionPercentage: Number(event.completionPercentage || 0),
        currentRound: String(typeof event.currentRound === 'object' ? event.currentRound.name ?? '' : event.currentRound ?? ''),
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
      missions,
      released: bracketMatches.some((match) => Boolean(match.activatedAt)),
      readiness: { capacity:Number(event.capacity || 0), ready:reasons.length === 0, reasons, registeredCount:registered.length, seededCount:seeded.length, registrationClosed },
      tournamentComplete: Boolean(champion),
      champion,
    } as unknown as EventBracketData,
  })
}
