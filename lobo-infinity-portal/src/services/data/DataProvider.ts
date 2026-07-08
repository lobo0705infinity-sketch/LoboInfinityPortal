import type { AnalyticsRepository } from './repositories/AnalyticsRepository'
import type { DashboardRepository } from './repositories/DashboardRepository'
import type { EventRepository } from './repositories/EventRepository'
import type { GameRepository } from './repositories/GameRepository'
import type { NotificationRepository } from './repositories/NotificationRepository'
import type { PlayerRepository } from './repositories/PlayerRepository'
import type { RegistrationRepository } from './repositories/RegistrationRepository'
import type { SchedulingRepository } from './repositories/SchedulingRepository'
import type { StandingsRepository } from './repositories/StandingsRepository'
import type { TeamRepository } from './repositories/TeamRepository'

export type DataProviderKind = 'google' | 'firestore' | 'mock'

export type DataProviderMetadata = {
  kind: DataProviderKind
  name: string
  storage: string
}

export interface DataProvider {
  analytics: AnalyticsRepository
  dashboard: DashboardRepository
  events: EventRepository
  games: GameRepository
  notifications: NotificationRepository
  players: PlayerRepository
  registrations: RegistrationRepository
  scheduling: SchedulingRepository
  standings: StandingsRepository
  teams: TeamRepository
  metadata: DataProviderMetadata
}
