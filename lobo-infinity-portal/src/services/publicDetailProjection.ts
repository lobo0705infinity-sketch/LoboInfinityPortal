import type { ArmyIntelligenceFactionData, ArmyIntelligenceList, CommissionerNewsItem, RecentGame, StreamedGame, SubmittedArmyListEntry } from './api'
import { getPublicSnapshotDataset } from './publicSnapshot'

export type PublicSubmittedArmyList = SubmittedArmyListEntry & {
  sectorial?: string
}

export type PublicGameCommunityData = {
  armyLists: PublicSubmittedArmyList[]
  games: RecentGame[]
  rivalryGames: RecentGame[]
  news: CommissionerNewsItem[]
  streams: StreamedGame[]
}

type Community = { news: CommissionerNewsItem[]; streams: StreamedGame[] }
type SnapshotPlayer = Record<string, unknown> & { player: string }
type SnapshotFaction = Record<string, unknown> & { name: string; recentGames: Array<{ id: number }> }
type SnapshotMission = Record<string, unknown> & { mission: string; recentGames: Array<{ id: number }> }
type SnapshotStatistics = { playerCareers?: Array<Record<string, unknown> & { player?: string }> }

async function readGames(signal?: AbortSignal) {
  return getPublicSnapshotDataset<RecentGame[]>('games', signal)
}

function hydrateRecentGames(references: Array<{ id: number }> = [], games: RecentGame[]) {
  const ids = new Set(references.map((item) => item.id))
  return games.filter((game) => ids.has(game.id))
}

export const publicDetailProjection = {
  getGames: async (signal?: AbortSignal): Promise<PublicGameCommunityData> => {
    const [games, community, armyLists] = await Promise.all([
      readGames(signal),
      getPublicSnapshotDataset<Community[]>('community', signal),
      getPublicSnapshotDataset<PublicSubmittedArmyList[]>('army-lists', signal),
    ])
    return {
      armyLists,
      games,
      rivalryGames: games,
      news: community[0]?.news ?? [],
      streams: community[0]?.streams ?? [],
    }
  },
  getGameIntelligenceLists: async (signal?: AbortSignal): Promise<ArmyIntelligenceList[]> => {
    const intelligence = await getPublicSnapshotDataset<ArmyIntelligenceFactionData[]>('army-intelligence-detail', signal)
    return intelligence.flatMap((faction) => faction.lists)
  },
  getPlayer: async (name: string, signal?: AbortSignal) => {
    const [players, games, statistics] = await Promise.all([
      getPublicSnapshotDataset<SnapshotPlayer[]>('players', signal),
      readGames(signal),
      getPublicSnapshotDataset<SnapshotStatistics[]>('statistics', signal),
    ])
    const player = players.find((item) => item.player === name)
    if (!player) throw new Error('Player profile could not be loaded.')
    const career = statistics[0]?.playerCareers?.find((item) => item.player === name) ?? {}
    return {
      success: true,
      player: { ...career, ...player, name: player.player },
      recentGames: games.filter((game) => game.winner === name || game.loser === name),
      leagueModel: null,
    }
  },
  getFaction: async (name: string, signal?: AbortSignal) => {
    const [factions, games] = await Promise.all([
      getPublicSnapshotDataset<SnapshotFaction[]>('factions', signal),
      readGames(signal),
    ])
    const faction = factions.find((item) => item.name === name)
    if (!faction) throw new Error('Faction profile could not be loaded.')
    return { success: true, faction: { ...faction, recentGames: hydrateRecentGames(faction.recentGames, games) } }
  },
  getMission: async (name: string, signal?: AbortSignal) => {
    const [missions, games] = await Promise.all([
      getPublicSnapshotDataset<SnapshotMission[]>('missions', signal),
      readGames(signal),
    ])
    const mission = missions.find((item) => item.mission === name)
    if (!mission) throw new Error('Mission profile could not be loaded.')
    return { success: true, mission: { ...mission, recentGames: hydrateRecentGames(mission.recentGames, games) } }
  },
}
