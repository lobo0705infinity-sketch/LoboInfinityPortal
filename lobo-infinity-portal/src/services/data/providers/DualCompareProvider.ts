import type { DataProvider, DataProviderHealth } from '../DataProvider'
import { firestoreProvider } from './FirestoreProvider'
import { googleSheetsProvider } from './GoogleSheetsProvider'

export type ProviderComparisonMetric = {
  durationMs: number
  error: string
  method: string
  mismatch: boolean
  repository: string
  timestamp: number
}

const comparisonMetrics: ProviderComparisonMetric[] = []

function wrapRead(repository: keyof DataProvider, method: string) {
  return async (...args: unknown[]) => {
    const startedAt = performance.now()
    const googleRepository = googleSheetsProvider[repository] as Record<string, unknown>
    const firestoreRepository = firestoreProvider[repository] as Record<string, unknown>
    const googleMethod = googleRepository[method]
    const firestoreMethod = firestoreRepository[method]

    if (typeof googleMethod !== 'function') {
      throw new Error(`Google provider does not implement ${String(method)}.`)
    }

    const googleResult = await googleMethod(...args)

    if (typeof firestoreMethod === 'function') {
      void Promise.resolve()
        .then(() => firestoreMethod(...args))
        .then((firestoreResult) => {
          recordComparison({
            durationMs: performance.now() - startedAt,
            error: '',
            method,
            mismatch: !isEquivalent(googleResult, firestoreResult),
            repository: String(repository),
            timestamp: Date.now(),
          })
        })
        .catch((error: unknown) => {
          recordComparison({
            durationMs: performance.now() - startedAt,
            error: error instanceof Error ? error.message : 'Firestore compare failed.',
            method,
            mismatch: true,
            repository: String(repository),
            timestamp: Date.now(),
          })
        })
    }

    return googleResult
  }
}

function wrapWrite(repository: keyof DataProvider, method: string) {
  return async (...args: unknown[]) => {
    const googleRepository = googleSheetsProvider[repository] as Record<string, unknown>
    const googleMethod = googleRepository[method]

    if (typeof googleMethod !== 'function') {
      throw new Error(`Google provider does not implement ${String(method)}.`)
    }

    return googleMethod(...args)
  }
}

export const dualCompareProvider: DataProvider = {
  analytics: {
    getAnalytics: wrapRead('analytics', 'getAnalytics'),
    getFaction: wrapRead('analytics', 'getFaction'),
    getFactions: wrapRead('analytics', 'getFactions'),
    getHallOfFame: wrapRead('analytics', 'getHallOfFame'),
    getMission: wrapRead('analytics', 'getMission'),
    getMissions: wrapRead('analytics', 'getMissions'),
    getRecords: wrapRead('analytics', 'getRecords'),
  },
  dashboard: {
    getCommunityCommandCenter: wrapRead('dashboard', 'getCommunityCommandCenter'),
    getDashboard: wrapRead('dashboard', 'getDashboard'),
    getHome: wrapRead('dashboard', 'getHome'),
  },
  events: {
    getEventHome: wrapRead('events', 'getEventHome'),
    getLeagueOperations: wrapRead('events', 'getLeagueOperations'),
    getEventManager: wrapRead('events', 'getEventManager'),
    getEvents: wrapRead('events', 'getEvents'),
    saveEvent: wrapWrite('events', 'saveEvent'),
    savePairing: wrapWrite('events', 'savePairing'),
    saveLeagueOperations: wrapWrite('events', 'saveLeagueOperations'),
    saveParticipant: wrapWrite('events', 'saveParticipant'),
    saveTeam: wrapWrite('events', 'saveTeam'),
    setCurrentEvent: wrapWrite('events', 'setCurrentEvent'),
    setLifecycle: wrapWrite('events', 'setLifecycle'),
    setRegistration: wrapWrite('events', 'setRegistration'),
  },
  games: {
    getRecentGames: wrapRead('games', 'getRecentGames'),
    submitArmyList: wrapWrite('games', 'submitArmyList'),
  },
  notifications: {
    getNotifications: wrapRead('notifications', 'getNotifications'),
    updateNotificationState: wrapWrite('notifications', 'updateNotificationState'),
  },
  players: {
    comparePlayers: wrapRead('players', 'comparePlayers'),
    getAllPlayers: wrapRead('players', 'getAllPlayers'),
    getCurrentPlayer: wrapRead('players', 'getCurrentPlayer'),
    getPlayer: wrapRead('players', 'getPlayer'),
    updateProfile: wrapWrite('players', 'updateProfile'),
  },
  registrations: {
    getRegistration: wrapRead('registrations', 'getRegistration'),
    manage: wrapWrite('registrations', 'manage'),
    register: wrapWrite('registrations', 'register'),
    withdraw: wrapWrite('registrations', 'withdraw'),
  },
  scheduling: {
    createRequest: wrapWrite('scheduling', 'createRequest'),
    getCommissionerScheduling: wrapRead('scheduling', 'getCommissionerScheduling'),
    getMatchFinder: wrapRead('scheduling', 'getMatchFinder'),
    getSchedulingCalendar: wrapRead('scheduling', 'getSchedulingCalendar'),
    getSchedulingCenter: wrapRead('scheduling', 'getSchedulingCenter'),
    respondToRequest: wrapWrite('scheduling', 'respondToRequest'),
    updateAvailability: wrapWrite('scheduling', 'updateAvailability'),
  },
  standings: {
    getAllStandings: wrapRead('standings', 'getAllStandings'),
    getStandings: wrapRead('standings', 'getStandings'),
  },
  teams: {
    advanceRound: wrapWrite('teams', 'advanceRound'),
    getTeamTournament: wrapRead('teams', 'getTeamTournament'),
    saveInvitation: wrapWrite('teams', 'saveInvitation'),
    savePairing: wrapWrite('teams', 'savePairing'),
    saveResult: wrapWrite('teams', 'saveResult'),
    saveTeam: wrapWrite('teams', 'saveTeam'),
  },
  getHealth: async (): Promise<DataProviderHealth> => {
    const [google, firestore] = await Promise.all([
      googleSheetsProvider.getHealth(),
      firestoreProvider.getHealth(),
    ])

    return {
      collectionCounts: firestore.collectionCounts,
      collections: firestore.collections,
      errors: [...google.errors, ...firestore.errors],
      initialized: google.initialized && firestore.initialized,
      latencyMs: google.latencyMs + firestore.latencyMs,
      mode: 'dual-compare',
      projectId: firestore.projectId,
      provider: 'dual',
      region: firestore.region,
      schemaVersion: firestore.schemaVersion,
      status: firestore.status === 'healthy' ? 'healthy' : firestore.status,
    }
  },
  metadata: {
    kind: 'dual',
    name: 'Dual Compare Provider',
    storage: 'Google Sheets primary, Firestore comparison',
  },
}

export function getProviderComparisonDiagnostics() {
  return {
    recent: comparisonMetrics.slice(-25),
    total: comparisonMetrics.length,
    mismatches: comparisonMetrics.filter((metric) => metric.mismatch).length,
  }
}

function recordComparison(metric: ProviderComparisonMetric) {
  comparisonMetrics.push({
    ...metric,
    durationMs: Math.round(metric.durationMs),
  })

  if (comparisonMetrics.length > 100) {
    comparisonMetrics.splice(0, comparisonMetrics.length - 100)
  }
}

function isEquivalent(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
