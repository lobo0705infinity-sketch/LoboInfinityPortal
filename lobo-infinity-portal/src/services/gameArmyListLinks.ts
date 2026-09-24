import type { RecentGame } from './api'
import type { PublicSubmittedArmyList } from './publicDetailProjection'
import { getGameSides } from './gameResults.ts'

const key = (value: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')

export function getGameArmyLists(game: RecentGame, armyLists: PublicSubmittedArmyList[]): PublicSubmittedArmyList[] {
  const [left, right] = getGameSides(game)
  const sides = [
    { player: left.player, opponent: right.player, id: left.listId },
    { player: right.player, opponent: left.player, id: right.listId },
  ]

  return sides.flatMap((side) => {
    const matching = armyLists.filter((list) =>
      key(list.player) === key(side.player) &&
      key(list.mission) === key(game.mission) &&
      Boolean(list.date && game.date && list.date.slice(0, 10) === game.date.slice(0, 10)),
    )
    // A newly submitted list can have its game ID while its opponent is still
    // blank. Trust the explicit list ID only when player, mission and day also
    // agree, and never accept an opponent that conflicts with this game.
    const linked = matching.find((list) =>
      String(side.id || '').trim() &&
      String(list.id) === String(side.id || '') &&
      (!key(list.opponent) || key(list.opponent) === key(side.opponent)),
    )
    if (linked) return [linked]
    // Older Form rows can reference a list from a different player. Only use
    // a full, unambiguous matchup match if the explicit ID does not fit.
    const fullMatch = matching.filter((list) => key(list.opponent) === key(side.opponent))
    return fullMatch.length === 1 ? fullMatch : []
  }).filter((list, index, all) => all.findIndex((item) => String(item.id) === String(list.id)) === index)
}
