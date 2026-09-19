import { publicLeagueWorkspace, getSnapshotStandings } from './publicLeagueWorkspaceProjection'
import { publicDetailProjection } from './publicDetailProjection'
import { publicArmyWorkspace } from './publicArmyWorkspaceProjection'
import { getPublicPlayersComparisonProjection, getPublicPlayersProjection } from './publicPlayersProjection'
import { getPublicEventProjection } from './publicEventProjection'
import { getPublicTeamTournamentProjection } from './publicTeamTournamentProjection'
import { getPublicSnapshotDataset } from './publicSnapshot'

type Options = { signal?: AbortSignal; eventId?: string; gameType?: string }
const data = <T>(name: any, options: Options = {}) => getPublicSnapshotDataset<T>(name, options.signal)

async function community(options: Options = {}) {
  return (await data<any[]>('community', options))[0] ?? {}
}

async function statistics(options: Options = {}) {
  return (await data<any[]>('statistics', options))[0] ?? {}
}

async function events(options: Options = {}) {
  return data<any[]>('events', options)
}

async function eventCatalog(options: Options = {}) {
  const list = await events(options)
  const currentEvent = list.find((event) => event.id === 'event-current-league') ?? list[0] ?? null
  return { currentEvent, events: list }
}

async function search(options: Options = {}) {
  const [players, factions, missions, games, armyLists, catalog] = await Promise.all([
    data<any[]>('players', options), data<any[]>('factions', options), data<any[]>('missions', options),
    data<any[]>('games', options), publicArmyWorkspace.getArmyLists(options.signal), eventCatalog(options),
  ])
  return { players, factions, missions, games, armyLists, events: catalog.events }
}

export const publicSnapshotApi: any = {
  getDashboard: (options: Options = {}) => publicLeagueWorkspace.getDashboard(options.signal),
  getHome: async (options: Options = {}) => ({ dashboard: await publicLeagueWorkspace.getDashboard(options.signal), toPlayer: '', updatedAt: '' }),
  getLeader: async (options: Options = {}) => ({ leagueLeader: (await publicLeagueWorkspace.getDashboard(options.signal)).summary.leagueLeader }),
  getRecentGames: (options: Options = {}) => data<any[]>('games', options),
  getSubmittedArmyListLibrary: (options: Options = {}) => publicArmyWorkspace.getArmyLists(options.signal),
  getEvents: eventCatalog,
  getStandings: (division: any, options: Options = {}) => publicLeagueWorkspace.getStandings(division, options.signal),
  getAllStandings: (options: Options = {}) => getSnapshotStandings(options.signal),
  getPlayers: (options: Options = {}) => getPublicPlayersProjection({ signal: options.signal }),
  getSearchData: search,
  getSearchIndex: search,
  getPlayer: async (name: string, options: Options = {}) => (await publicDetailProjection.getPlayer(name, options.signal)).player,
  getFactions: (options: Options = {}) => data<any[]>('factions', options),
  getFaction: async (name: string, options: Options = {}) => (await publicDetailProjection.getFaction(name, options.signal)).faction,
  getMissions: (options: Options = {}) => data<any[]>('missions', options),
  getMission: async (name: string, options: Options = {}) => (await publicDetailProjection.getMission(name, options.signal)).mission,
  getAnalytics: async (options: Options = {}) => {
    const [factions, missions, players, stats] = await Promise.all([data<any[]>('factions', options), data<any[]>('missions', options), getPublicPlayersProjection({ signal: options.signal }), statistics(options)])
    return { factions, missions, players, records: stats.records ?? {}, ...stats }
  },
  getNews: async (options: Options = {}) => (await community(options)).news ?? [],
  getNotifications: async (options: Options = {}) => (await community(options)).notifications ?? [],
  getTimeline: async (options: Options = {}) => (await community(options)).timeline ?? [],
  getRecords: async (options: Options = {}) => (await statistics(options)).records ?? {},
  getHallOfFame: statistics,
  getPlayerComparison: async (left: string, right: string, options: Options = {}) => (await getPublicPlayersComparisonProjection({ signal: options.signal })).getComparison(left, right),
  getSettings: async (options: Options = {}) => (await community(options)).settings ?? {},
  getStreams: async (options: Options = {}) => (await community(options)).streams ?? [],
  getArmyLists: async (options: Options = {}) => ({ lists: await publicArmyWorkspace.getArmyLists(options.signal) }),
  getArmyIntelligence: (options: Options = {}) => publicArmyWorkspace.getIntelligenceSummary(options.signal),
  getArmyIntelligenceSummary: (options: Options = {}) => publicArmyWorkspace.getIntelligenceSummary(options.signal),
  getArmyIntelligenceFaction: (faction: string, options: Options = {}) => publicArmyWorkspace.getIntelligenceFaction(faction, options.signal),
  getCommunityCommandCenter: community,
  getSchedulingCenter: async (options: Options = {}) => (await data<any[]>('schedule', options))[0] ?? {},
  getTeamTournament: (eventId: string, options: Options = {}) => getPublicTeamTournamentProjection({ eventId, signal: options.signal }),
  getEventRegistration: async (eventId: string, options: Options = {}) => (await getPublicEventProjection(eventId, options)).home.registration,
  getEventHome: async (eventId: string, options: Options = {}) => (await getPublicEventProjection(eventId, options)).home,
  getEventBracket: async (eventId: string, options: Options = {}) => (await getPublicEventProjection(eventId, options)).bracket,
  getLeagueOperations: (options: Options = {}) => publicLeagueWorkspace.getLeagueOperations(options.signal),
}
