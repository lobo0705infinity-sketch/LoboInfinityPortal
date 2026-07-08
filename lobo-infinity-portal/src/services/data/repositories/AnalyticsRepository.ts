import type {
  FactionProfileData,
  FactionSummary,
  HallOfFameData,
  LeagueIntelligenceData,
  LeagueRecordValue,
  MissionProfileData,
  MissionSummary,
} from '../../api'
import type { ApiOptions } from '../../apiCore'

export interface AnalyticsRepository {
  getAnalytics(options?: ApiOptions): Promise<LeagueIntelligenceData>
  getRecords(options?: ApiOptions): Promise<Record<string, LeagueRecordValue>>
  getHallOfFame(options?: ApiOptions): Promise<HallOfFameData>
  getFactions(options?: ApiOptions): Promise<FactionSummary[]>
  getFaction(
    factionName: string,
    options?: ApiOptions,
  ): Promise<FactionProfileData>
  getMissions(options?: ApiOptions): Promise<MissionSummary[]>
  getMission(
    missionName: string,
    options?: ApiOptions,
  ): Promise<MissionProfileData>
}
