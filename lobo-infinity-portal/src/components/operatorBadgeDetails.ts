import type { PlayerClassification } from '../services/playerClassification'

export type OperatorBadgeAchievement = {
  title: string
  unlocked?: boolean
}

export type OperatorBadgePlayer = {
  careerSummary?: {
    records?: {
      league?: { games?: number }
      tournament?: { games?: number }
    }
    totalGames?: number
  }
  displayName?: string
  division?: string
  favoriteFaction?: string
  name: string
  rank?: number
}

export type OperatorBadgeRing =
  | 'league-champion'
  | 'tournament-champion'
  | 'veteran'
  | 'hall-of-fame'
  | 'commissioner'

export type OperatorBadgeDetail = {
  competitiveHome: string
  faction: string
  rank: string
  rings: Record<OperatorBadgeRing, boolean>
}

type OperatorBadgeDetailInput = {
  achievements?: OperatorBadgeAchievement[]
  classifications?: PlayerClassification[]
  competitiveHome?: string
  player: OperatorBadgePlayer
  preferredFaction?: string
  rank?: number
}

export function getOperatorBadgeDetails({
  achievements = [],
  classifications = [],
  competitiveHome = '',
  player,
  preferredFaction,
  rank,
}: OperatorBadgeDetailInput): OperatorBadgeDetail {
  const faction = normalizePreferredFactionLabel(preferredFaction || player.favoriteFaction || '') || 'Not Selected'
  const displayRank = rank ?? player.rank ?? 0
  const rings = deriveAchievementRings(player, classifications, achievements)

  return {
    competitiveHome: normalizeCompetitiveHome(competitiveHome),
    faction,
    rank: displayRank > 0 ? `#${displayRank}` : 'Unranked',
    rings: {
      'hall-of-fame': rings.includes('hall-of-fame'),
      'league-champion': rings.includes('league-champion'),
      'tournament-champion': rings.includes('tournament-champion'),
      commissioner: rings.includes('commissioner'),
      veteran: rings.includes('veteran'),
    },
  }
}

export function getOperatorBadgeRows(details: OperatorBadgeDetail) {
  return [
    { label: 'Preferred Army', value: details.faction },
    { label: 'Competitive Home', value: details.competitiveHome },
    { label: 'Current Rank', value: details.rank },
    { label: 'League Champion', value: formatEarned(details.rings['league-champion']) },
    { label: 'Tournament Champion', value: formatEarned(details.rings['tournament-champion']) },
    { label: 'Veteran', value: formatEarned(details.rings.veteran) },
    { label: 'Commissioner', value: formatEarned(details.rings.commissioner) },
    { label: 'Hall of Fame', value: formatEarned(details.rings['hall-of-fame']) },
  ]
}

export function getEarnedRings(rings: Record<OperatorBadgeRing, boolean>) {
  return Object.entries(rings)
    .filter(([, earned]) => earned)
    .map(([ring]) => ring as OperatorBadgeRing)
}

export function formatRingLabel(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function deriveAchievementRings(
  player: OperatorBadgePlayer,
  classifications: PlayerClassification[],
  achievements: OperatorBadgeAchievement[],
) {
  const rings = new Set<OperatorBadgeRing>()
  const officialGames =
    (player.careerSummary?.records?.league?.games ?? 0) +
    (player.careerSummary?.records?.tournament?.games ?? 0)
  const unlockedAchievements = achievements
    .filter((achievement) => achievement.unlocked !== false)
    .map((achievement) => achievement.title.toLowerCase())

  if (unlockedAchievements.some((title) => title.includes('league champion'))) {
    rings.add('league-champion')
  }

  if (unlockedAchievements.some((title) => title.includes('tournament champion'))) {
    rings.add('tournament-champion')
  }

  if (
    unlockedAchievements.some((title) => title.includes('hall of fame')) ||
    unlockedAchievements.some((title) => title.includes('legend'))
  ) {
    rings.add('hall-of-fame')
  }

  if (
    classifications.includes('Veteran') ||
    officialGames >= 50 ||
    unlockedAchievements.some((title) => title.includes('veteran'))
  ) {
    rings.add('veteran')
  }

  if (
    classifications.includes('Commissioner') ||
    unlockedAchievements.some((title) => title.includes('commissioner')) ||
    isCommissionerPlayer(player)
  ) {
    rings.add('commissioner')
  }

  return Array.from(rings)
}

function isCommissionerPlayer(player: OperatorBadgePlayer) {
  const source = player as OperatorBadgePlayer & {
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
  ].map((role) => role.trim().toLowerCase())

  if (roleNames.some((role) => role.includes('commissioner'))) {
    return true
  }

  return normalizePlayerIdentity(player.name) === 'lobo' ||
    normalizePlayerIdentity(player.displayName ?? '') === 'lobo'
}

function normalizePlayerIdentity(value: string) {
  return value.trim().toLowerCase()
}

function normalizeCompetitiveHome(value: string) {
  const trimmed = value.trim()
  return trimmed || 'Not Assigned'
}

function formatEarned(earned: boolean) {
  return earned ? 'Earned' : 'Not Earned'
}

function normalizePreferredFactionLabel(value: string) {
  return value.trim().replace(/\s*\(\d+\s+games?\)$/i, '')
}
