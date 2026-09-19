import { normalizePlayerComparisonPayload, type PlayerComparisonData } from './api'
import type { DivisionKey, DivisionStandings, Standing } from '../types/dashboard'
import { getPublicSnapshotDataset } from './publicSnapshot'

type SnapshotPlayer = Standing & { division: string }
type SnapshotGame = { winner: string; loser: string; gameResult?: string }

const divisions: Array<{ key: DivisionKey; label: string }> = [
  { key: 'main', label: 'Main Man' },
  { key: 'pga', label: 'Proving Grounds A' },
  { key: 'pgb', label: 'Proving Grounds B' },
  { key: 'casual', label: 'Casual' },
]

export async function getPublicPlayersProjection({ signal }: { signal?: AbortSignal } = {}) {
  const players = await getPublicSnapshotDataset<SnapshotPlayer[]>('players', signal)
  return divisions.map(({ key, label }): DivisionStandings => {
    const standings = players.filter((player) => player.division === label)
    return {
      division: key,
      divisionLabel: label,
      standings,
      summary: {
        activePlayers: standings.filter((player) => player.games > 0).length,
        gamesPlayed: Math.round(standings.reduce((total, player) => total + player.games, 0) / 2),
        leader: standings[0] ?? null,
        players: standings.length,
      },
    }
  }).filter((division) => division.standings.length > 0)
}

export type PublicPlayersComparisonProjection = {
  divisions: DivisionStandings[]
  getComparison: (left: string, right: string) => PlayerComparisonData
}

export async function getPublicPlayersComparisonProjection({
  signal,
}: { signal?: AbortSignal } = {}): Promise<PublicPlayersComparisonProjection> {
  const [playerDivisions, players, games] = await Promise.all([
    getPublicPlayersProjection({ signal }),
    getPublicSnapshotDataset<SnapshotPlayer[]>('players', signal),
    getPublicSnapshotDataset<SnapshotGame[]>('games', signal),
  ])
  return {
    divisions: playerDivisions,
    getComparison(left, right) {
      const selected = [left, right].map((name) => players.find((player) => player.player === name))
      if (!selected[0] || !selected[1]) throw new Error('One or both players could not be found.')
      const resolvedPlayers = selected as [SnapshotPlayer, SnapshotPlayer]
      const headToHead = games.filter((game) =>
        (game.winner === left && game.loser === right) ||
        (game.winner === right && game.loser === left),
      )
      return normalizePlayerComparisonPayload({
        success: true,
        players: resolvedPlayers.map((player) => ({ ...player, name: player.player })),
        headToHead: {
          games: headToHead.length,
          leftWins: headToHead.filter((game) => game.winner === left).length,
          rightWins: headToHead.filter((game) => game.winner === right).length,
          draws: headToHead.filter((game) => game.gameResult === 'Draw').length,
        },
      })
    },
  }
}
