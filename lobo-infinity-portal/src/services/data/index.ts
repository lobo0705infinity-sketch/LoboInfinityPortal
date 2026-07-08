import type { DataProvider, DataProviderKind } from './DataProvider'
import { firestoreProvider } from './providers/FirestoreProvider'
import { googleSheetsProvider } from './providers/GoogleSheetsProvider'
import { mockProvider } from './providers/MockProvider'

const configuredProvider = (
  import.meta.env.VITE_DATA_PROVIDER ?? 'google'
).toLowerCase() as DataProviderKind

function selectDataProvider(provider: DataProviderKind): DataProvider {
  if (provider === 'firestore') {
    return firestoreProvider
  }

  if (provider === 'mock') {
    return mockProvider
  }

  return googleSheetsProvider
}

export const dataProvider = selectDataProvider(configuredProvider)

export const analyticsRepository = dataProvider.analytics
export const dashboardRepository = dataProvider.dashboard
export const eventRepository = dataProvider.events
export const gameRepository = dataProvider.games
export const notificationRepository = dataProvider.notifications
export const playerRepository = dataProvider.players
export const registrationRepository = dataProvider.registrations
export const schedulingRepository = dataProvider.scheduling
export const standingsRepository = dataProvider.standings
export const teamRepository = dataProvider.teams

export type { DataProvider, DataProviderKind } from './DataProvider'
export type { AnalyticsRepository } from './repositories/AnalyticsRepository'
export type { DashboardRepository } from './repositories/DashboardRepository'
export type { EventRepository } from './repositories/EventRepository'
export type { GameRepository } from './repositories/GameRepository'
export type { NotificationRepository } from './repositories/NotificationRepository'
export type { PlayerRepository } from './repositories/PlayerRepository'
export type { RegistrationRepository } from './repositories/RegistrationRepository'
export type { SchedulingRepository } from './repositories/SchedulingRepository'
export type { StandingsRepository } from './repositories/StandingsRepository'
export type { TeamRepository } from './repositories/TeamRepository'
