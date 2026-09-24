import type { RecentGame } from './api'
import type { PublicSubmittedArmyList } from './publicDetailProjection'

const key = (value: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')

export function getGameArmyLists(game: RecentGame, armyLists: PublicSubmittedArmyList[]): PublicSubmittedArmyList[] {
  const sides = [
    { player: game.winner, opponent: game.loser, id: game.winnerArmyListId },
    { player: game.loser, opponent: game.winner, id: game.loserArmyListId },
  ]

  return sides.flatMap((side) => {
    const matching = armyLists.filter((list) =>
      key(list.player) === key(side.player) &&
      key(list.opponent) === key(side.opponent) &&
      key(list.mission) === key(game.mission) &&
      Boolean(list.date && game.date && list.date.slice(0, 10) === game.date.slice(0, 10)),
    )
    const linked = matching.find((list) => String(list.id) === String(side.id || ''))
    if (linked) return [linked]
    // Older Form rows can reference a list from a different player. Only use
    // a full, unambiguous matchup match if the explicit ID does not fit.
    return matching.length === 1 ? matching : []
  }).filter((list, index, all) => all.findIndex((item) => String(item.id) === String(list.id)) === index)
}
