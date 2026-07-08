import type {
  MyProfileData,
  PlayerComparisonData,
  PlayerProfileData,
} from '../../api'
import type { ApiOptions } from '../../apiCore'
import type { DivisionStandings } from '../../../types/dashboard'

export interface PlayerRepository {
  getAllPlayers(options?: ApiOptions): Promise<DivisionStandings[]>
  getCurrentPlayer(options?: ApiOptions): Promise<MyProfileData>
  getPlayer(playerName: string, options?: ApiOptions): Promise<PlayerProfileData>
  comparePlayers(
    left: string,
    right: string,
    options?: ApiOptions,
  ): Promise<PlayerComparisonData>
  updateProfile(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<MyProfileData>
}
