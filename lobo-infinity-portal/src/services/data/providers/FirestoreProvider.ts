import type { DataProvider, DataProviderHealth } from '../DataProvider'

async function provider() {
  const module = await import('./FirestoreProviderImpl')
  return module.firestoreProviderImpl
}

function callRepository<
  TRepository extends keyof DataProvider,
  TMethod extends keyof DataProvider[TRepository],
>(repository: TRepository, method: TMethod) {
  return async (...args: unknown[]) => {
    const activeProvider = await provider()
    const targetRepository = activeProvider[repository] as Record<string, unknown>
    const targetMethod = targetRepository[method as string]

    if (typeof targetMethod !== 'function') {
      throw new Error(`Firestore provider does not implement ${String(method)}.`)
    }

    return targetMethod(...args)
  }
}

export const firestoreProvider: DataProvider = {
  analytics: {
    getAnalytics: callRepository('analytics', 'getAnalytics'),
    getFaction: callRepository('analytics', 'getFaction'),
    getFactions: callRepository('analytics', 'getFactions'),
    getHallOfFame: callRepository('analytics', 'getHallOfFame'),
    getMission: callRepository('analytics', 'getMission'),
    getMissions: callRepository('analytics', 'getMissions'),
    getRecords: callRepository('analytics', 'getRecords'),
  },
  dashboard: {
    getCommunityCommandCenter: callRepository(
      'dashboard',
      'getCommunityCommandCenter',
    ),
    getDashboard: callRepository('dashboard', 'getDashboard'),
    getHome: callRepository('dashboard', 'getHome'),
  },
  events: {
    getEventHome: callRepository('events', 'getEventHome'),
    getEventManager: callRepository('events', 'getEventManager'),
    getEvents: callRepository('events', 'getEvents'),
    saveEvent: callRepository('events', 'saveEvent'),
    savePairing: callRepository('events', 'savePairing'),
    saveParticipant: callRepository('events', 'saveParticipant'),
    saveTeam: callRepository('events', 'saveTeam'),
    setCurrentEvent: callRepository('events', 'setCurrentEvent'),
    setLifecycle: callRepository('events', 'setLifecycle'),
    setRegistration: callRepository('events', 'setRegistration'),
  },
  games: {
    getRecentGames: callRepository('games', 'getRecentGames'),
    submitArmyList: callRepository('games', 'submitArmyList'),
  },
  notifications: {
    getNotifications: callRepository('notifications', 'getNotifications'),
    updateNotificationState: callRepository(
      'notifications',
      'updateNotificationState',
    ),
  },
  players: {
    comparePlayers: callRepository('players', 'comparePlayers'),
    getAllPlayers: callRepository('players', 'getAllPlayers'),
    getCurrentPlayer: callRepository('players', 'getCurrentPlayer'),
    getPlayer: callRepository('players', 'getPlayer'),
    updateProfile: callRepository('players', 'updateProfile'),
  },
  registrations: {
    getRegistration: callRepository('registrations', 'getRegistration'),
    manage: callRepository('registrations', 'manage'),
    register: callRepository('registrations', 'register'),
    withdraw: callRepository('registrations', 'withdraw'),
  },
  scheduling: {
    createRequest: callRepository('scheduling', 'createRequest'),
    getCommissionerScheduling: callRepository(
      'scheduling',
      'getCommissionerScheduling',
    ),
    getMatchFinder: callRepository('scheduling', 'getMatchFinder'),
    getSchedulingCalendar: callRepository('scheduling', 'getSchedulingCalendar'),
    getSchedulingCenter: callRepository('scheduling', 'getSchedulingCenter'),
    respondToRequest: callRepository('scheduling', 'respondToRequest'),
    updateAvailability: callRepository('scheduling', 'updateAvailability'),
  },
  standings: {
    getAllStandings: callRepository('standings', 'getAllStandings'),
    getStandings: callRepository('standings', 'getStandings'),
  },
  teams: {
    advanceRound: callRepository('teams', 'advanceRound'),
    getTeamTournament: callRepository('teams', 'getTeamTournament'),
    saveInvitation: callRepository('teams', 'saveInvitation'),
    savePairing: callRepository('teams', 'savePairing'),
    saveResult: callRepository('teams', 'saveResult'),
    saveTeam: callRepository('teams', 'saveTeam'),
  },
  getHealth: async (): Promise<DataProviderHealth> => {
    const activeProvider = await provider()
    return activeProvider.getHealth()
  },
  metadata: {
    kind: 'firestore',
    name: 'Firestore Provider',
    storage: 'Firebase Firestore',
  },
}
