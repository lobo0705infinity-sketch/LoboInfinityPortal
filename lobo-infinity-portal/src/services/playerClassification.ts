import type { PlayerCareerSummary, PlayerProfileData } from './api'
import type { Standing } from '../types/dashboard'

export type PlayerClassification =
  | 'Casual Player'
  | 'League Player'
  | 'Tournament Player'
  | 'New Player'
  | 'Veteran'
  | 'Commissioner'

export type PlayerStatusFilter =
  | 'all'
  | 'casual'
  | 'league'
  | 'tournament'
  | 'new'

type ClassifiableStanding = Pick<
  Standing,
  'gameTypes' | 'games' | 'statusBadges'
>

export function getStandingClassifications(
  player: ClassifiableStanding,
): PlayerClassification[] {
  const badges = (player.statusBadges ?? []).map(normalizeValue)
  const gameTypes = (player.gameTypes ?? []).map(normalizeValue)
  const hasLeague =
    badges.includes('league player') ||
    badges.includes('league') ||
    gameTypes.includes('league')
  const hasTournament =
    badges.includes('tournament player') ||
    badges.includes('tournament') ||
    gameTypes.includes('tournament')
  const classifications: PlayerClassification[] = []

  if (hasLeague) {
    classifications.push('League Player')
  }

  if (hasTournament) {
    classifications.push('Tournament Player')
  }

  if (!hasLeague && !hasTournament) {
    classifications.push('Casual Player')
  }

  if (
    badges.includes('new player') ||
    gameTypes.includes('new') ||
    player.games === 0
  ) {
    classifications.push('New Player')
  }

  return classifications
}

export function getProfileClassifications(
  player: PlayerProfileData,
  career: PlayerCareerSummary,
): PlayerClassification[] {
  const hasLeague = player.registeredEvents.some((event) =>
    isActiveEventRegistration(event, 'league'),
  )
  const hasTournament = player.registeredEvents.some((event) =>
    isActiveEventRegistration(event, 'tournament'),
  )
  const classifications: PlayerClassification[] = []

  if (hasLeague) {
    classifications.push('League Player')
  }

  if (hasTournament) {
    classifications.push('Tournament Player')
  }

  if (!hasLeague && !hasTournament) {
    classifications.push('Casual Player')
  }

  if (career.records.league.games + career.records.tournament.games === 0) {
    classifications.push('New Player')
  }

  if (career.records.league.games + career.records.tournament.games >= 50) {
    classifications.push('Veteran')
  }

  if (hasCommissionerSignal(player)) {
    classifications.push('Commissioner')
  }

  return classifications
}

export function statusFilterMatches(
  classifications: PlayerClassification[],
  filter: PlayerStatusFilter,
) {
  if (filter === 'all') {
    return true
  }

  const target = statusFilterLabel(filter)

  return classifications.includes(target)
}

export function statusFilterLabel(
  filter: Exclude<PlayerStatusFilter, 'all'>,
): PlayerClassification {
  if (filter === 'league') {
    return 'League Player'
  }

  if (filter === 'tournament') {
    return 'Tournament Player'
  }

  if (filter === 'new') {
    return 'New Player'
  }

  return 'Casual Player'
}

export function isActiveEventRegistration(
  event: PlayerProfileData['registeredEvents'][number],
  target: 'league' | 'tournament',
) {
  const normalizedStatus = normalizeValue(event.status)

  if (
    ['deleted', 'removed', 'withdrawn', 'disabled', 'archived', 'completed'].includes(
      normalizedStatus,
    )
  ) {
    return false
  }

  if (isSyntheticCurrentLeagueRegistration(event)) {
    return false
  }

  const eventIdentity = `${event.eventType} ${event.eventName}`.toLowerCase()

  return target === 'league'
    ? eventIdentity.includes('league')
    : eventIdentity.includes('tournament')
}

function isSyntheticCurrentLeagueRegistration(
  event: PlayerProfileData['registeredEvents'][number],
) {
  return event.eventId === 'event-current-league' &&
    normalizeValue(event.registeredAt) === '' &&
    normalizeValue(event.updatedAt) === ''
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

function hasCommissionerSignal(player: PlayerProfileData) {
  const source = player as PlayerProfileData & {
    isCommissioner?: boolean
    permissions?: Record<string, boolean>
    role?: string
    roles?: string[]
  }

  if (source.isCommissioner) {
    return true
  }

  if (source.permissions?.commissioner) {
    return true
  }

  const roleNames = [
    source.role ?? '',
    ...(Array.isArray(source.roles) ? source.roles : []),
  ].map(normalizeValue)

  return roleNames.some((role) => role.includes('commissioner'))
}
