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

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}
