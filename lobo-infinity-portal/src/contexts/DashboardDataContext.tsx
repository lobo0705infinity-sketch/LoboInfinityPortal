/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { dashboardRepository, standingsRepository } from '../services/data'
import { analyticsRepository, gameRepository } from '../services/data'
import type {
  ArmyList,
  ArmyListCommunitySummary,
  CommunityCommandCenterData,
  HallOfFameData,
  HomeData,
  LeagueIntelligenceData,
  LeagueRecordValue,
  PortalSettings,
  RecentGame,
  StreamedGame,
} from '../services/api'
import { apiClient } from '../services/api'
import type { DashboardData, DivisionStandings } from '../types/dashboard'

type DashboardDataContextValue = {
  home: HomeData | null
  homeStatus: 'loading' | 'success' | 'error'
  homeError: string | null
  deferredStatus: Record<DashboardDeferredKey, DashboardDeferredStatus>
  loadDeferredSections: (sections: DashboardDeferredKey[]) => void
  communityCommandCenter: CommunityCommandCenterData | null
  communityCommandCenterStatus: 'idle' | 'loading' | 'success' | 'error'
  communityCommandCenterError: string | null
}

type DashboardDataProviderProps = {
  authenticated: boolean
  children: ReactNode
  communityCacheKey: string
}

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null)
const pendingCommunityRequests = new Map<
  string,
  Promise<CommunityCommandCenterData>
>()

export type DashboardDeferredKey =
  | 'allStandings'
  | 'armyLists'
  | 'hallOfFame'
  | 'intelligence'
  | 'records'
  | 'recentGames'
  | 'streams'

type DashboardDeferredStatus = 'idle' | 'loading' | 'success' | 'error'

function loadCommunityCommandCenter(cacheKey: string) {
  const existing = pendingCommunityRequests.get(cacheKey)

  if (existing) {
    return existing
  }

  const pending = dashboardRepository
    .getCommunityCommandCenter()
    .finally(() => {
      pendingCommunityRequests.delete(cacheKey)
    })

  pendingCommunityRequests.set(cacheKey, pending)

  return pending
}

function loadDashboardSummary() {
  return dashboardRepository.getDashboard()
}

const dashboardCacheRevalidatedEvent = 'lobo:cache-revalidated'

type CacheRevalidatedDetail = {
  action?: unknown
  cacheKey?: unknown
  eventId?: unknown
}

function isDashboardCacheRevalidation(event: Event) {
  if (!(event instanceof CustomEvent)) {
    return false
  }

  const detail = event.detail as CacheRevalidatedDetail | null

  return (
    detail?.action === 'dashboard' &&
    detail.eventId === '' &&
    typeof detail.cacheKey === 'string' &&
    detail.cacheKey.endsWith('|dashboard?')
  )
}

function getDeferredSectionForCacheRevalidation(event: Event) {
  if (!(event instanceof CustomEvent)) {
    return null
  }

  const detail = event.detail as CacheRevalidatedDetail | null

  switch (detail?.action) {
    case 'standings':
      return 'allStandings'
    case 'armyLists':
      return 'armyLists'
    case 'hallOfFame':
      return 'hallOfFame'
    case 'intelligence':
      return 'intelligence'
    case 'records':
      return 'records'
    case 'recentGames':
      return typeof detail.cacheKey === 'string' && detail.cacheKey.includes('gameType=all')
        ? 'recentGames'
        : null
    case 'streams':
      return 'streams'
    default:
      return null
  }
}

function loadRecentGames() {
  return gameRepository.getRecentGames({ gameType: 'all' })
}

function loadIntelligence() {
  return analyticsRepository.getAnalytics()
}

function loadRecords() {
  return analyticsRepository.getRecords()
}

function loadHallOfFame() {
  return analyticsRepository.getHallOfFame()
}

function loadStreams() {
  return apiClient.getStreams()
}

function loadAllStandings() {
  return standingsRepository.getAllStandings()
}

function loadArmyLists() {
  return apiClient.getArmyLists().then((data) => ({
    community: data.community,
    lists: data.lists,
  }))
}

