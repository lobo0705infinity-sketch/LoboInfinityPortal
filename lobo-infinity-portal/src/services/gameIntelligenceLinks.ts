import type { ArmyIntelligenceList, RecentGame } from './api'

const playerKey = (value: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')

export function getGameIntelligenceLists(game: RecentGame, lists: ArmyIntelligenceList[]): ArmyIntelligenceList[] {
  const sides = [
    { player: game.winner, opponent: game.loser, listId: game.winnerArmyListId },
    { player: game.loser, opponent: game.winner, listId: game.loserArmyListId },
  ]
  const matched: ArmyIntelligenceList[] = []

  for (const side of sides) {
    const listId = String(side.listId || '').trim()
    const player = playerKey(side.player)
    const byListId = listId && lists.find((list) =>
      list.status === 'decoded' && list.decoded &&
      String(list.armyListId || '') === listId && playerKey(list.player) === player,
    )
    if (byListId) {
      matched.push(byListId)
      continue
    }

    // Older public snapshots omitted the list ID. Only accept an unambiguous
    // match on both participants, mission and day; a shifted sourceId alone is unsafe.
    const candidates = lists.filter((list) =>
      list.status === 'decoded' && list.decoded && !list.armyListId &&
      playerKey(list.player) === player &&
      playerKey(list.opponent) === playerKey(side.opponent) &&
      Boolean(game.mission && list.mission && game.date && list.date) &&
      playerKey(list.mission) === playerKey(game.mission) &&
      list.date.slice(0, 10) === game.date.slice(0, 10),
    )
    if (candidates.length === 1) matched.push(candidates[0])
  }

  return matched
}
