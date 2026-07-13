import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import { getFirebaseRuntime, getFirebaseRuntimeConfig } from '../../../firebase/firebaseConfig'
import type {
  CommunityCommandCenterData,
  EventRegistrationData,
  EventRegistrationEntry,
  FactionProfileData,
  FactionSummary,
  HallOfFameData,
  LeagueIntelligenceData,
  LeagueNotification,
  MatchFinderData,
  MissionProfileData,
  MissionSummary,
  MyProfileData,
  PlayerComparisonData,
  PlayerCareerSummary,
  PlayerProfileData,
  RecentGame,
  SchedulingCenterData,
  TeamTournamentData,
  TeamTournamentInvitation,
  TeamTournamentPairing,
  TeamTournamentResult,
  TeamTournamentTeam,
} from '../../api'
import type { DataProvider, DataProviderHealth } from '../DataProvider'
import {
  firestorePortalVersion,
  initializeFirestoreSchema,
} from './firestoreSchema'
import type {
  DivisionKey,
  DivisionStandings,
  LeagueEvent,
  Standing,
} from '../../../types/dashboard'

const defaultEventId = 'event-current-league'
const defaultTournamentEventId = 'event-august-2026-team-tournament'

let initialization: Promise<{
  db: Firestore
  health: DataProviderHealth
}> | null = null

async function initializeFirestoreProvider() {
  if (initialization) {
    return initialization
  }

  initialization = (async () => {
    const config = getFirebaseRuntimeConfig()

    if (!config) {
      return {
        db: null as unknown as Firestore,
        health: {
          errors: ['Firebase environment variables are not configured.'],
          initialized: false,
          latencyMs: 0,
          provider: 'firestore',
          status: 'unconfigured',
        } satisfies DataProviderHealth,
      }
    }

    try {
      const runtime = getFirebaseRuntime()
      const schema = await initializeFirestoreSchema(runtime.db, config.projectId)

      return {
        db: runtime.db,
        health: {
          collectionCounts: schema.collectionCounts,
          collections: schema.collections,
          errors: schema.status === 'healthy' ? [] : ['Firestore schema check failed.'],
          initialized: schema.initialized,
          latencyMs: schema.latencyMs,
          projectId: schema.projectId,
          provider: 'firestore',
          region: import.meta.env.VITE_FIREBASE_REGION ?? 'default',
          schemaVersion: schema.schemaVersion,
          status: schema.status,
        } satisfies DataProviderHealth,
      }
    } catch (error) {
      return {
        db: null as unknown as Firestore,
        health: {
          errors: [error instanceof Error ? error.message : 'Firestore initialization failed.'],
          initialized: false,
          latencyMs: 0,
          provider: 'firestore',
          status: 'error',
        } satisfies DataProviderHealth,
      }
    }
  })()

  return initialization
}

async function getDb() {
  const { db, health } = await initializeFirestoreProvider()

  if (health.status !== 'healthy' && health.status !== 'configured') {
    throw new Error(health.errors[0] || 'Firestore provider is not healthy.')
  }

  return db
}

async function readCollection<T>(
  collectionName: string,
  mapper: (id: string, data: DocumentData) => T,
) {
  const db = await getDb()
  const snapshot = await getDocs(collection(db, collectionName))

  return snapshot.docs
    .filter((item) => item.id !== '__schema')
    .map((item) => mapper(item.id, item.data()))
}

async function readEvent(eventId = defaultEventId): Promise<LeagueEvent> {
  const db = await getDb()
  const snapshot = await getDoc(doc(db, 'events', eventId))

  if (snapshot.exists()) {
    return normalizeEvent(snapshot.id, snapshot.data())
  }

  return createDefaultEvent(eventId)
}

async function readEvents(): Promise<LeagueEvent[]> {
  const events = await readCollection('events', normalizeEvent)

  if (events.length > 0) {
    return events
  }

  return [createDefaultEvent()]
}

async function readCurrentEventId() {
  const db = await getDb()
  const snapshot = await getDoc(doc(db, 'settings', 'currentEvent'))
  const value = readString(snapshot.data() ?? {}, 'eventId')

  return value || defaultEventId
}

async function readRegistrations(eventId: string) {
  const db = await getDb()
  const snapshot = await getDocs(
    query(collection(db, 'registrations'), where('eventId', '==', eventId)),
  )

  return snapshot.docs
    .filter((item) => item.id !== '__schema')
    .map((item) => normalizeRegistration(item.id, item.data(), eventId))
}

async function readTeams(eventId: string) {
  const db = await getDb()
  const snapshot = await getDocs(
    query(collection(db, 'teams'), where('eventId', '==', eventId)),
  )

  return snapshot.docs
    .filter((item) => item.id !== '__schema')
    .map((item) => normalizeTeam(item.id, item.data(), eventId))
}

async function readPairings(eventId: string) {
  const db = await getDb()
  const snapshot = await getDocs(
    query(collection(db, 'pairings'), where('eventId', '==', eventId)),
  )

  return snapshot.docs
    .filter((item) => item.id !== '__schema')
    .map((item) => normalizePairing(item.id, item.data(), eventId))
}

async function readNotifications() {
  try {
    const db = await getDb()
    const snapshot = await getDocs(
      query(collection(db, 'notifications'), orderBy('timestamp', 'desc')),
    )

    return snapshot.docs
      .filter((item) => item.id !== '__schema')
      .map((item) => normalizeNotification(item.id, item.data()))
  } catch {
    return []
  }
}

async function readGames(eventId?: string): Promise<RecentGame[]> {
  const games = await readCollection('games', normalizeRecentGame)

  return eventId ? games.filter((game) => game.eventId === eventId) : games
}

