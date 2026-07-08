import type { ApiOptions } from '../../apiCore'
import type { DivisionKey, DivisionStandings } from '../../../types/dashboard'

export interface StandingsRepository {
  getStandings(
    division: DivisionKey,
    options?: ApiOptions,
  ): Promise<DivisionStandings>
  getAllStandings(options?: ApiOptions): Promise<DivisionStandings[]>
}
