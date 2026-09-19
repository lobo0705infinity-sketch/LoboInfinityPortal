import { getFactionGameObservations, summarizeFactionObservations } from './factionAnalytics.ts'
import type { PublicGame } from './snapshotTypes.ts'

export type MissionFactionPerformance = ReturnType<typeof summarizeFactionObservations> & { faction: string }

export function getMissionGames(mission: string, games: PublicGame[]) {
  return games
    .filter((game) => game.mission === mission)
    .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id)
}

export function buildMissionFactionPerformance(mission: string, games: PublicGame[]): MissionFactionPerformance[] {
  const missionGames = getMissionGames(mission, games)
  const factions = new Set(missionGames.flatMap((game) => [game.player1Faction, game.player2Faction]).filter(Boolean))
  return [...factions]
    .map((faction) => ({ faction, ...summarizeFactionObservations(getFactionGameObservations(faction, missionGames)) }))
    .sort((left, right) => right.games - left.games || right.wins - left.wins || left.faction.localeCompare(right.faction))
}
