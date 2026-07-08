import type {
  CommunityCommandCenterData,
  HomeData,
} from '../../api'
import type { ApiOptions } from '../../apiCore'
import type { DashboardData } from '../../../types/dashboard'

export interface DashboardRepository {
  getCommunityCommandCenter(
    options?: ApiOptions,
  ): Promise<CommunityCommandCenterData>
  getDashboard(options?: ApiOptions): Promise<DashboardData>
  getHome(options?: ApiOptions): Promise<HomeData>
}
