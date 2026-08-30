import type { CommissionerNewsItem, RecentGame, StreamedGame } from './api'

export type PublicGameCommunityData = {
  games: RecentGame[]
  news: CommissionerNewsItem[]
  streams: StreamedGame[]
}

type DetailSection = 'factions' | 'games' | 'missions' | 'players'

async function readSection<T>(section: DetailSection, signal?: AbortSignal): Promise<T> {
  const startedAt = performance.now()
  const response = await fetch(`/api/public-detail-projection?section=${section}`, { signal })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true || payload?.projection == null) {
    throw new Error(payload?.error || 'Public detail data could not be loaded.')
  }
  performance.measure(`lobo:public-detail-${section}`, { start: startedAt, end: performance.now() })
  return payload.projection as T
}

function findCaseInsensitive<T>(records: Record<string, T>, name: string): T | undefined {
  const key = Object.keys(records).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
  return key ? records[key] : undefined
}

export const publicDetailProjection = {
  getGames: (signal?: AbortSignal) => readSection<PublicGameCommunityData>('games', signal),
  getPlayer: async (name: string, signal?: AbortSignal) => {
    const profiles = await readSection<Record<string, unknown>>('players', signal)
    const profile = findCaseInsensitive(profiles, name)
    if (!profile) throw new Error('Player could not be loaded.')
    return profile
  },
  getFaction: async (name: string, signal?: AbortSignal) => {
    const profiles = await readSection<Record<string, unknown>>('factions', signal)
    const profile = findCaseInsensitive(profiles, name)
    if (!profile) throw new Error('Faction could not be loaded.')
    return profile
  },
  getMission: async (name: string, signal?: AbortSignal) => {
    const profiles = await readSection<Record<string, unknown>>('missions', signal)
    const profile = findCaseInsensitive(profiles, name)
    if (!profile) throw new Error('Mission could not be loaded.')
    return profile
  },
}
