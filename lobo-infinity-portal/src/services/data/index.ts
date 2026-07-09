import type { DataProvider, DataProviderKind } from './DataProvider'
import type { DataProviderHealth } from './DataProvider'
import { getFirebaseEnvironmentDiagnostics } from '../../firebase/firebaseConfig'
import {
  dualCompareProvider,
  getProviderComparisonDiagnostics,
} from './providers/DualCompareProvider'
import { firestoreProvider } from './providers/FirestoreProvider'
import {
  firestoreAccessMatrix,
  firestoreSecurityRulesVersion,
  getFirestoreBootstrapReport,
  type FirestoreBootstrapReport,
} from './providers/FirestoreBootstrap'
import {
  getLastFirestoreDataMigrationReport,
  runFirestoreDataMigration,
} from './providers/FirestoreMigrationService'
import {
  getMigrationVerificationReport,
  type MigrationVerificationReport,
} from './providers/FirestoreMigrationVerification'
import { googleSheetsProvider } from './providers/GoogleSheetsProvider'
import { mockProvider } from './providers/MockProvider'

const configuredProvider = (
  import.meta.env.VITE_DATA_PROVIDER ?? 'google'
).toLowerCase() as DataProviderKind

function selectDataProvider(provider: DataProviderKind): DataProvider {
  if (provider === 'dual') {
    return dualCompareProvider
  }

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

export async function getDataProviderDiagnostics() {
  const [bootstrap, health, migration] = await Promise.all([
    withTimeout(
      getFirestoreBootstrapReport(),
      10_000,
      createBootstrapFailure('Firestore bootstrap timed out after 10 seconds.'),
    ),
    withTimeout(
      dataProvider.getHealth(),
      10_000,
      createProviderHealthFailure('Provider health check timed out after 10 seconds.'),
    ),
    withTimeout(
      getMigrationVerificationReport(),
      15_000,
      createMigrationVerificationFailure(
        'Migration verification timed out after 15 seconds.',
      ),
    ),
  ])

  return {
    active: dataProvider.metadata,
    bootstrap,
    comparison: getProviderComparisonDiagnostics(),
    health,
    migrationRun: getLastFirestoreDataMigrationReport(),
    migration,
  }
}

export async function runDataMigrationToFirestore() {
  return runFirestoreDataMigration()
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  return new Promise<T>((resolve) => {
    const timeout = window.setTimeout(() => resolve(fallback), timeoutMs)

    promise
      .then((value) => resolve(value))
      .catch((error: unknown) => {
        resolve(
          typeof fallback === 'object' && fallback !== null
            ? {
                ...fallback,
                errors: [
                  readError(error, 'Provider diagnostics failed.'),
                ],
              }
            : fallback,
        )
      })
      .finally(() => window.clearTimeout(timeout))
  })
}

function createProviderHealthFailure(message: string): DataProviderHealth {
  return {
    errors: [message],
    initialized: false,
    latencyMs: 0,
    provider: configuredProvider,
    status: 'error',
  }
}

function createBootstrapFailure(message: string): FirestoreBootstrapReport {
  const environment = getFirebaseEnvironmentDiagnostics()

  return {
    accessMatrix: firestoreAccessMatrix,
    authentication: fail('FAILED: Firebase Auth check did not complete.'),
    collectionsInitialized: fail('BOOTSTRAP REQUIRED: Collections were not verified.'),
    connection: fail(`FAILED: ${message}`),
    environment,
    errors: [message],
    fallback: {
      active: true,
      message: 'Firestore unavailable. Google Sheets remains active. No production impact.',
      provider: 'Google Sheets',
    },
    generatedAt: new Date().toISOString(),
    indexes: warn('CONNECTING: Index verification did not complete.'),
    latencyMs: 0,
    overallHealth: 'FAIL',
    projectId: '',
    provider: String(import.meta.env.VITE_DATA_PROVIDER ?? 'google'),
    readTest: fail('FAILED: Read probe did not complete.'),
    region: String(import.meta.env.VITE_FIREBASE_REGION ?? 'default'),
    schema: {
      ...fail('BOOTSTRAP REQUIRED: Schema was not verified.'),
      version: 0,
    },
    security: warn('CONNECTING: Security status was not verified.'),
    securityRulesVersion: firestoreSecurityRulesVersion,
    seed: fail('BOOTSTRAP REQUIRED: Seed data was not verified.'),
    sdk: fail('FAILED: Firebase SDK check did not complete.'),
    user: {
      email: '',
      role: 'Unknown',
      signedIn: false,
    },
    writeTest: fail('FAILED: Write probe did not complete.'),
  }
}

function createMigrationVerificationFailure(
  message: string,
): MigrationVerificationReport {
  return {
    differences: [
      {
        field: 'diagnostics',
        firestoreValue: 'FAILED',
        googleValue: 'UNKNOWN',
        method: 'getMigrationVerificationReport',
        repository: 'diagnostics',
        severity: 'critical',
        timestamp: new Date().toISOString(),
      },
    ],
    firestoreComplete: {
      collections: [],
      missingCollections: [
        'events',
        'players',
        'games',
        'registrations',
        'teams',
        'pairings',
        'notifications',
        'missions',
        'factions',
        'analytics',
        'settings',
      ],
      status: 'FAIL',
    },
    generatedAt: new Date().toISOString(),
    lastVerification: new Date().toISOString(),
    migrationProgress: 0,
    mismatchCount: 1,
    overallReadiness: 'BLOCKED',
    performance: {
      firestore: {
        averageMs: 0,
        medianMs: 0,
        p95Ms: 0,
      },
      google: {
        averageMs: 0,
        medianMs: 0,
        p95Ms: 0,
      },
    },
    provider: {
      active: String(import.meta.env.VITE_DATA_PROVIDER ?? 'google'),
      firestore: 'FAILED',
      google: 'UNKNOWN',
      mode: String(import.meta.env.VITE_DATA_PROVIDER ?? 'google'),
    },
    repositories: [
      {
        averageLatencyMs: 0,
        firestoreLatencyMs: 0,
        googleLatencyMs: 0,
        lastVerified: new Date().toISOString(),
        methodCount: 0,
        mismatchCount: 1,
        p95LatencyMs: 0,
        repository: 'diagnostics',
        status: 'ERROR',
      },
    ],
    rollback: {
      available: true,
      instruction: 'Set VITE_DATA_PROVIDER=google and redeploy.',
    },
    synchronization: {
      mismatchRate: 100,
      readSuccess: 0,
      replicationLatencyMs: 0,
      writeSuccess: message,
    },
  }
}

function fail(detail: string) {
  return {
    detail,
    status: 'FAIL' as const,
  }
}

function warn(detail: string) {
  return {
    detail,
    status: 'WARN' as const,
  }
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

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
