import type { RecentGame } from './api'
import { formatPlayerName } from './formatting'

export function isDrawGame(game: Pick<RecentGame, 'gameResult' | 'op' | 'tp' | 'vp'>) {
  if ((game.gameResult ?? '').toLowerCase() === 'draw') {
    return true
  }

  return [game.tp, game.op, game.vp].every((score) => {
    const [left, right] = String(score ?? '').split('-').map((part) => Number(part))
    return Number.isFinite(left) && Number.isFinite(right) && left === right
  })
}

export function getGameHeadline(game: RecentGame) {
  const playerOne = formatPlayerName(game.winner, game.winnerDisplayName)
  const playerTwo = formatPlayerName(game.loser, game.loserDisplayName)

  return isDrawGame(game)
    ? `${playerOne} and ${playerTwo} battled to a draw`
    : `${playerOne} defeated ${playerTwo}`
}

export function getGameTimelineResult(game: RecentGame) {
  const playerOne = formatPlayerName(game.winner, game.winnerDisplayName)
  const playerTwo = formatPlayerName(game.loser, game.loserDisplayName)

  return isDrawGame(game)
    ? `${playerOne} and ${playerTwo} fought to a draw`
    : `${playerOne} defeated ${playerTwo}`
}
