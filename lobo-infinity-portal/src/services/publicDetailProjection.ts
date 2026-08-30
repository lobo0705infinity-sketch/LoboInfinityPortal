import type { CommissionerNewsItem, RecentGame, StreamedGame } from './api'

export type PublicGameCommunityData = {
  games: RecentGame[]
  rivalryGames: RecentGame[]
  news: CommissionerNewsItem[]
  streams: StreamedGame[]
}

type DetailSection = 'factions' | 'games' | 'missions' | 'players'

async function readSection<T>(section: DetailSection, signal?: AbortSignal, name?: string): Promise<T> {
  const startedAt = performance.now()
  const query = new URLSearchParams({ section })
  if (name) query.set('name', name)
  const response = await fetch(`/api/public-detail-projection?${query.toString()}`, { signal })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true || payload?.projection == null) {
    throw new Error(payload?.error || 'Public detail data could not be loaded.')
  }
  performance.measure(`lobo:public-detail-${section}`, { start: startedAt, end: performance.now() })
  return payload.projection as T
}

export const publicDetailProjection = {
  getGames: (signal?: AbortSignal) => readSection<PublicGameCommunityData>('games', signal),
  getPlayer: async (name: string, signal?: AbortSignal) => {
    return readSection<unknown>('players', signal, name)
  },
  getFaction: async (name: string, signal?: AbortSignal) => {
    return readSection<unknown>('factions', signal, name)
  },
  getMission: async (name: string, signal?: AbortSignal) => {
    return readSection<unknown>('missions', signal, name)
  },
}
