import type { FactionSummary, LeagueRecordValue, MissionSummary } from './api'
import type { DivisionStandings } from '../types/dashboard'
import { getPublicPlayersProjection } from './publicPlayersProjection'
import { getPublicSnapshotDataset } from './publicSnapshot'

export type PublicAnalyticsProjection = {
  factions: FactionSummary[]
  missions: MissionSummary[]
  players: DivisionStandings[]
  records: Record<string, LeagueRecordValue>
}

export async function getPublicAnalyticsProjection({
  signal,
}: {
  eventId: string
  gameType: string
  signal?: AbortSignal
}): Promise<PublicAnalyticsProjection> {
  const [factions, missions, players, statistics] = await Promise.all([
    getPublicSnapshotDataset<FactionSummary[]>('factions', signal),
    getPublicSnapshotDataset<MissionSummary[]>('missions', signal),
    getPublicPlayersProjection({ signal }),
    getPublicSnapshotDataset<Array<{ records: Record<string, LeagueRecordValue> }>>('statistics', signal),
  ])
  return { factions, missions, players, records: statistics[0]?.records ?? {} }
}
