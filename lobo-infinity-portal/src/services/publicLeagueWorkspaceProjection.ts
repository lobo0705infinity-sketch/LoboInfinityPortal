import type { DashboardData, DivisionKey, DivisionStandings } from '../types/dashboard'
import type { FactionSummary, LeagueOperationsData, MissionSummary } from './api'
import { getPublicSnapshotDataset } from './publicSnapshot'

type SnapshotStanding = DivisionStandings['standings'][number]
type SnapshotDivision = {
  activePlayers: number
  division: string
  divisionLabel: string
  eventId: string
  gamesPlayed: number
  players: number
  standings: SnapshotStanding[]
}

const divisionKeys: Record<string, DivisionKey> = {
  'Main Man': 'main',
  'Proving Grounds A': 'pga',
  'Proving Grounds B': 'pgb',
  Casual: 'casual',
}

export async function getSnapshotStandings(signal?: AbortSignal): Promise<DivisionStandings[]> {
  const divisions = await getPublicSnapshotDataset<SnapshotDivision[]>('standings', signal)
  return divisions.map((division) => ({
    division: divisionKeys[division.divisionLabel] ?? 'casual',
    divisionLabel: division.divisionLabel,
    eventId: division.eventId,
    standings: division.standings.map((row) => ({ ...row, division: division.divisionLabel })),
    summary: {
      activePlayers: division.activePlayers,
      gamesPlayed: division.gamesPlayed,
      leader: division.standings[0] ?? null,
      players: division.players,
    },
  }))
}

export const publicLeagueWorkspace = {
  getDashboard: async (signal?: AbortSignal): Promise<DashboardData> => {
    const [divisions, factions, schedule] = await Promise.all([
      getSnapshotStandings(signal),
      getPublicSnapshotDataset<FactionSummary[]>('factions', signal),
      getPublicSnapshotDataset<Array<{ missions: Array<{ mission: string }> }>>('schedule', signal),
    ])
    const main = divisions.find((division) => division.division === 'main') ?? divisions[0]
    return {
      currentOperationsMissions: (schedule[0]?.missions ?? []).map((item) => item.mission),
      summary: {
        activePlayers: divisions.reduce((total, division) => total + division.summary.activePlayers, 0),
        gamesPlayed: divisions.reduce((total, division) => total + division.summary.gamesPlayed, 0),
        leagueLeader: main?.standings[0]?.displayName ?? '',
        topFaction: [...factions].sort((a, b) => b.games - a.games)[0]?.name ?? '',
      },
      standings: main?.standings ?? [],
      leagueOverview: {
        divisions: divisions.map((division) => ({
          division: division.division,
          divisionLabel: division.divisionLabel,
          ...division.summary,
        })),
        totalActivePlayers: divisions.reduce((total, division) => total + division.summary.activePlayers, 0),
        totalLeagueGames: divisions.reduce((total, division) => total + division.summary.gamesPlayed, 0),
      },
    }
  },
  getFactions: (signal?: AbortSignal) =>
    getPublicSnapshotDataset<FactionSummary[]>('factions', signal),
  getMissions: (_scope: string, signal?: AbortSignal) =>
    getPublicSnapshotDataset<MissionSummary[]>('missions', signal),
  getLeagueOperations: async (signal?: AbortSignal): Promise<LeagueOperationsData> => {
    const schedule = await getPublicSnapshotDataset<Array<{
      missions: LeagueOperationsData['missions']
      updatedAt: string
      weekNumber: string
    }>>('schedule', signal)
    return {
      missionOptions: [],
      missions: schedule[0]?.missions ?? [],
      updatedAt: schedule[0]?.updatedAt ?? '',
      updatedBy: '',
      weekNumber: schedule[0]?.weekNumber ?? '',
    }
  },
  getStandings: async (division: DivisionKey, signal?: AbortSignal) => {
    const divisions = await getSnapshotStandings(signal)
    const selected = divisions.find((item) => item.division === division)
    if (!selected) throw new Error('Snapshot standings are unavailable for this division.')
    return selected
  },
}
