/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { dashboardRepository, standingsRepository } from '../services/data'
import { analyticsRepository, gameRepository } from '../services/data'
import type {
  ArmyList,
  ArmyListCommunitySummary,
  CommunityCommandCenterData,
  CommissionerNewsItem,
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
const dashboardCache = createDashboardCache<DashboardData>()
const recentGamesCache = createDashboardCache<RecentGame[]>()
const newsCache = createDashboardCache<CommissionerNewsItem[]>()
const intelligenceCache = createDashboardCache<LeagueIntelligenceData>()
const recordsCache = createDashboardCache<Record<string, LeagueRecordValue>>()
const hallOfFameCache = createDashboardCache<HallOfFameData>()
const streamsCache = createDashboardCache<StreamedGame[]>()
const allStandingsCache = createDashboardCache<DivisionStandings[]>()
const armyListsCache = createDashboardCache<{
  community: ArmyListCommunitySummary
  lists: ArmyList[]
}>()
const pendingCommunityRequests = new Map<
  string,
  Promise<CommunityCommandCenterData>
>()

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
  return dashboardCache.load('dashboard', () => dashboardRepository.getDashboard())
}

function loadRecentGames() {
  return recentGamesCache.load('recentGames', () => gameRepository.getRecentGames())
}

function loadNews() {
  return newsCache.load('news', () => apiClient.getNews())
}

function loadIntelligence() {
  return intelligenceCache.load('intelligence', () => analyticsRepository.getAnalytics())
}

function loadRecords() {
  return recordsCache.load('records', () => analyticsRepository.getRecords())
}

function loadHallOfFame() {
  return hallOfFameCache.load('hallOfFame', () => analyticsRepository.getHallOfFame())
}

function loadStreams() {
  return streamsCache.load('streams', () => apiClient.getStreams())
}

function loadAllStandings() {
  return allStandingsCache.load('allStandings', () =>
    standingsRepository.getAllStandings(),
  )
}

function loadArmyLists() {
  return armyListsCache.load('armyLists', () =>
    apiClient.getArmyLists().then((data) => ({
      community: data.community,
      lists: data.lists,
    })),
  )
}

export function DashboardDataProvider({
  authenticated,
  children,
  communityCacheKey,
}: DashboardDataProviderProps) {
  const [homeState, setHomeState] = useState<{
    dashboard: DashboardData | null
    deferred: DashboardDeferredData
    status: 'loading' | 'success' | 'error'
    error: string | null
  }>({
    dashboard: null,
    deferred: createEmptyDeferredData(),
    status: 'loading',
    error: null,
  })

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

    loadDashboardSummary()
      .then((data) => {
        if (!isActive) {
          return
        }

        setHomeState((current) => ({
          ...current,
          dashboard: data,
          status: 'success',
          error: null,
        }))

        void loadDeferredDashboardData((updater) => {
          if (!isActive) {
            return
          }

          setHomeState((current) => ({
            ...current,
            deferred: updater(current.deferred),
          }))
        })
      })
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
      communityCommandCenter: communityState.data,
      communityCommandCenterStatus: communityState.status,
      communityCommandCenterError: communityState.error,
    }),
    [homeState, communityState],
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
  news: CommissionerNewsItem[]
  records: Record<string, LeagueRecordValue>
  streams: StreamedGame[]
  recentGames: RecentGame[]
}

type DashboardCacheEntry<T> = {
  expiresAt: number
  pending: Promise<T> | null
  value: T | null
}

const dashboardCacheTtlMs = 30_000

function createDashboardCache<T>() {
  const entries = new Map<string, DashboardCacheEntry<T>>()

  return {
    load(key: string, loader: () => Promise<T>) {
      const now = Date.now()
      const existing = entries.get(key)

      if (existing?.value && existing.expiresAt > now) {
        return Promise.resolve(existing.value)
      }

      if (existing?.pending) {
        return existing.pending
      }

      const pending = loader()
        .then((value) => {
          entries.set(key, {
            expiresAt: Date.now() + dashboardCacheTtlMs,
            pending: null,
            value,
          })
          return value
        })
        .catch((error: unknown) => {
          entries.delete(key)
          throw error
        })

      entries.set(key, {
        expiresAt: 0,
        pending,
        value: existing?.value ?? null,
      })

      return pending
    },
  }
}

async function loadDeferredDashboardData(
  update: (updater: (current: DashboardDeferredData) => DashboardDeferredData) => void,
) {
  await Promise.allSettled([
    loadRecentGames().then((recentGames) =>
      update((current) => ({ ...current, recentGames })),
    ),
    loadNews().then((news) => update((current) => ({ ...current, news }))),
    loadIntelligence().then((intelligence) =>
      update((current) => ({ ...current, intelligence })),
    ),
    loadRecords().then((records) =>
      update((current) => ({ ...current, records })),
    ),
    loadHallOfFame().then((hallOfFame) =>
      update((current) => ({ ...current, hallOfFame })),
    ),
    loadStreams().then((streams) =>
      update((current) => ({ ...current, streams })),
    ),
    loadAllStandings().then((allStandings) =>
      update((current) => ({ ...current, allStandings })),
    ),
    loadArmyLists().then((armyListData) =>
      update((current) => ({
        ...current,
        armyListCommunity: armyListData.community,
        armyLists: armyListData.lists,
      })),
    ),
  ])
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
    news: deferred.news,
    quickStats: {
      activePlayers: dashboard.summary.activePlayers,
      armyLists: deferred.armyLists.length,
      games: dashboard.summary.gamesPlayed,
      news: deferred.news.length,
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
    news: [],
    recentGames: [],
    records: {},
    streams: [],
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
    gitCommit: '',
    googleFormUrl: '',
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