async function buildRegistrationData(
  eventId: string,
  event?: LeagueEvent,
): Promise<EventRegistrationData> {
  const targetEvent = event ?? (await readEvent(eventId))
  const registrations = await readRegistrations(eventId)
  const registered = registrations.filter((entry) =>
    ['Approved', 'Registered'].includes(entry.status),
  )
  const teams = groupRegistrationTeams(registered)

  return {
    capacity: {
      maximumPlayers: 0,
      maximumTeams: 0,
      unlimited: true,
      waitlistEnabled: true,
    },
    captains: registered.filter((entry) => entry.captain),
    currentPlayer: null,
    eventId,
    eventName: targetEvent.name,
    eventType: targetEvent.type,
    freeAgents: registered.filter((entry) => entry.freeAgent),
    registeredCount: registered.length,
    registrationOpen: targetEvent.registration === 'Registration Open',
    registrationWindow: {
      endDate: targetEvent.endDate,
      startDate: targetEvent.startDate,
    },
    registrations,
    status: targetEvent.registration || 'Registration Closed',
    teamCount: teams.length,
    teams,
    waitlistCount: registrations.filter((entry) => entry.status === 'Waitlisted').length,
  }
}

async function buildTeamTournamentData(
  eventId = defaultTournamentEventId,
): Promise<TeamTournamentData> {
  const event = await readEvent(eventId)
  const registration = await buildRegistrationData(eventId, event)
  const teams = await readTeams(eventId)
  const pairings = await readPairings(eventId)
  const results = await readTournamentResults(eventId)
  const latestResults = await readGames(eventId)
  const standings = buildTeamStandings(teams, results)

  return {
    champion: standings[0] && event.lifecycleStage === 'Awards'
      ? {
          captain: standings[0].captain,
          draws: standings[0].draws,
          losses: standings[0].losses,
          objectivePoints: standings[0].objectivePoints,
          players: standings[0].players,
          teamName: standings[0].teamName,
          tournamentPoints: standings[0].tournamentPoints,
          victoryPoints: standings[0].victoryPoints,
          wins: standings[0].wins,
        }
      : null,
    completedMatches: results.length,
    currentRound: event.lifecycleStage.startsWith('Round')
      ? { name: event.lifecycleStage }
      : null,
    event,
    freeAgents: registration.freeAgents,
    invitations: await readInvitations(eventId),
    latestResults,
    news: buildEventNews(event, registration),
    pairings,
    quickActions: [
      {
        action: 'pairings',
        enabled: pairings.length > 0,
        eventId,
        label: 'View Pairings',
      },
      {
        action: 'standings',
        enabled: standings.length > 0,
        eventId,
        label: 'Team Standings',
      },
    ],
    registration,
    registeredTeams: teams.length,
    standings,
    status: event.status || event.lifecycleStage,
    teams,
    timeline: buildTournamentTimeline(event, registration, pairings, results),
    resultStatuses: [],
    tournamentResults: results,
    upcomingPairings: pairings.filter((pairing) => pairing.status !== 'Completed'),
  }
}

async function readTournamentResults(eventId: string) {
  const db = await getDb()
  const snapshot = await getDocs(
    query(collection(db, 'analytics'), where('eventId', '==', eventId)),
  )

  return snapshot.docs
    .filter((item) => item.id !== '__schema')
    .map((item) => normalizeTournamentResult(item.id, item.data(), eventId))
}

async function readInvitations(eventId: string) {
  const db = await getDb()
  const snapshot = await getDocs(
    query(collection(db, 'notifications'), where('eventId', '==', eventId), where('type', '==', 'teamInvitation')),
  )

  return snapshot.docs
    .filter((item) => item.id !== '__schema')
    .map((item) => normalizeInvitation(item.id, item.data(), eventId))
}

