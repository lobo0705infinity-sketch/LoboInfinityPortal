import type {
  CommissionerSchedulingData,
  MatchFinderData,
  SchedulingCenterData,
} from '../../api'
import type { ApiOptions } from '../../apiCore'

export interface SchedulingRepository {
  getCommissionerScheduling(
    options?: ApiOptions,
  ): Promise<CommissionerSchedulingData>
  getMatchFinder(options?: ApiOptions): Promise<MatchFinderData>
  getSchedulingCalendar(
    requestId: string,
    options?: ApiOptions,
  ): Promise<{ filename: string; ics: string }>
  getSchedulingCenter(options?: ApiOptions): Promise<SchedulingCenterData>
  updateAvailability(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<SchedulingCenterData>
  createRequest(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<SchedulingCenterData>
  respondToRequest(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<SchedulingCenterData>
}
