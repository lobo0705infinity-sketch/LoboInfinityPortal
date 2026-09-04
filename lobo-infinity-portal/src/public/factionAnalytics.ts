import type { PublicGame } from './snapshotTypes'

export type FactionGameObservation = {
  game: PublicGame
  opponentFaction: string
  opponentName: string
  player: string
  playerName: string
  result: 'Win' | 'Loss' | 'Draw'
  tp?: number
  op?: number
  vp?: number
}

export type FactionPerformance = {
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  averageTP: number
  averageOP: number
  averageVP: number
}

export type FactionMissionPerformance = FactionPerformance & { mission: string }
export type FactionPlayerPerformance = FactionPerformance & { player: string; displayName: string }

export function getFactionGameObservations(
  faction: string,
  games: PublicGame[],
): FactionGameObservation[] {
  return games.flatMap((game) => {
    const draw = game.winner.trim().toLocaleLowerCase() === 'draw'
    const winnerSide = draw ? 0 : game.winner === game.player1 ? 1 : game.winner === game.player2 ? 2 : 0
    const tp = parsePublicScore(game.tp)
    const op = parsePublicScore(game.op)
    const vp = parsePublicScore(game.vp)

    return ([1, 2] as const).flatMap((side) => {
      const sideFaction = side === 1 ? game.player1Faction : game.player2Faction
      if (sideFaction !== faction) return []
      const player = side === 1 ? game.player1 : game.player2
      const playerName = side === 1 ? game.player1DisplayName : game.player2DisplayName
      const scoreIndex = draw ? side - 1 : winnerSide === side ? 0 : 1
      return [{
        game,
        opponentFaction: side === 1 ? game.player2Faction : game.player1Faction,
        opponentName: side === 1 ? game.player2DisplayName : game.player1DisplayName,
        player,
        playerName,
        result: draw ? 'Draw' : winnerSide === side ? 'Win' : 'Loss',
        tp: tp?.[scoreIndex],
        op: op?.[scoreIndex],
        vp: vp?.[scoreIndex],
      }]
    })
  })
}

export function summarizeFactionObservations(
  observations: FactionGameObservation[],
): FactionPerformance {
  const wins = observations.filter((row) => row.result === 'Win').length
  const draws = observations.filter((row) => row.result === 'Draw').length
  return {
    games: observations.length,
    wins,
    losses: observations.length - wins - draws,
    draws,
    winRate: observations.length ? roundToTwo((wins / observations.length) * 100) : 0,
    averageTP: averageValid(observations.map((row) => row.tp)),
    averageOP: averageValid(observations.map((row) => row.op)),
    averageVP: averageValid(observations.map((row) => row.vp)),
  }
}

export function buildFactionMissionPerformance(
  observations: FactionGameObservation[],
): FactionMissionPerformance[] {
  return summarizeGroups(observations, (row) => row.game.mission)
    .map(([mission, rows]) => ({ mission, ...summarizeFactionObservations(rows) }))
    .sort((left, right) => right.games - left.games || left.mission.localeCompare(right.mission))
}

export function buildFactionPlayerPerformance(
  observations: FactionGameObservation[],
): FactionPlayerPerformance[] {
  return summarizeGroups(observations, (row) => row.player)
    .map(([player, rows]) => ({
      player,
      displayName: rows[0]?.playerName || player,
      ...summarizeFactionObservations(rows),
    }))
    .sort((left, right) => right.games - left.games || left.displayName.localeCompare(right.displayName))
}

function summarizeGroups(
  observations: FactionGameObservation[],
  keyFor: (row: FactionGameObservation) => string,
) {
  const groups = new Map<string, FactionGameObservation[]>()
  observations.forEach((row) => {
    const key = keyFor(row)
    if (!key) return
    groups.set(key, [...(groups.get(key) ?? []), row])
  })
  return [...groups.entries()]
}

function parsePublicScore(value: string): [number, number] | undefined {
  const parts = String(value ?? '').trim().split(/\s*[–—-]\s*/)
  if (parts.length !== 2) return undefined
  const scores = parts.map(Number)
  return scores.every(Number.isFinite) ? scores as [number, number] : undefined
}

function averageValid(values: Array<number | undefined>) {
  const valid = values.filter((value): value is number => Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0
}

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
