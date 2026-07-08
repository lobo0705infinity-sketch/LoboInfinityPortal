import type { ArmyListSubmission, RecentGame } from '../../api'
import type { ApiOptions } from '../../apiCore'

export interface GameRepository {
  getRecentGames(options?: ApiOptions): Promise<RecentGame[]>
  submitArmyList(
    submission: ArmyListSubmission,
    options?: ApiOptions,
  ): Promise<void>
}
