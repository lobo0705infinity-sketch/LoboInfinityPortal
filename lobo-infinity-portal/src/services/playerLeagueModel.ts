import type { DivisionStandings, Standing } from '../types/dashboard'

export type PlayerLeagueModel = {
  currentLeague: string
  division: string
  divisionPopulation: number
  preferredArmy: string
  rank: number
  standing: Standing
}

export function resolvePlayerLeagueModel(
  divisions: DivisionStandings[],
  identities: string[],
): PlayerLeagueModel | null {
  const normalizedIdentities = identities
    .map(normalizeIdentity)
    .filter(Boolean)

  if (normalizedIdentities.length === 0) {
    return null
  }

  for (const division of divisions) {
    const standing = division.standings.find((row) =>
      normalizedIdentities.includes(normalizeIdentity(row.player)) ||
      normalizedIdentities.includes(normalizeIdentity(row.displayName)),
    )

    if (standing) {
      return {
        currentLeague: division.event?.name || 'Not Assigned',
        division: standing.division || division.divisionLabel,
        divisionPopulation: division.summary.players || division.standings.length,
        preferredArmy: standing.favoriteArmy || standing.faction || '',
        rank: standing.rank,
        standing,
      }
    }
  }

  return null
}

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase()
}
