import type { EventRegistrationData } from '../../api'
import type { ApiOptions } from '../../apiCore'

export interface RegistrationRepository {
  getRegistration(
    eventId?: string,
    options?: ApiOptions,
  ): Promise<EventRegistrationData>
  register(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventRegistrationData>
  withdraw(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventRegistrationData>
  manage(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventRegistrationData>
}
