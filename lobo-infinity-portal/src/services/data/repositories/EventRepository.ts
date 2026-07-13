import type {
  EventHomeData,
  LeagueOperationsData,
  EventManagerData,
} from '../../api'
import type { ApiOptions } from '../../apiCore'
import type { EventCatalog } from '../../../types/dashboard'

export interface EventRepository {
  getEvents(options?: ApiOptions): Promise<EventCatalog>
  getEventHome(eventId?: string, options?: ApiOptions): Promise<EventHomeData>
  getEventManager(eventId?: string, options?: ApiOptions): Promise<EventManagerData>
  getLeagueOperations(options?: ApiOptions): Promise<LeagueOperationsData>
  saveEvent(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventManagerData>
  setRegistration(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventManagerData>
  setLifecycle(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventManagerData>
  setCurrentEvent(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventManagerData>
  saveParticipant(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventManagerData>
  saveTeam(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventManagerData>
  savePairing(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<EventManagerData>
  saveLeagueOperations(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<LeagueOperationsData>
}
