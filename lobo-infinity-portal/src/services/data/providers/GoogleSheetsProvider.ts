import { apiClient } from '../../api'
import type { DataProvider } from '../DataProvider'

export const googleSheetsProvider: DataProvider = {
  analytics: {
    getAnalytics: apiClient.getAnalytics,
    getFaction: apiClient.getFaction,
    getFactions: apiClient.getFactions,
    getHallOfFame: apiClient.getHallOfFame,
    getMission: apiClient.getMission,
    getMissions: apiClient.getMissions,
    getRecords: apiClient.getRecords,
  },
  dashboard: {
    getCommunityCommandCenter: apiClient.getCommunityCommandCenter,
    getDashboard: apiClient.getDashboard,
    getHome: apiClient.getHome,
  },
  events: {
    getEventHome: apiClient.getEventHome,
    getLeagueOperations: apiClient.getLeagueOperations,
    getEventManager: apiClient.getEventManager,
    getEvents: apiClient.getEvents,
    saveEvent: apiClient.saveEventManagerEvent,
    savePairing: apiClient.saveEventManagerPairing,
    saveLeagueOperations: apiClient.saveLeagueOperations,
    saveParticipant: apiClient.saveEventManagerParticipant,
    saveTeam: apiClient.saveEventManagerTeam,
    setCurrentEvent: apiClient.setEventManagerCurrentEvent,
    setLifecycle: apiClient.setEventManagerLifecycle,
    setRegistration: apiClient.setEventManagerRegistration,
  },
  games: {
    getRecentGames: apiClient.getRecentGames,
    submitArmyList: apiClient.submitArmyList,
  },
  notifications: {
    getNotifications: apiClient.getNotifications,
    updateNotificationState: apiClient.updateNotificationState,
  },
  players: {
    comparePlayers: apiClient.getPlayerComparison,
    getAllPlayers: apiClient.getPlayers,
    getCurrentPlayer: apiClient.getMyProfile,
    getPlayer: apiClient.getPlayer,
    updateProfile: apiClient.updateProfile,
  },
  registrations: {
    getRegistration: apiClient.getEventRegistration,
    manage: apiClient.manageEventRegistration,
    register: apiClient.registerForEvent,
    withdraw: apiClient.withdrawEventRegistration,
  },
  scheduling: {
    createRequest: apiClient.createSchedulingRequest,
    getCommissionerScheduling: apiClient.getCommissionerScheduling,
    getMatchFinder: apiClient.getMatchFinder,
    getSchedulingCalendar: apiClient.getSchedulingCalendar,
    getSchedulingCenter: apiClient.getSchedulingCenter,
    respondToRequest: apiClient.respondSchedulingRequest,
    updateAvailability: apiClient.updateSchedulingAvailability,
  },
  standings: {
    getAllStandings: apiClient.getAllStandings,
    getStandings: apiClient.getStandings,
  },
  teams: {
    advanceRound: apiClient.advanceTeamTournamentRound,
    getTeamTournament: apiClient.getTeamTournament,
    saveInvitation: apiClient.saveTeamTournamentInvitation,
    savePairing: apiClient.saveTeamTournamentPairing,
    saveResult: apiClient.saveTeamTournamentResult,
    saveTeam: apiClient.saveTeamTournamentTeam,
  },
  getHealth: async () => ({
    errors: [],
    initialized: true,
    latencyMs: 0,
    mode: 'google-only',
    provider: 'google',
    status: 'healthy',
  }),
  metadata: {
    kind: 'google',
    name: 'Google Sheets Provider',
    storage: 'Apps Script + Google Sheets',
  },
}
