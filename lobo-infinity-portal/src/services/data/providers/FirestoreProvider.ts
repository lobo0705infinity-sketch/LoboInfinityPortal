import type { DataProvider } from '../DataProvider'

function unavailable(method: string): never {
  throw new Error(
    `Firestore data provider is not configured. Implement ${method} before setting VITE_DATA_PROVIDER=firestore.`,
  )
}

export const firestoreProvider: DataProvider = {
  analytics: {
    getAnalytics: () => unavailable('AnalyticsRepository.getAnalytics'),
    getFaction: () => unavailable('AnalyticsRepository.getFaction'),
    getFactions: () => unavailable('AnalyticsRepository.getFactions'),
    getHallOfFame: () => unavailable('AnalyticsRepository.getHallOfFame'),
    getMission: () => unavailable('AnalyticsRepository.getMission'),
    getMissions: () => unavailable('AnalyticsRepository.getMissions'),
    getRecords: () => unavailable('AnalyticsRepository.getRecords'),
  },
  dashboard: {
    getCommunityCommandCenter: () =>
      unavailable('DashboardRepository.getCommunityCommandCenter'),
    getDashboard: () => unavailable('DashboardRepository.getDashboard'),
    getHome: () => unavailable('DashboardRepository.getHome'),
  },
  events: {
    getEventHome: () => unavailable('EventRepository.getEventHome'),
    getEventManager: () => unavailable('EventRepository.getEventManager'),
    getEvents: () => unavailable('EventRepository.getEvents'),
    saveEvent: () => unavailable('EventRepository.saveEvent'),
    savePairing: () => unavailable('EventRepository.savePairing'),
    saveParticipant: () => unavailable('EventRepository.saveParticipant'),
    saveTeam: () => unavailable('EventRepository.saveTeam'),
    setCurrentEvent: () => unavailable('EventRepository.setCurrentEvent'),
    setLifecycle: () => unavailable('EventRepository.setLifecycle'),
    setRegistration: () => unavailable('EventRepository.setRegistration'),
  },
  games: {
    getRecentGames: () => unavailable('GameRepository.getRecentGames'),
    submitArmyList: () => unavailable('GameRepository.submitArmyList'),
  },
  notifications: {
    getNotifications: () => unavailable('NotificationRepository.getNotifications'),
    updateNotificationState: () =>
      unavailable('NotificationRepository.updateNotificationState'),
  },
  players: {
    comparePlayers: () => unavailable('PlayerRepository.comparePlayers'),
    getAllPlayers: () => unavailable('PlayerRepository.getAllPlayers'),
    getCurrentPlayer: () => unavailable('PlayerRepository.getCurrentPlayer'),
    getPlayer: () => unavailable('PlayerRepository.getPlayer'),
    updateProfile: () => unavailable('PlayerRepository.updateProfile'),
  },
  registrations: {
    getRegistration: () => unavailable('RegistrationRepository.getRegistration'),
    manage: () => unavailable('RegistrationRepository.manage'),
    register: () => unavailable('RegistrationRepository.register'),
    withdraw: () => unavailable('RegistrationRepository.withdraw'),
  },
  scheduling: {
    createRequest: () => unavailable('SchedulingRepository.createRequest'),
    getCommissionerScheduling: () =>
      unavailable('SchedulingRepository.getCommissionerScheduling'),
    getMatchFinder: () => unavailable('SchedulingRepository.getMatchFinder'),
    getSchedulingCalendar: () =>
      unavailable('SchedulingRepository.getSchedulingCalendar'),
    getSchedulingCenter: () =>
      unavailable('SchedulingRepository.getSchedulingCenter'),
    respondToRequest: () => unavailable('SchedulingRepository.respondToRequest'),
    updateAvailability: () =>
      unavailable('SchedulingRepository.updateAvailability'),
  },
  standings: {
    getAllStandings: () => unavailable('StandingsRepository.getAllStandings'),
    getStandings: () => unavailable('StandingsRepository.getStandings'),
  },
  teams: {
    advanceRound: () => unavailable('TeamRepository.advanceRound'),
    getTeamTournament: () => unavailable('TeamRepository.getTeamTournament'),
    saveInvitation: () => unavailable('TeamRepository.saveInvitation'),
    savePairing: () => unavailable('TeamRepository.savePairing'),
    saveResult: () => unavailable('TeamRepository.saveResult'),
    saveTeam: () => unavailable('TeamRepository.saveTeam'),
  },
  metadata: {
    kind: 'firestore',
    name: 'Firestore Provider',
    storage: 'Firebase Firestore',
  },
}
