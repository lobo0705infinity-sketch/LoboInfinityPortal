import {
  normalizePlayerComparisonPayload,
  normalizePlayersPayload,
  type PlayerComparisonData,
} from './api'
import type { DivisionStandings } from '../types/dashboard'

export async function getPublicPlayersProjection({
  signal,
}: {
  signal?: AbortSignal
} = {}): Promise<DivisionStandings[]> {
  const startedAt = performance.now()
  const response = await fetch('/api/public-players-projection', { signal })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error || 'Player data could not be loaded.')
  }
  if (payload?.eventId !== '') {
    throw new Error('Public Players projection scope is invalid.')
  }

  const result = normalizePlayersPayload(payload)
  performance.measure('lobo:public-players-projection', {
    start: startedAt,
    end: performance.now(),
    detail: { playerCount: result.reduce((total, division) => total + division.standings.length, 0) },
  })
  return result
}

export type PublicPlayersComparisonProjection = {
  divisions: DivisionStandings[]
  getComparison: (left: string, right: string) => PlayerComparisonData
}

export async function getPublicPlayersComparisonProjection({
  signal,
}: {
  signal?: AbortSignal
} = {}): Promise<PublicPlayersComparisonProjection> {
  const startedAt = performance.now()
  const response = await fetch('/api/public-players-projection', { signal })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true || payload?.eventId !== '') {
    throw new Error(payload?.error || 'Player comparison data could not be loaded.')
  }

  const divisions = normalizePlayersPayload(payload)
  const comparisonPlayers = Array.isArray(payload?.comparison?.players)
    ? payload.comparison.players
    : []
  const headToHeadRows = Array.isArray(payload?.comparison?.headToHead)
    ? payload.comparison.headToHead
    : []

  performance.measure('lobo:public-players-comparison-projection', {
    start: startedAt,
    end: performance.now(),
    detail: { playerCount: comparisonPlayers.length },
  })

  return {
    divisions,
    getComparison(left, right) {
      const players = [left, right].map((name) =>
        comparisonPlayers.find((player: { name?: unknown }) => player?.name === name),
      )
      if (!players[0] || !players[1]) {
        throw new Error('One or both players could not be found.')
      }

      const ordered = [left, right].sort()
      const row = headToHeadRows.find(
        (item: { left?: unknown; right?: unknown }) =>
          item?.left === ordered[0] && item?.right === ordered[1],
      )
      const leftIsStoredLeft = left === ordered[0]
      return normalizePlayerComparisonPayload({
        success: true,
        players,
        headToHead: {
          games: row?.games ?? 0,
          leftWins: leftIsStoredLeft ? row?.leftWins ?? 0 : row?.rightWins ?? 0,
          rightWins: leftIsStoredLeft ? row?.rightWins ?? 0 : row?.leftWins ?? 0,
          draws: row?.draws ?? 0,
        },
      })
    },
  }
}