export function DashboardDataProvider({
  authenticated,
  children,
  communityCacheKey,
}: DashboardDataProviderProps) {
  const [homeState, setHomeState] = useState<{
    dashboard: DashboardData | null
    deferred: DashboardDeferredData
    deferredStatus: Record<DashboardDeferredKey, DashboardDeferredStatus>
    status: 'loading' | 'success' | 'error'
    error: string | null
  }>({
    dashboard: null,
    deferred: createEmptyDeferredData(),
    deferredStatus: createInitialDeferredStatus(),
    status: 'loading',
    error: null,
  })
  const requestedDeferredSections = useRef(new Set<DashboardDeferredKey>())

  const [communityState, setCommunityState] = useState<{
    data: CommunityCommandCenterData | null
    status: 'idle' | 'loading' | 'success' | 'error'
    error: string | null
  }>({
    data: null,
    status: authenticated ? 'loading' : 'idle',
    error: null,
  })

  useEffect(() => {
    let isActive = true

    const applyDashboard = (data: DashboardData) => {
      if (!isActive) {
        return
      }

      setHomeState((current) => ({
        ...current,
        dashboard: data,
        status: 'success',
        error: null,
      }))
    }

    const handleCacheRevalidated = (event: Event) => {
      if (isDashboardCacheRevalidation(event)) {
        // apiCore publishes this event only after replacing its memory cache.
        // This normalized reread is therefore local and does not issue a second request.
        void loadDashboardSummary().then(applyDashboard).catch(() => {
          // The already-rendered stale Dashboard remains usable on refresh failure.
        })
        return
      }

      const section = getDeferredSectionForCacheRevalidation(event)
      if (!section || !requestedDeferredSections.current.has(section)) {
        return
      }

      void loadDashboardDeferredSection(section)
        .then((updater) => {
          if (!isActive) {
            return
          }

          setHomeState((current) => ({
            ...current,
            deferred: updater(current.deferred),
            deferredStatus: {
              ...current.deferredStatus,
              [section]: 'success',
            },
          }))
        })
        .catch(() => {
          // Retain the already-rendered stale deferred section on refresh failure.
        })
    }

    window.addEventListener(
      dashboardCacheRevalidatedEvent,
      handleCacheRevalidated,
    )

    loadDashboardSummary()
      .then(applyDashboard)
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setHomeState((current) => ({
          ...current,
          dashboard: null,
          status: 'error',
          error:
            error instanceof Error
              ? error.message
              : 'Dashboard data could not be loaded.',
        }))
      })

    return () => {
      isActive = false
      window.removeEventListener(
        dashboardCacheRevalidatedEvent,
        handleCacheRevalidated,
      )
    }
  }, [])

  const loadDeferredSections = useCallback((sections: DashboardDeferredKey[]) => {
    const pendingSections = sections.filter(
      (section) => !requestedDeferredSections.current.has(section),
    )

    if (pendingSections.length === 0) {
      return
    }

    for (const section of pendingSections) {
      requestedDeferredSections.current.add(section)
    }

    setHomeState((current) => ({
      ...current,
      deferredStatus: {
        ...current.deferredStatus,
        ...Object.fromEntries(
          pendingSections.map((section) => [section, 'loading' as const]),
        ),
      },
    }))

    for (const section of pendingSections) {
      void loadDashboardDeferredSection(section)
        .then((updater) => {
          setHomeState((current) => ({
            ...current,
            deferred: updater(current.deferred),
            deferredStatus: {
              ...current.deferredStatus,
              [section]: 'success',
            },
          }))
        })
        .catch(() => {
          requestedDeferredSections.current.delete(section)
          setHomeState((current) => ({
            ...current,
            deferredStatus: {
              ...current.deferredStatus,
              [section]: 'error',
            },
          }))
        })
    }
  }, [])

  useEffect(() => {
    let isActive = true

    if (!authenticated) {
      queueMicrotask(() => {
        if (!isActive) {
          return
        }

        setCommunityState({
          data: null,
          status: 'idle',
          error: null,
        })
      })

      return () => {
        isActive = false
      }
    }

    if (homeState.status !== 'success') {
      queueMicrotask(() => {
        if (!isActive) {
          return
        }

        setCommunityState({
          data: null,
          status: 'loading',
          error: null,
        })
      })

      return () => {
        isActive = false
      }
    }

    queueMicrotask(() => {
      if (!isActive) {
        return
      }

      setCommunityState({
        data: null,
        status: 'loading',
        error: null,
      })
    })

    loadCommunityCommandCenter(communityCacheKey)
      .then((data) => {
        if (!isActive) {
          return
        }

        setCommunityState({
          data,
          status: 'success',
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setCommunityState({
          data: null,
          status: 'error',
          error:
            error instanceof Error
              ? error.message
              : 'Community command center could not be loaded.',
        })
      })

    return () => {
      isActive = false
    }
  }, [authenticated, communityCacheKey, homeState.status])

  const value = useMemo(
    () => ({
      home: homeState.dashboard
        ? buildHomeData(homeState.dashboard, homeState.deferred)
        : null,
      homeStatus: homeState.status,
      homeError: homeState.error,
      deferredStatus: homeState.deferredStatus,
      loadDeferredSections,
      communityCommandCenter: communityState.data,
      communityCommandCenterStatus: communityState.status,
      communityCommandCenterError: communityState.error,
    }),
    [homeState, loadDeferredSections, communityState],
  )

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  )
}

