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

export type DataProviderKind = 'dual' | 'firestore' | 'google' | 'mock'

export type DataProviderHealth = {
  collectionCounts?: Record<string, number>
  collections?: string[]
  errors: string[]
  initialized: boolean
  latencyMs: number
  mode?: string
  projectId?: string
  provider: DataProviderKind
  region?: string
  schemaVersion?: number
  status: 'configured' | 'error' | 'healthy' | 'unconfigured'
}

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
  getHealth(): Promise<DataProviderHealth>
  metadata: DataProviderMetadata
}
