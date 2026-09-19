import type { PublicGame } from './snapshotTypes'

export type PlayerGameResult = 'WIN' | 'LOSS' | 'DRAW'

export function isPlayerInGame(game: PublicGame, player: string): boolean {
  return game.player1 === player || game.player2 === player
}

export function getPlayerGameResult(game: PublicGame, player: string): PlayerGameResult | null {
  if (!isPlayerInGame(game, player)) return null
  if (game.winner.trim().toLocaleLowerCase() === 'draw') return 'DRAW'
  return game.winner === player ? 'WIN' : 'LOSS'
}