type DashboardDeferredData = {
  allStandings: DivisionStandings[]
  armyListCommunity: ArmyListCommunitySummary
  armyLists: ArmyList[]
  hallOfFame: HallOfFameData
  intelligence: LeagueIntelligenceData
  records: Record<string, LeagueRecordValue>
  streams: StreamedGame[]
  recentGames: RecentGame[]
}

async function loadDashboardDeferredSection(section: DashboardDeferredKey) {
  switch (section) {
    case 'allStandings': {
      const allStandings = await loadAllStandings()
      return (current: DashboardDeferredData) => ({ ...current, allStandings })
    }
    case 'armyLists': {
      const armyListData = await loadArmyLists()
      return (current: DashboardDeferredData) => ({
        ...current,
        armyListCommunity: armyListData.community,
        armyLists: armyListData.lists,
      })
    }
    case 'hallOfFame': {
      const hallOfFame = await loadHallOfFame()
      return (current: DashboardDeferredData) => ({ ...current, hallOfFame })
    }
    case 'intelligence': {
      const intelligence = await loadIntelligence()
      return (current: DashboardDeferredData) => ({ ...current, intelligence })
    }
    case 'records': {
      const records = await loadRecords()
      return (current: DashboardDeferredData) => ({ ...current, records })
    }
    case 'recentGames': {
      const recentGames = await loadRecentGames()
      return (current: DashboardDeferredData) => ({ ...current, recentGames })
    }
    case 'streams': {
      const streams = await loadStreams()
      return (current: DashboardDeferredData) => ({ ...current, streams })
    }
  }
}

function buildHomeData(
  dashboard: DashboardData,
  deferred: DashboardDeferredData,
): HomeData {
  return {
    allStandings: deferred.allStandings,
    armyListCommunity: deferred.armyListCommunity,
    armyLists: deferred.armyLists,
    dashboard,
    hallOfFame: deferred.hallOfFame,
    intelligence: deferred.intelligence,
    news: [],
    quickStats: {
      activePlayers: dashboard.summary.activePlayers,
      armyLists: deferred.armyLists.length,
      games: dashboard.summary.gamesPlayed,
      news: 0,
      recentGames: deferred.recentGames.length,
      streams: deferred.streams.length,
    },
    recentGames: deferred.recentGames,
    records: deferred.records,
    settings: createEmptySettings(),
    streams: deferred.streams,
  }
}

function createEmptyDeferredData(): DashboardDeferredData {
  return {
    allStandings: [],
    armyListCommunity: {
      highestRatedDesigner: null,
      mostListsSubmitted: [],
      mostPopularFaction: '',
      topContributors: [],
      trendingLists: [],
    },
    armyLists: [],
    hallOfFame: {
      careerLeaders: {
        achievementPoints: [],
        championships: [],
        communityAwards: [],
        promotions: [],
        seasonsPlayed: [],
        winPercentage: [],
      },
      leaders: {
        draws: [],
        games: [],
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
    },
    intelligence: {
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
    },
    recentGames: [],
    records: {},
    streams: [],
  }
}

function createInitialDeferredStatus(): Record<DashboardDeferredKey, DashboardDeferredStatus> {
  return {
    allStandings: 'idle',
    armyLists: 'idle',
    hallOfFame: 'idle',
    intelligence: 'idle',
    records: 'idle',
    recentGames: 'idle',
    streams: 'idle',
  }
}

function createEmptySettings(): PortalSettings {
  return {
    bannerImage: '',
    commissionerContact: '',
    commissionerEmails: '',
    currentSeason: '',
    deploymentUrl: '',
    discordInvite: '',
    discordServerName: 'Lobo Infinity League Discord',
    gitCommit: '',
    googleFormUrl: '',
    joinCommunityFormUrl: '',
    googleOAuthClientId: '',
    leagueLogo: '',
    leagueName: '',
    leagueWebsite: '',
    portalVersion: '',
    registrationOpen: '',
    seasonEndDate: '',
    seasonStartDate: '',
    submissionButtonText: '',
    submissionButtonVisible: '',
    submissionEnabled: '',
    themeAccentColor: '',
  }
}

export function useDashboardDataContext(): DashboardDataContextValue {
  const context = useContext(DashboardDataContext)

  if (!context) {
    throw new Error(
      'useDashboardDataContext must be used within DashboardDataContext.Provider',
    )
  }

  return context
}
