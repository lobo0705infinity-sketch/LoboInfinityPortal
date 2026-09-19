import type { PublicGame } from './snapshotTypes'

export function getGameParticipants(game: PublicGame): [string, string] {
  const player1 = getParticipantName(game.player1DisplayName, game.player1, game.winnerDisplayName, game.winner)
  const player2 = getParticipantName(game.player2DisplayName, game.player2, game.loserDisplayName, game.loser)
  return [player1 || 'Unknown player 1', player2 || 'Unknown player 2']
}

function getParticipantName(...candidates: unknown[]) {
  return candidates.map(candidate => String(candidate ?? '').trim()).find(candidate => candidate && !/^(draw|tie|tied)$/i.test(candidate)) || ''
}