export const firestoreProviderImpl: DataProvider = {
  analytics: {
    getAnalytics: async () => emptyLeagueIntelligence(),
    getFaction: async (factionName) => emptyFactionProfile(factionName),
    getFactions: async () => readCollection('factions', normalizeFaction),
    getHallOfFame: async () => emptyHallOfFame(),
    getMission: async (missionName) => emptyMissionProfile(missionName),
    getMissions: async () => readCollection('missions', normalizeMission),
    getRecords: async () => ({}),
  },
  dashboard: {
    getCommunityCommandCenter: async () => emptyCommunityCommandCenter(),
    getDashboard: async () => {
      const standings = await buildAllStandings()
      const main = standings.find((division) => division.division === 'main')
      const allRows = standings.flatMap((division) => division.standings)

      return {
        leagueOverview: {
          divisions: standings.map((division) => ({
            activePlayers: division.summary.activePlayers,
            division: division.division,
            divisionLabel: division.divisionLabel,
            gamesPlayed: division.summary.gamesPlayed,
            players: division.summary.players,
          })),
          totalActivePlayers: allRows.filter((row) => row.games > 0).length,
          totalLeagueGames:
            allRows.reduce((total, row) => total + row.games, 0) / 2,
        },
        standings: main?.standings ?? [],
        summary: {
          activePlayers: allRows.filter((row) => row.games > 0).length,
          gamesPlayed: allRows.reduce((total, row) => total + row.games, 0) / 2,
          leagueLeader: main?.standings[0]?.displayName || 'None',
          topFaction: 'Not available',
        },
      }
    },
    getHome: async () => {
      const dashboard = await firestoreProviderImpl.dashboard.getDashboard()

      return {
        armyListCommunity: {
          highestRatedDesigner: null,
          mostListsSubmitted: [],
          mostPopularFaction: '',
          topContributors: [],
          trendingLists: [],
        },
        armyLists: [],
        dashboard,
        hallOfFame: emptyHallOfFame(),
        intelligence: emptyLeagueIntelligence(),
        news: [],
        quickStats: {
          activePlayers: dashboard.summary.activePlayers,
          armyLists: 0,
          games: dashboard.summary.gamesPlayed,
          news: 0,
          recentGames: 0,
          streams: 0,
        },
        recentGames: await readGames(),
        records: {},
        settings: emptySettings(),
        streams: [],
      }
    },
  },
  events: {
    getEventHome: async (eventId = defaultEventId) => {
      const event = await readEvent(eventId)
      const registration = await buildRegistrationData(eventId, event)
      const pairings = await readPairings(eventId)
      const teams = await readTeams(eventId)
      const games = await readGames(eventId)

      return {
        currentRound: event.lifecycleStage.startsWith('Round')
          ? { name: event.lifecycleStage }
          : null,
        eligibleOpponents: [],
        event,
        navigation: getEventNavigation(event),
        news: buildEventNews(event, registration),
        playerStatus: {
          captain: false,
          currentTeam: '',
          notifications: [],
          outstandingAction: registration.registrationOpen
            ? 'Register for this Event.'
            : 'No Event action required.',
          registrationStatus: registration.status,
          upcomingMatch: pairings[0]
            ? `${pairings[0].teamA} vs ${pairings[0].teamB}`
            : 'Pending pairings',
        },
        quickActions: getEventQuickActions(event, registration),
        registration,
        rounds: [],
        statistics: {
          completedGames: games.length,
          completionPercentage: pairings.length > 0
            ? Math.round((games.length / pairings.length) * 100)
            : 0,
          currentRound: event.lifecycleStage,
          gamesRemaining: Math.max(0, pairings.length - games.length),
          lifecycleStage: event.lifecycleStage,
          registeredPlayers: registration.registeredCount,
          registrationStatus: registration.status,
          teams: teams.length,
        },
        timeline: buildTournamentTimeline(event, registration, pairings, []),
      }
    },
    getLeagueOperations: async () => ({
      mapOptions: [],
      missionOptions: [],
      missions: [
        { maps: ['', ''], mission: '' },
        { maps: ['', ''], mission: '' },
      ],
      updatedAt: '',
      updatedBy: '',
      weekNumber: '',
    }),
    getEventManager: async (eventId = defaultEventId) => {
      const events = await readEvents()
      const selectedEvent = events.find((event) => event.id === eventId) ?? events[0]
      const currentEventId = await readCurrentEventId()
      const currentEvent =
        events.find((event) => event.id === currentEventId) ??
        selectedEvent
      const registration = await buildRegistrationData(selectedEvent.id, selectedEvent)
      const teams = await readTeams(selectedEvent.id)
      const pairings = await readPairings(selectedEvent.id)
      const games = await readGames(selectedEvent.id)

      return {
        currentEvent,
        diagnostics: {
          cacheGroup: 'firestore',
          completedGames: games.length,
          eventHealth: 'Healthy',
          eventId: selectedEvent.id,
          lastUpdate: new Date().toISOString(),
          lifecycleStage: selectedEvent.lifecycleStage,
          pairingCount: pairings.length,
          participantCount: registration.registrations.length,
          registrationStatus: registration.status,
          teamCount: teams.length,
        },
        events: await Promise.all(
          events.map(async (event) => {
            const eventRegistration = await buildRegistrationData(event.id, event)
            const eventTeams = await readTeams(event.id)
            const eventGames = await readGames(event.id)

            return {
              completedGames: eventGames.length,
              completionPercentage: 0,
              currentRound: event.lifecycleStage.startsWith('Round')
                ? { name: event.lifecycleStage }
                : null,
              event,
              participantCount: eventRegistration.registrations.length,
              registrationStatus: event.registration,
              teamCount: eventTeams.length,
            }
          }),
        ),
        generatedAt: new Date().toISOString(),
        leagueOperations: await firestoreProviderImpl.events.getLeagueOperations(),
        pairings,
        participants: registration.registrations,
        quickActions: [],
        registration,
        rounds: [],
        selectedEvent,
        teams,
      }
    },
    getEvents: async () => {
      const events = await readEvents()
      const currentEventId = await readCurrentEventId()

      return {
        currentEvent:
          events.find((event) => event.id === currentEventId) ?? events[0],
        events,
      }
    },
    saveEvent: async (params) => {
      const db = await getDb()
      const eventId = params.eventId || slugEventId(params.name)
      await setDoc(
        doc(db, 'events', eventId),
        {
          ...params,
          id: eventId,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      return firestoreProviderImpl.events.getEventManager(eventId)
    },
    savePairing: async (params) => {
      await savePairingDocument(params)
      return firestoreProviderImpl.events.getEventManager(params.eventId)
    },
    saveLeagueOperations: async () =>
      firestoreProviderImpl.events.getLeagueOperations(),
    saveParticipant: async (params) => {
      await saveRegistrationDocument(params)
      return firestoreProviderImpl.events.getEventManager(params.eventId)
    },
    saveTeam: async (params) => {
      await saveTeamDocument(params)
      return firestoreProviderImpl.events.getEventManager(params.eventId)
    },
    setCurrentEvent: async (params) => {
      const db = await getDb()
      await setDoc(
        doc(db, 'settings', 'currentEvent'),
        {
          eventId: params.eventId,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      return firestoreProviderImpl.events.getEventManager(params.eventId)
    },
    setLifecycle: async (params) => {
      const db = await getDb()
      await updateDoc(doc(db, 'events', params.eventId), {
        lifecycleStage: params.lifecycleStage,
        status: params.status || params.lifecycleStage,
        updatedAt: serverTimestamp(),
      })
      return firestoreProviderImpl.events.getEventManager(params.eventId)
    },
    setRegistration: async (params) => {
      const db = await getDb()
      await updateDoc(doc(db, 'events', params.eventId), {
        registration: params.registration,
        lifecycleStage: params.registration,
        status: params.registration,
        updatedAt: serverTimestamp(),
      })
      return firestoreProviderImpl.events.getEventManager(params.eventId)
    },
  },
  games: {
    getRecentGames: async (options = {}) => readGames(options.eventId),
    submitArmyList: async () => undefined,
  },
  notifications: {
    getNotifications: readNotifications,
    updateNotificationState: async (params) => {
      const db = await getDb()
      const ids = params.notificationIds?.length
        ? params.notificationIds
        : [params.notificationId]

      await Promise.all(
        ids.filter(Boolean).map((id) =>
          setDoc(
            doc(db, 'notifications', id),
            {
              [params.state]: true,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          ),
        ),
      )
    },
  },
  players: {
    comparePlayers: async () => ({ headToHead: { games: 0, leftWins: 0, rightWins: 0, draws: 0 }, players: [] } as PlayerComparisonData),
    getAllPlayers: buildAllStandings,
    getCurrentPlayer: async () => emptyMyProfile(),
    getPlayer: async (playerName) => emptyPlayerProfile(playerName),
    updateProfile: async () => emptyMyProfile(),
  },
  registrations: {
    getRegistration: async (eventId = defaultEventId) => buildRegistrationData(eventId),
    manage: async (params) => {
      await saveRegistrationDocument(params)
      return buildRegistrationData(params.eventId)
    },
    register: async (params) => {
      await saveRegistrationDocument({
        ...params,
        status: 'Registered',
      })
      return buildRegistrationData(params.eventId)
    },
    withdraw: async (params) => {
      await saveRegistrationDocument({
        ...params,
        status: 'Withdrawn',
      })
      return buildRegistrationData(params.eventId)
    },
  },
  scheduling: {
    createRequest: async () => emptySchedulingCenter(),
    getCommissionerScheduling: async () => ({
      divisions: [],
      generatedAt: new Date().toISOString(),
      requests: [],
    }),
    getMatchFinder: async () => emptyMatchFinder(),
    getSchedulingCalendar: async () => ({ filename: 'lobo-match.ics', ics: '' }),
    getSchedulingCenter: async () => emptySchedulingCenter(),
    respondToRequest: async () => emptySchedulingCenter(),
    updateAvailability: async () => emptySchedulingCenter(),
  },
  standings: {
    getAllStandings: buildAllStandings,
    getStandings: async (division, options = {}) =>
      buildDivisionStandings(division, options.eventId),
  },
  teams: {
    advanceRound: async (params) => {
      await firestoreProviderImpl.events.setLifecycle({
        eventId: params.eventId,
        lifecycleStage: params.lifecycleStage || params.status || 'Round 1',
        status: params.status || params.lifecycleStage || 'Round 1',
      })
      return buildTeamTournamentData(params.eventId)
    },
    getTeamTournament: buildTeamTournamentData,
    saveInvitation: async (params) => {
      const db = await getDb()
      const invitationId = params.invitationId || createId('invitation')
      await setDoc(
        doc(db, 'notifications', invitationId),
        {
          ...params,
          invitationId,
          type: 'teamInvitation',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      return buildTeamTournamentData(params.eventId)
    },
    savePairing: async (params) => {
      await savePairingDocument(params)
      return buildTeamTournamentData(params.eventId)
    },
    saveResult: async (params) => {
      const db = await getDb()
      const resultId = params.resultId || createId('result')
      await setDoc(
        doc(db, 'analytics', resultId),
        {
          ...params,
          resultId,
          type: 'teamTournamentResult',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      return buildTeamTournamentData(params.eventId)
    },
    saveTeam: async (params) => {
      await saveTeamDocument(params)
      return buildTeamTournamentData(params.eventId)
    },
  },
  getHealth: async () => {
    const { health } = await initializeFirestoreProvider()
    return health
  },
  metadata: {
    kind: 'firestore',
    name: 'Firestore Provider',
    storage: 'Firebase Firestore',
  },
}

async function saveRegistrationDocument(params: Record<string, string>) {
  const db = await getDb()
  const eventId = params.eventId || defaultEventId
  const player = params.player || params.displayName || params.email || 'current-player'
  const id = `${eventId}_${slug(player)}`
  await setDoc(
    doc(db, 'registrations', id),
    {
      ...params,
      eventId,
      player,
      registeredAt: params.registeredAt || new Date().toISOString(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

async function saveTeamDocument(params: Record<string, string>) {
  const db = await getDb()
  const eventId = params.eventId || defaultTournamentEventId
  const teamId = params.teamId || `${eventId}_${slug(params.teamName || 'team')}`
  await setDoc(
    doc(db, 'teams', teamId),
    {
      ...params,
      eventId,
      teamId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

async function savePairingDocument(params: Record<string, string>) {
  const db = await getDb()
  const eventId = params.eventId || defaultTournamentEventId
  const roundId = params.roundId || `${eventId}_${slug(params.round || 'round')}_${slug(params.teamA || 'team-a')}_${slug(params.teamB || 'team-b')}`
  await setDoc(
    doc(db, 'pairings', roundId),
    {
      ...params,
      eventId,
      roundId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

async function buildAllStandings() {
  return Promise.all(
    (['main', 'pga', 'pgb'] as DivisionKey[]).map((division) =>
      buildDivisionStandings(division),
    ),
  )
}

async function buildDivisionStandings(
  division: DivisionKey,
  eventId = defaultEventId,
): Promise<DivisionStandings> {
  const players = await readCollection('players', (id, data) => ({
    eventId,
    games: readNumber(data, 'games'),
    losses: readNumber(data, 'losses'),
    draws: readNumber(data, 'draws'),
    op: readNumber(data, 'op'),
    player: readString(data, 'player') || id,
    displayName: readString(data, 'displayName') || readString(data, 'player') || id,
    rank: readNumber(data, 'rank'),
    tp: readNumber(data, 'tp'),
    vp: readNumber(data, 'vp'),
    wins: readNumber(data, 'wins'),
  }))
  const standings = players
    .filter((player) => !readString(player, 'division') || readString(player, 'division') === division)
    .sort((left, right) => right.tp - left.tp || right.op - left.op || right.vp - left.vp)
    .map((player, index) => ({
      ...player,
      rank: player.rank || index + 1,
    })) satisfies Standing[]

  return {
    division,
    divisionLabel: getDivisionLabel(division),
    event: await readEvent(eventId),
    eventId,
    standings,
    summary: {
      activePlayers: standings.filter((player) => player.games > 0).length,
      gamesPlayed: standings.reduce((total, player) => total + player.games, 0) / 2,
      leader: standings[0] ?? null,
      players: standings.length,
    },
  }
}

function normalizeEvent(id: string, data: DocumentData): LeagueEvent {
  return {
    achievements: readString(data, 'achievements'),
    archive: readString(data, 'archive'),
    automation: readString(data, 'automation'),
    capabilities: readStringArray(data, 'capabilities'),
    commissioners: readString(data, 'commissioners'),
    communityId: readString(data, 'communityId'),
    createdAt: readTimestamp(data, 'createdAt'),
    description: readString(data, 'description'),
    discord: readString(data, 'discord'),
    endDate: readString(data, 'endDate'),
    history: readString(data, 'history'),
    id: readString(data, 'id') || id,
    lifecycleStage: readString(data, 'lifecycleStage') || 'Planning',
    name: readString(data, 'name') || 'Current League',
    owner: readString(data, 'owner'),
    participants: readString(data, 'participants'),
    registration: readString(data, 'registration') || 'Registration Closed',
    rules: readString(data, 'rules'),
    scoringModel: readString(data, 'scoringModel') || 'League',
    seriesId: readString(data, 'seriesId'),
    standingsModel: readString(data, 'standingsModel') || 'League Division Standings',
    startDate: readString(data, 'startDate'),
    status: readString(data, 'status') || readString(data, 'lifecycleStage') || 'Planning',
    templateId: readString(data, 'templateId'),
    type: readString(data, 'type') || 'League',
    updatedAt: readTimestamp(data, 'updatedAt'),
  }
}

function createDefaultEvent(id = defaultEventId): LeagueEvent {
  return normalizeEvent(id, {
    id,
    lifecycleStage: 'Planning',
    name: id === defaultEventId ? 'Current League' : 'Event',
    registration: 'Registration Closed',
    status: 'Planning',
    type: 'League',
  })
}

function normalizeRegistration(
  id: string,
  data: DocumentData,
  eventId: string,
): EventRegistrationEntry {
  return {
    captain: readBoolean(data, 'captain'),
    discord: readString(data, 'discord'),
    displayName: readString(data, 'displayName') || readString(data, 'player') || id,
    email: readString(data, 'email'),
    eventId: readString(data, 'eventId') || eventId,
    faction: readString(data, 'faction'),
    freeAgent: readBoolean(data, 'freeAgent'),
    notes: readString(data, 'notes'),
    player: readString(data, 'player') || id,
    preferredTeam: readString(data, 'preferredTeam'),
    registeredAt: readTimestamp(data, 'registeredAt'),
    role: readString(data, 'role'),
    seed: readString(data, 'seed'),
    status: readString(data, 'status') || 'Registered',
    team: readString(data, 'team'),
    updatedAt: readTimestamp(data, 'updatedAt'),
  }
}

function normalizeTeam(id: string, data: DocumentData, eventId: string): TeamTournamentTeam {
  return {
    captain: readString(data, 'captain'),
    createdAt: readTimestamp(data, 'createdAt'),
    discordContact: readString(data, 'discordContact'),
    eventId: readString(data, 'eventId') || eventId,
    factionRestrictions: readString(data, 'factionRestrictions'),
    logoUrl: readString(data, 'logoUrl'),
    players: readString(data, 'players'),
    status: readString(data, 'status') || 'Registered',
    teamId: readString(data, 'teamId') || id,
    teamName: readString(data, 'teamName') || id,
    updatedAt: readTimestamp(data, 'updatedAt'),
  }
}

function normalizePairing(id: string, data: DocumentData, eventId: string): TeamTournamentPairing {
  return {
    createdAt: readTimestamp(data, 'createdAt'),
    eventId: readString(data, 'eventId') || eventId,
    playerPairings: readString(data, 'playerPairings'),
    results: readString(data, 'results'),
    round: readString(data, 'round') || 'Round 1',
    roundId: readString(data, 'roundId') || id,
    status: readString(data, 'status') || 'Scheduled',
    teamA: readString(data, 'teamA'),
    teamB: readString(data, 'teamB'),
    updatedAt: readTimestamp(data, 'updatedAt'),
  }
}

function normalizeNotification(id: string, data: DocumentData): LeagueNotification {
  return {
    body: readString(data, 'body'),
    id,
    link: readString(data, 'link'),
    priority: readString(data, 'priority'),
    timestamp: readTimestamp(data, 'timestamp'),
    title: readString(data, 'title'),
    type: readString(data, 'type'),
    unread: !readBoolean(data, 'read'),
  }
}

function normalizeInvitation(id: string, data: DocumentData, eventId: string): TeamTournamentInvitation {
  return {
    captain: readString(data, 'captain'),
    createdAt: readTimestamp(data, 'createdAt'),
    eventId,
    invitationId: readString(data, 'invitationId') || id,
    message: readString(data, 'message'),
    player: readString(data, 'player'),
    status: readString(data, 'status') || 'Pending',
    teamName: readString(data, 'teamName'),
    updatedAt: readTimestamp(data, 'updatedAt'),
  }
}

function normalizeTournamentResult(id: string, data: DocumentData, eventId: string): TeamTournamentResult {
  return {
    bestMoment: readString(data, 'bestMoment'),
    createdAt: readTimestamp(data, 'createdAt'),
    eventId,
    firstTurn: readString(data, 'firstTurn'),
    mission: readString(data, 'mission'),
    notes: readString(data, 'notes'),
    objectivePoints: readString(data, 'objectivePoints'),
    opponent: readString(data, 'opponent'),
    player: readString(data, 'player'),
    resultId: readString(data, 'resultId') || id,
    round: readString(data, 'round'),
    roundId: readString(data, 'roundId'),
    status: readString(data, 'status') || 'Submitted',
    submittedBy: readString(data, 'submittedBy'),
    table: readString(data, 'table'),
    teamA: readString(data, 'teamA'),
    teamB: readString(data, 'teamB'),
    tournamentPoints: readString(data, 'tournamentPoints'),
    updatedAt: readTimestamp(data, 'updatedAt'),
    victoryPoints: readString(data, 'victoryPoints'),
    winner: readString(data, 'winner'),
    winningFaction: readString(data, 'winningFaction'),
  }
}

function normalizeRecentGame(id: string, data: DocumentData): RecentGame {
  return {
    bestMoment: readString(data, 'bestMoment'),
    date: readString(data, 'date'),
    division: readString(data, 'division'),
    eventId: readString(data, 'eventId') || defaultEventId,
    firstTurn: readString(data, 'firstTurn'),
    gameType: readString(data, 'gameType') || 'league',
    id: Number(id) || readNumber(data, 'id'),
    loser: readString(data, 'loser'),
    loserDisplayName: readString(data, 'loserDisplayName'),
    loserFaction: readString(data, 'loserFaction'),
    mission: readString(data, 'mission'),
    op: readString(data, 'op'),
    tp: readString(data, 'tp'),
    vp: readString(data, 'vp'),
    winner: readString(data, 'winner'),
    winnerDisplayName: readString(data, 'winnerDisplayName'),
    winnerFaction: readString(data, 'winnerFaction'),
  }
}

function normalizeFaction(id: string, data: DocumentData): FactionSummary {
  return {
    averageOP: readNumber(data, 'averageOP'),
    averageTP: readNumber(data, 'averageTP'),
    averageVP: readNumber(data, 'averageVP'),
    divisionBreakdown: [],
    games: readNumber(data, 'games'),
    lastPlayed: readString(data, 'lastPlayed'),
    losses: readNumber(data, 'losses'),
    draws: readNumber(data, 'draws'),
    name: readString(data, 'name') || id,
    topPlayer: readString(data, 'topPlayer'),
    topPlayerDisplayName: readString(data, 'topPlayerDisplayName'),
    winRate: readNumber(data, 'winRate'),
    wins: readNumber(data, 'wins'),
  }
}

function normalizeMission(id: string, data: DocumentData): MissionSummary {
  return {
    averageOP: readNumber(data, 'averageOP'),
    averageTP: readNumber(data, 'averageTP'),
    averageVP: readNumber(data, 'averageVP'),
    firstTurnWinRate: readNumber(data, 'firstTurnWinRate'),
    games: readNumber(data, 'games'),
    lastPlayed: readString(data, 'lastPlayed'),
    mission: readString(data, 'mission') || id,
    mostSuccessfulFaction: readString(data, 'mostSuccessfulFaction'),
  }
}

function buildTeamStandings(
  teams: TeamTournamentTeam[],
  results: TeamTournamentResult[],
) {
  return teams
    .map((team) => {
      const teamResults = results.filter((result) =>
        [result.teamA, result.teamB].includes(team.teamName),
      )

      return {
        captain: team.captain,
        losses: 0,
        draws: 0,
        objectivePoints: sumScore(teamResults, 'objectivePoints'),
        players: splitPlayers(team.players),
        rank: 0,
        strengthOfSchedule: 0,
        teamId: team.teamId,
        teamName: team.teamName,
        tournamentPoints: sumScore(teamResults, 'tournamentPoints'),
        victoryPoints: sumScore(teamResults, 'victoryPoints'),
        wins: 0,
      }
    })
    .sort((left, right) =>
      right.tournamentPoints - left.tournamentPoints ||
      right.objectivePoints - left.objectivePoints ||
      right.victoryPoints - left.victoryPoints,
    )
    .map((team, index) => ({ ...team, rank: index + 1 }))
}

function groupRegistrationTeams(registrations: EventRegistrationEntry[]) {
  const groups = new Map<string, EventRegistrationEntry[]>()

  registrations.forEach((entry) => {
    const teamName = entry.team || entry.preferredTeam || 'Looking for Team'
    const list = groups.get(teamName) ?? []
    list.push(entry)
    groups.set(teamName, list)
  })

  return Array.from(groups.entries()).map(([teamName, players]) => ({
    captains: players.filter((player) => player.captain).length,
    players,
    teamName,
  }))
}

function buildEventNews(event: LeagueEvent, registration: EventRegistrationData) {
  return [
    `${event.name} is currently ${event.lifecycleStage}.`,
    `${registration.registeredCount} players registered.`,
  ]
}

function buildTournamentTimeline(
  event: LeagueEvent,
  registration: EventRegistrationData,
  pairings: TeamTournamentPairing[],
  results: TeamTournamentResult[],
) {
  return [
    {
      body: `${event.name} entered ${event.lifecycleStage}.`,
      timestamp: event.updatedAt || new Date().toISOString(),
      title: event.lifecycleStage,
      type: 'Lifecycle',
    },
    {
      body: `${registration.registeredCount} players registered.`,
      timestamp: new Date().toISOString(),
      title: 'Registration',
      type: 'Registration',
    },
    ...pairings.map((pairing) => ({
      body: `${pairing.teamA} vs ${pairing.teamB}`,
      timestamp: pairing.updatedAt || pairing.createdAt || new Date().toISOString(),
      title: pairing.round,
      type: 'Pairing',
    })),
    ...results.map((result) => ({
      body: `${result.player} submitted a result against ${result.opponent}.`,
      timestamp: result.updatedAt || result.createdAt || new Date().toISOString(),
      title: result.round || 'Result Submitted',
      type: 'Result',
    })),
  ]
}

function getEventNavigation(event: LeagueEvent) {
  if (event.type === 'Team Tournament') {
    return [
      { href: `/event/${encodeURIComponent(event.id)}/tournament`, label: 'Overview' },
      { href: `/event/${encodeURIComponent(event.id)}/tournament/registration`, label: 'Registration' },
      { href: `/event/${encodeURIComponent(event.id)}/tournament/teams`, label: 'Teams' },
      { href: `/event/${encodeURIComponent(event.id)}/tournament/pairings`, label: 'Pairings' },
      { href: `/event/${encodeURIComponent(event.id)}/tournament/standings`, label: 'Standings' },
    ]
  }

  return [
    { href: `/event/${encodeURIComponent(event.id)}`, label: 'Overview' },
    { href: '/standings', label: 'Standings' },
    { href: '/match-finder', label: 'Match Finder' },
  ]
}

function getEventQuickActions(
  event: LeagueEvent,
  registration: EventRegistrationData,
) {
  return [
    {
      action: 'register',
      enabled: registration.registrationOpen,
      href: event.type === 'Team Tournament'
        ? `/event/${encodeURIComponent(event.id)}/tournament/registration`
        : '#registration',
      label: registration.registrationOpen ? 'Register' : 'Registration Closed',
    },
    {
      action: 'standings',
      enabled: true,
      href: event.type === 'Team Tournament'
        ? `/event/${encodeURIComponent(event.id)}/tournament/standings`
        : '/standings',
      label: 'Standings',
    },
  ]
}

function emptyLeagueIntelligence(): LeagueIntelligenceData {
  return {
    biggestVictories: [],
    closestGames: [],
    factionMomentum: [],
    highestVPGames: [],
    losingStreaks: [],
    missionTrends: [],
    promotionBattle: [],
    recentUpsets: [],
    records: {},
    relegationBattle: [],
    winStreaks: [],
  }
}

function emptyHallOfFame(): HallOfFameData {
  return {
    careerLeaders: {
      achievementPoints: [],
      championships: [],
      communityAwards: [],
      promotions: [],
      seasonsPlayed: [],
      winPercentage: [],
    },
    leaders: {
      games: [],
      draws: [],
      objectivePoints: [],
      tournamentPoints: [],
      victoryPoints: [],
      wins: [],
    },
    leagueHistory: [],
    playerCareers: [],
    recordBook: [],
    records: {},
    seasonHistory: [],
  }
}

function emptySettings() {
  return {
    bannerImage: '',
    commissionerContact: '',
    commissionerEmails: '',
    currentSeason: 'Current League',
    deploymentUrl: '',
    discordInvite: '',
    gitCommit: '',
    googleFormUrl: '',
    googleOAuthClientId: '',
    leagueLogo: '',
    leagueName: 'Lobo Infinity League',
    leagueWebsite: '',
    portalVersion: firestorePortalVersion,
    registrationOpen: 'false',
    seasonEndDate: '',
    seasonStartDate: '',
    submissionButtonText: 'Submit Game',
    submissionButtonVisible: 'true',
    submissionEnabled: 'true',
    themeAccentColor: '',
  }
}

function emptyCommunityCommandCenter(): CommunityCommandCenterData {
  return {
    activeEvents: [],
    communityActivity: {
      featuredBattle: null,
      latestAchievements: [],
      latestResults: [],
      news: [],
      streams: [],
    },
    eventSwitcher: [],
    intelligence: [],
    matchRequests: {
      incoming: [],
      outgoing: [],
      upcoming: [],
    },
    nextActions: [],
    nudgeEngine: [],
    opponentTracker: {
      completed: [],
      progress: {
        completionPercentage: 0,
        gamesCompleted: 0,
        gamesRemaining: 0,
        gamesRequired: 0,
      },
      remaining: [],
      suggested: null,
    },
    promotion: {
      currentRank: 0,
      gamesNeeded: 0,
      magicNumber: 0,
      projectedFinish: 0,
      promotionZone: false,
      relegationZone: false,
      safe: true,
      status: '',
    },
    quickActions: [],
    schedule: {
      currentRound: '',
      deadlines: {
        currentWeek: 0,
        gamesNeededBeforeEnd: 0,
        gamesNeededBeforeMidseason: 0,
        lateStatus: '',
        midseasonDeadline: '',
        seasonEndDeadline: '',
      },
      gamesRemaining: 0,
      upcomingEventDates: [],
    },
    today: [],
    welcome: {
      currentActiveEvents: 1,
      currentDivision: '',
      currentLeague: 'Current League',
      currentRank: 0,
      currentRecord: '0-0',
      currentWeek: 0,
      displayName: '',
      leagueCompletion: 0,
      leaguePlayer: '',
      playerDisplayName: '',
    },
  }
}

function emptyMatchFinder(): MatchFinderData {
  return {
    availability: emptyAvailability(),
    currentSeason: 'Current League',
    pendingRequests: [],
    player: emptySeasonCommandPlayer(),
    progress: {
      completionPercentage: 0,
      gamesCompleted: 0,
      gamesRemaining: 0,
      gamesRequired: 0,
      midseasonProgress: 0,
      opponentsCompleted: 0,
      opponentsRemaining: 0,
      seasonProgress: 0,
    },
    recommendations: [],
    upcomingMatches: [],
  }
}

function emptySchedulingCenter(): SchedulingCenterData {
  return {
    activity: [],
    availability: emptyAvailability(),
    commissioner: {
      behind: 0,
      division: '',
      finished: 0,
      latePlayers: [],
      missingPairings: 0,
    },
    completedOpponents: [],
    currentSeason: 'Current League',
    event: null,
    eventId: defaultEventId,
    opponents: [],
    player: emptySeasonCommandPlayer(),
    progress: {
      completionPercentage: 0,
      gamesCompleted: 0,
      gamesRemaining: 0,
      gamesRequired: 0,
      midseasonProgress: 0,
      opponentsCompleted: 0,
      opponentsRemaining: 0,
      seasonProgress: 0,
    },
    quickActions: [],
    recommendations: [],
    remainingOpponents: [],
    requests: {
      history: [],
      incoming: [],
      outgoing: [],
      pending: [],
      upcoming: [],
    },
    seasonProgress: {
      division: {
        completionPercentage: 0,
        gamesCompleted: 0,
        gamesRemaining: 0,
        players: 0,
      },
      league: [],
      player: {},
    },
  }
}

function emptyAvailability() {
  return {
    city: '',
    discordHandle: '',
    friday: '',
    homeStore: '',
    maxTravelDistance: '',
    monday: '',
    notes: '',
    player: '',
    preferredDays: '',
    preferredLocations: '',
    preferredTimes: '',
    saturday: '',
    status: 'No availability added yet.',
    sunday: '',
    thursday: '',
    tuesday: '',
    updatedAt: '',
    wednesday: '',
  }
}

function emptySeasonCommandPlayer() {
  return {
    displayName: '',
    division: '',
    games: 0,
    losses: 0,
    draws: 0,
    op: 0,
    player: '',
    rank: 0,
    tp: 0,
    vp: 0,
    wins: 0,
  }
}

function emptyMyProfile(): MyProfileData {
  return {
    achievements: [],
    careerStatistics: null,
    futureSections: [],
    intelligence: {
      divisionAverage: emptyIntelligenceAverage(),
      leagueAverage: emptyIntelligenceAverage(),
      player: '',
      ranks: {
        objectivePoints: 0,
        tournamentPoints: 0,
        victoryPoints: 0,
        winPercentage: 0,
      },
      topThreeAverage: emptyIntelligenceAverage(),
      division: '',
    },
    leaguePerformance: {
      bestOpponent: '',
      closestVictory: null,
      currentStreak: '',
      fallbackBestOpponent: '',
      fallbackWorstOpponent: '',
      longestLosingStreak: 0,
      longestWinStreak: 0,
      mostPlayedOpponent: '',
      worstDefeat: null,
      worstOpponent: '',
    },
    leagueStatistics: null,
    recentActivity: [],
    recentGames: [],
    submittedLists: [],
    user: {
      archivedAlerts: [],
      avatarUrl: '',
      created: '',
      dismissedAlerts: [],
      displayName: '',
      discordName: '',
      email: '',
      enabled: true,
      favoriteFaction: '',
      lastLogin: '',
      lastPage: '',
      lastSeen: '',
      leagueDivision: '',
      leaguePlayer: '',
      notificationPreferences: {},
      playerDisplayName: '',
      readAlerts: [],
      role: 'League Member',
      searchHistory: [],
      profileVisibility: 'Public',
      themePreference: 'system',
    },
    votesCast: 0,
    currentSeasonStatistics: null,
  }
}

function emptyPlayerProfile(playerName: string): PlayerProfileData {
  return {
    armyListSummary: {
      averageRating: 0,
      favoriteFaction: '',
      highestRated: null,
      newest: null,
      submitted: 0,
    },
    armyLists: [],
    availability: emptyAvailability(),
    bestFaction: '',
    careerSummary: emptyPlayerCareerSummary(),
    city: '',
    discordHandle: '',
    division: '',
    favoriteFaction: '',
    favoriteMission: '',
    bestMission: '',
    firstTurnGames: 0,
    firstTurnWinRate: 0,
    games: 0,
    homeStore: '',
    losses: 0,
    draws: 0,
    name: playerName,
    nemesis: '',
    op: 0,
    preferredLocations: '',
    profilePicture: '',
    rank: 0,
    registeredEvents: [],
    rival: '',
    scheduleLink: '',
    secondTurnGames: 0,
    secondTurnWinRate: 0,
    tp: 0,
    vp: 0,
    wins: 0,
    displayName: playerName,
  }
}

function emptyPlayerCareerSummary(): PlayerCareerSummary {
  const record = {
    draws: 0,
    games: 0,
    losses: 0,
    winPercentage: 0,
    wins: 0,
  }
  const metric = {
    ...record,
    label: '',
    lastPlayed: '',
  }

  return {
    armies: {
      best: metric,
      favorite: metric,
      mostRecent: metric,
    },
    currentWinStreak: 0,
    gamesThisMonth: 0,
    longestWinStreak: 0,
    losses: 0,
    missions: {
      best: {
        ...metric,
        insufficientGames: true,
      },
      favorite: metric,
      mostRecent: metric,
    },
    quickStats: {
      biggestVictory: 0,
      highestVpGame: 0,
      mostPlayedArmy: '',
      mostPlayedArmyParentFaction: '',
      mostPlayedMission: '',
    },
    records: {
      casual: record,
      league: record,
      overall: record,
      tournament: record,
    },
    totalGames: 0,
    winPercentage: 0,
    wins: 0,
  }
}

function emptyFactionProfile(factionName: string): FactionProfileData {
  return {
    ...normalizeFaction(factionName, { name: factionName }),
    armyLists: { highestRated: [], mostPopular: [], newest: [] },
    bestMoments: [],
    matchups: [],
    matchupSummary: {
      bestOpponent: '',
      games: 0,
      losses: 0,
      draws: 0,
      opponents: 0,
      winRate: 0,
      wins: 0,
    },
    mostPlayedMission: '',
    recentGames: [],
  }
}

function emptyMissionProfile(missionName: string): MissionProfileData {
  return {
    ...normalizeMission(missionName, { mission: missionName }),
    bestMoments: [],
    divisionBreakdown: [],
    mostPlayedFaction: '',
    recentGames: [],
  }
}

function emptyIntelligenceAverage() {
  return {
    averageOP: 0,
    averageTP: 0,
    averageVP: 0,
    games: 0,
    players: 0,
    winPercentage: 0,
  }
}

function sumScore(
  results: TeamTournamentResult[],
  key: 'objectivePoints' | 'tournamentPoints' | 'victoryPoints',
) {
  return results.reduce((total, result) => total + parseScore(result[key]), 0)
}

function parseScore(value: string) {
  const [left] = value.split('-')
  const parsed = Number(left)

  return Number.isFinite(parsed) ? parsed : 0
}

function splitPlayers(players: string) {
  return players
    .split(/[,;\n]/)
    .map((player) => player.trim())
    .filter(Boolean)
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function readStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => String(item ?? '')).filter(Boolean)
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return value === true || value === 'true'
}

function readTimestamp(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    const timestamp = value as { toDate: () => Date }
    return timestamp.toDate().toISOString()
  }

  return ''
}

function getDivisionLabel(division: DivisionKey) {
  if (division === 'main') {
    return 'Main Man'
  }

  if (division === 'pga') {
    return 'Proving Grounds A'
  }

  return 'Proving Grounds B'
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function slugEventId(name: string) {
  return `event-${slug(name || 'custom-event')}`
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
