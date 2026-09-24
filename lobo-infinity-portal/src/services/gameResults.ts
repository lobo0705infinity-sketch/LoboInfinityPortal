import type { RecentGame } from './api.ts'
import { formatPlayerName } from './formatting.ts'

export function isDrawGame(game: Pick<RecentGame, 'gameResult' | 'op' | 'tp' | 'vp'>) {
  if ((game.gameResult ?? '').toLowerCase() === 'draw') {
    return true
  }

  if ('winner' in game && 'loser' in game && game.winner === 'Draw' && game.loser === 'Draw') {
    return [game.tp, game.op].every((score) => {
      const [left, right] = String(score ?? '').split(/[-–—]/).map(Number)
      return Number.isFinite(left) && Number.isFinite(right) && left === right
    })
  }

  return [game.tp, game.op, game.vp].every((score) => {
    const [left, right] = String(score ?? '').split(/[-–—]/).map((part) => Number(part))
    return Number.isFinite(left) && Number.isFinite(right) && left === right
  })
}

export function getGameSides(game: RecentGame) {
  const publicGame = game as RecentGame & {
    player1?: string
    player1DisplayName?: string
    player2?: string
    player2DisplayName?: string
  }
  const publicDraw = isDrawGame(game) && game.winner === 'Draw' && game.loser === 'Draw'
  return [
    {
      player: publicDraw ? publicGame.player1 || game.winner : game.winner,
      displayName: publicDraw ? publicGame.player1DisplayName || publicGame.player1 || game.winnerDisplayName : game.winnerDisplayName,
      faction: game.winnerFaction,
      listId: game.winnerArmyListId,
    },
    {
      player: publicDraw ? publicGame.player2 || game.loser : game.loser,
      displayName: publicDraw ? publicGame.player2DisplayName || publicGame.player2 || game.loserDisplayName : game.loserDisplayName,
      faction: game.loserFaction,
      listId: game.loserArmyListId,
    },
  ] as const
}

export function getGameHeadline(game: RecentGame) {
  const [left, right] = getGameSides(game)
  const playerOne = formatPlayerName(left.player, left.displayName)
  const playerTwo = formatPlayerName(right.player, right.displayName)

  return isDrawGame(game)
    ? `${playerOne} and ${playerTwo} battled to a draw`
    : `${playerOne} defeated ${playerTwo}`
}

export function getGameTimelineResult(game: RecentGame) {
  const [left, right] = getGameSides(game)
  const playerOne = formatPlayerName(left.player, left.displayName)
  const playerTwo = formatPlayerName(right.player, right.displayName)

  return isDrawGame(game)
    ? `${playerOne} and ${playerTwo} fought to a draw`
    : `${playerOne} defeated ${playerTwo}`
}
