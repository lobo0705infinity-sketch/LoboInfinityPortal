import type {
  DashboardData,
  DashboardSummary,
  DivisionKey,
  DivisionStandings,
  LeagueOverview,
  LeagueOverviewDivision,
  Standing,
} from '../types/dashboard'

const API_URL =
  'https://script.google.com/macros/s/AKfycbxBzo57XHrxiBy1EJq4f_VS026uTXnCYHSXrWT6c2uU__zSB2Dzeixx3rFHQahXQycCng/exec'

type ApiOptions = {
  signal?: AbortSignal
}

type RequestParams = Record<string, string>

let activeAuthToken = ''
let activeOAuthClientId = ''
const frontendCacheTtlMs = 300_000
const frontendResponseCache = new Map<
  string,
  {
    expiresAt: number
    payload: unknown
  }
>()
const inFlightRequests = new Map<string, Promise<unknown>>()

export function setApiAuthToken(token: string) {
  activeAuthToken = token
  frontendResponseCache.clear()
  inFlightRequests.clear()
}

export function setApiOAuthClientId(clientId: string) {
  activeOAuthClientId = clientId
}

export type ArmyList = {
  id: number
  submissionDate: string
  player: string
  playerDisplayName: string
  faction: string
  sectorial: string
  mission: string
  event: string
  armyCode: string
  armyLink: string
  armyName: string
  description: string
  submitterEmail: string
  upvotes: number
  downvotes: number
  score: number
  approved: boolean
}

export type ArmyListSubmission = {
  player: string
  faction: string
  sectorial: string
  mission: string
  event: string
  armyCode: string
  armyLink: string
  armyName: string
  description: string
  submitterEmail?: string
}

export type ArmyListCommunitySummary = {
  topContributors: Array<{ count: number; displayName?: string; name: string }>
  highestRatedDesigner: {
    displayName?: string
    lists: number
    name: string
    score: number
  } | null
  mostPopularFaction: string
  trendingLists: ArmyList[]
  mostListsSubmitted: Array<{ count: number; displayName?: string; name: string }>
}

export type UserRole =
  | 'Guest'
  | 'League Member'
  | 'Assistant Commissioner'
  | 'Commissioner'

export type PortalUser = {
  email: string
  displayName: string
  leaguePlayer: string
  playerDisplayName: string
  leagueDivision: string
  role: UserRole
  enabled: boolean
  favoriteFaction: string
  avatarUrl: string
  created: string
  lastLogin: string
  lastSeen: string
  notificationPreferences: Record<string, unknown>
  themePreference: string
  dismissedAlerts: string[]
  readAlerts: string[]
  archivedAlerts: string[]
  lastPage: string
  searchHistory: string[]
}

export type PortalPermissions = Record<string, boolean>

export type AuthSession = {
  authenticated: boolean
  user: PortalUser
  permissions: PortalPermissions
  oauthConfigured: boolean
  error: string
}

export type MyProfileData = {
  user: PortalUser
  submittedLists: ArmyList[]
  votesCast: number
  recentActivity: LeagueTimelineItem[]
  recentGames: RecentGame[]
  leagueStatistics: PlayerProfileData | null
  currentSeasonStatistics: ProfileStatisticsSnapshot | null
  careerStatistics: ProfileStatisticsSnapshot | null
  leaguePerformance: ProfileLeaguePerformance
  intelligence: ProfileIntelligenceContext
  achievements: ProfileAchievement[]
  futureSections: string[]
}

export type ProfileStatisticsSnapshot = {
  division: string
  rank: number
  games: number
  wins: number
  losses: number
  tp: number
  op: number
  vp: number
  winPercentage: number
  averageTournamentPoints: number
  averageObjectivePoints: number
  averageVictoryPoints: number
  promotionStatus: string
  seasonProgress: number
}

export type ProfileAchievement = {
  id: string
  name: string
  title: string
  description: string
  category: string
  tier: string
  icon: string
  points: number
  unlocked: boolean
  dateEarned: string
  seasonEarned: string
  visibility: string
  automatic: boolean
  commissionerAward: boolean
  progress: number
  requirement: string
  value: string
}

export type ProfileGameSummary = {
  gameId: number
  date: string
  opponent: string
  mission: string
  margin: number
  score: string
}

export type ProfileLeaguePerformance = {
  bestOpponent: string
  worstOpponent: string
  longestWinStreak: number
  longestLosingStreak: number
  currentStreak: string
  mostPlayedOpponent: string
  closestVictory: ProfileGameSummary | null
  worstDefeat: ProfileGameSummary | null
  fallbackBestOpponent: string
  fallbackWorstOpponent: string
}

export type ProfileIntelligenceAverage = {
  players: number
  games: number
  averageTP: number
  averageOP: number
  averageVP: number
  winPercentage: number
}

export type ProfileIntelligenceContext = {
  player: string
  division: string
  divisionAverage: ProfileIntelligenceAverage
  leagueAverage: ProfileIntelligenceAverage
  topThreeAverage: ProfileIntelligenceAverage
  ranks: {
    objectivePoints: number
    tournamentPoints: number
    victoryPoints: number
    winPercentage: number
  }
}

export type ArmyListsData = {
  lists: ArmyList[]
  community: ArmyListCommunitySummary
}

export type PlayerArmyListSummary = {
  submitted: number
  highestRated: ArmyList | null
  newest: ArmyList | null
  averageRating: number
  favoriteFaction: string
}

export type FactionMatchup = {
  opponent: string
  games: number
  wins: number
  losses: number
  winRate: number
  averageTP: number
  averageOP: number
  averageVP: number
}

export type FactionMatchupSummary = {
  opponents: number
  games: number
  wins: number
  losses: number
  winRate: number
  bestOpponent: string
}

export type FactionArmyLists = {
  mostPopular: ArmyList[]
  highestRated: ArmyList[]
  newest: ArmyList[]
}

type DashboardApiResponse = {
  success?: boolean
  leader: Standing
  topFaction: string
  gamesPlayed: number
  activePlayers: number
  mainManStandings: Standing[]
  leagueOverview?: LeagueOverview
}

export type PlayerProfileData = {
  name: string
  displayName: string
  division: string
  rank: number
  games: number
  wins: number
  losses: number
  tp: number
  op: number
  vp: number
  favoriteFaction: string
  favoriteMission: string
  firstTurnGames: number
  secondTurnGames: number
  firstTurnWinRate: number
  secondTurnWinRate: number
  bestFaction: string
  rival: string
  nemesis: string
  armyLists: ArmyList[]
  armyListSummary: PlayerArmyListSummary
}

export type RecentGame = {
  id: number
  date: string
  division: string
  winner: string
  winnerDisplayName: string
  loser: string
  loserDisplayName: string
  winnerFaction: string
  loserFaction: string
  mission: string
  tp: string
  op: string
  vp: string
  bestMoment: string
  firstTurn: string
}

export type FactionDivisionBreakdown = {
  division: string
  games: number
}

export type FactionSummary = {
  name: string
  games: number
  wins: number
  losses: number
  winRate: number
  averageTP: number
  averageOP: number
  averageVP: number
  topPlayer: string
  topPlayerDisplayName: string
  lastPlayed: string
  divisionBreakdown: FactionDivisionBreakdown[]
}

export type FactionBestMoment = {
  gameId: number
  date: string
  mission: string
  moment: string
}

export type FactionProfileData = FactionSummary & {
  mostPlayedMission: string
  recentGames: RecentGame[]
  bestMoments: FactionBestMoment[]
  matchups: FactionMatchup[]
  matchupSummary: FactionMatchupSummary
  armyLists: FactionArmyLists
}

export type MissionDivisionBreakdown = {
  division: string
  games: number
}

export type MissionBestMoment = {
  gameId: number
  date: string
  mission: string
  moment: string
}

export type MissionSummary = {
  mission: string
  games: number
  averageTP: number
  averageOP: number
  averageVP: number
  firstTurnWinRate: number
  mostSuccessfulFaction: string
  lastPlayed: string
}

export type MissionProfileData = MissionSummary & {
  mostPlayedFaction: string
  recentGames: RecentGame[]
  bestMoments: MissionBestMoment[]
  divisionBreakdown: MissionDivisionBreakdown[]
}

export type IntelligenceGame = {
  id: number
  date: string
  division: string
  mission: string
  winner: string
  winnerDisplayName: string
  loser: string
  loserDisplayName: string
  winnerFaction: string
  loserFaction: string
  vp: string
  op: string
  tp: string
  value: number
  label: string
  story: string
}

export type IntelligenceStreak = {
  player: string
  displayName: string
  games: number
  type: string
  story: string
}

export type FactionMomentum = {
  faction: string
  games: number
  wins: number
  losses: number
  trend: string
  story: string
}

export type IntelligenceMissionTrend = {
  mission: string
  games: number
  averageVP: number
  averageOP: number
  averageTP: number
  firstTurnWinRate: number
  mostSuccessfulFaction: string
  story: string
}

export type StandingsBattle = {
  division: string
  player: string
  displayName: string
  rank: number
  tp: number
  op: number
  vp: number
  chaser?: string
  chaserDisplayName?: string
  target?: string
  targetDisplayName?: string
  withinOneGame: boolean
  story: string
}

export type RecentUpset = {
  id: number
  date: string
  division: string
  winner: string
  winnerDisplayName: string
  loser: string
  loserDisplayName: string
  winnerRank: number
  loserRank: number
  mission: string
  story: string
}

export type LeagueRecordValue =
  | IntelligenceGame
  | {
      faction?: string
      displayName?: string
      games: number
      name?: string
      story: string
      type?: string
      winRate?: number
      wins?: number
    }
  | null

export type LeagueIntelligenceData = {
  winStreaks: IntelligenceStreak[]
  losingStreaks: IntelligenceStreak[]
  highestVPGames: IntelligenceGame[]
  biggestVictories: IntelligenceGame[]
  closestGames: IntelligenceGame[]
  factionMomentum: FactionMomentum[]
  missionTrends: IntelligenceMissionTrend[]
  recentUpsets: RecentUpset[]
  promotionBattle: StandingsBattle[]
  relegationBattle: StandingsBattle[]
  records: Record<string, LeagueRecordValue>
}

export type CommissionerNewsItem = {
  body: string
  id: number
  date: string
  link: string
  relatedFaction: string
  relatedMission: string
  relatedPlayer: string
  title: string
}

export type LeagueNotification = {
  body: string
  id: string
  link: string
  priority: string
  timestamp: string
  title: string
  type: string
  unread: boolean
}

export type LeagueTimelineItem = {
  body: string
  id: string
  link: string
  relatedFaction: string
  relatedMission: string
  relatedPlayer: string
  timestamp: string
  title: string
  type: string
}

export type HallOfFameLeader = {
  division: string
  player: string
  displayName: string
  rank: number
  games: number
  wins: number
  losses: number
  tp: number
  op: number
  vp: number
}

export type HallOfFameCareer = HallOfFameLeader & {
  achievementPoints: number
  seasonsPlayed: number
  promotions: number
  relegations: number
  championships: number
  awards: number
  achievements: number
  winPercentage: number
  seasons: HallOfFameSeason[]
  hallOfFameEntries: string[]
  timeline: HallOfFameTimelineItem[]
}

export type HallOfFameSeason = {
  season: string
  division: string
  finalRank: number | string
  record: string
  tp: number
  op: number
  vp: number
  movement: string
  achievementsEarned: number
  armyListsSubmitted: number
  specialAwards: number
  date: string
  details: string
}

export type HallOfFameRecordBookItem = {
  title: string
  value: string
  holder: string
  story: string
}

export type HallOfFameTimelineItem = {
  id?: string
  type: string
  title: string
  body: string
  timestamp: string
  relatedPlayer?: string
}

export type HallOfFameData = {
  leaders: {
    games: HallOfFameLeader[]
    objectivePoints: HallOfFameLeader[]
    tournamentPoints: HallOfFameLeader[]
    victoryPoints: HallOfFameLeader[]
    wins: HallOfFameLeader[]
  }
  records: Record<string, LeagueRecordValue>
  careerLeaders: {
    achievementPoints: HallOfFameCareer[]
    championships: HallOfFameCareer[]
    communityAwards: HallOfFameCareer[]
    promotions: HallOfFameCareer[]
    seasonsPlayed: HallOfFameCareer[]
    winPercentage: HallOfFameCareer[]
  }
  recordBook: HallOfFameRecordBookItem[]
  leagueHistory: HallOfFameTimelineItem[]
  seasonHistory: HallOfFameSeason[]
  playerCareers: HallOfFameCareer[]
}

export type PlayerComparisonPlayer = PlayerProfileData & {
  favoriteFaction: string
  favoriteMission: string
  bestFaction: string
}

export type PlayerComparisonData = {
  headToHead: {
    games: number
    leftWins: number
    rightWins: number
  }
  players: PlayerComparisonPlayer[]
}

export type SearchData = {
  players: DivisionStandings[]
  factions: FactionSummary[]
  missions: MissionSummary[]
  games: RecentGame[]
  armyLists: ArmyList[]
}

export type HomeData = {
  dashboard: DashboardData
  recentGames: RecentGame[]
  news: CommissionerNewsItem[]
  intelligence: LeagueIntelligenceData
  records: Record<string, LeagueRecordValue>
  hallOfFame: HallOfFameData
  settings: PortalSettings
  streams: StreamedGame[]
  armyLists: ArmyList[]
  armyListCommunity: ArmyListCommunitySummary
  quickStats: {
    activePlayers: number
    armyLists: number
    games: number
    news: number
    recentGames: number
    streams: number
  }
}

export type SeasonAvailability = {
  notes: string
  player: string
  preferredDays: string
  preferredTimes: string
  status: string
  updatedAt: string
}

export type SeasonOpponent = {
  availability: SeasonAvailability
  displayName: string
  gameId: number
  games: number
  lastResult: string
  player: string
  rank: number
  status: string
}

export type SeasonCommandPlayer = {
  displayName: string
  division: string
  games: number
  losses: number
  op: number
  player: string
  rank: number
  tp: number
  vp: number
  wins: number
}

export type SeasonProgress = {
  completionPercentage: number
  gamesCompleted: number
  gamesRemaining: number
  gamesRequired: number
  midseasonProgress: number
  opponentsCompleted: number
  opponentsRemaining: number
  seasonProgress: number
}

export type SeasonRecommendation = {
  availability: SeasonAvailability
  displayName: string
  player: string
  rank: number
  reason: string
  urgency: string
}

export type SeasonDeadlines = {
  currentWeek: number
  gamesNeededBeforeEnd: number
  gamesNeededBeforeMidseason: number
  lateStatus: string
  midseasonDeadline: string
  seasonEndDeadline: string
}

export type SeasonPromotionTracker = {
  currentRank: number
  gamesNeeded: number
  magicNumber: number
  projectedFinish: number
  promotionZone: boolean
  relegationZone: boolean
  safe: boolean
  status: string
}

export type SeasonDivisionStatus = SeasonCommandPlayer & {
  pairingStatus: string
}

export type SeasonLeagueActivity = {
  playersCatchingUp: SeasonCommandPlayer[]
  promotionRace: SeasonCommandPlayer[]
  recentDivisionGames: RecentGame[]
  relegationRace: SeasonCommandPlayer[]
}

export type SeasonCommissionerStatus = {
  behind: number
  division: string
  finished: number
  latePlayers: Array<{
    displayName: string
    games: number
    player: string
  }>
  missingPairings: number
}

export type SeasonCommandCenterData = {
  availability: SeasonAvailability
  commissioner: SeasonCommissionerStatus
  deadlines: SeasonDeadlines
  divisionStatus: SeasonDivisionStatus[]
  leagueActivity: SeasonLeagueActivity
  nextOpponents: SeasonRecommendation[]
  opponents: SeasonOpponent[]
  player: SeasonCommandPlayer
  progress: SeasonProgress
  promotion: SeasonPromotionTracker
}

export type CommunityCommandEvent = {
  completionPercentage: number
  eventId: string
  gamesRemaining: number
  link: string
  name: string
  primaryAction: string
  status: string
  statusDetail: string
  type: string
}

export type CommunityOpponentCard = {
  availability: SeasonAvailability
  displayName: string
  division: string
  gamesCompleted: number
  lastActivity: string
  player: string
  quickMessage: string
  rank: number
  reason: string
  suggestedPriority: string
  status: string
}

export type CommunityCommandAction = {
  label: string
  link: string
  priority: string
}

export type CommunityCommandWelcome = {
  currentActiveEvents: number
  currentLeague: string
  currentRank: number
  displayName: string
  leaguePlayer: string
  playerDisplayName: string
}

export type CommunityCommandActivity = {
  featuredBattle: RecentGame | null
  latestAchievements: LeagueNotification[]
  latestResults: RecentGame[]
  news: CommissionerNewsItem[]
  streams: StreamedGame[]
}

export type CommunityCommandSchedule = {
  currentRound: string
  deadlines: SeasonDeadlines
  gamesRemaining: number
  upcomingEventDates: string[]
}

export type CommunityNudge = {
  category: string
  deepLink: string
  priority: string
  reason: string
  suggestedAction: string
}

export type CommunityEventSwitcherItem = {
  active: boolean
  eventId: string
  label: string
  link: string
  status: string
  type: string
}

export type CommunityCommandCenterData = {
  activeEvents: CommunityCommandEvent[]
  communityActivity: CommunityCommandActivity
  eventSwitcher: CommunityEventSwitcherItem[]
  intelligence: string[]
  nudgeEngine: CommunityNudge[]
  nextActions: CommunityCommandAction[]
  opponentTracker: {
    completed: CommunityOpponentCard[]
    progress: {
      completionPercentage: number
      gamesCompleted: number
      gamesRemaining: number
      gamesRequired: number
    }
    remaining: CommunityOpponentCard[]
    suggested: SeasonRecommendation | null
  }
  promotion: SeasonPromotionTracker
  quickActions: Array<{
    label: string
    link: string
  }>
  schedule: CommunityCommandSchedule
  today: CommunityCommandAction[]
  welcome: CommunityCommandWelcome
}

export type PortalSettings = {
  currentSeason: string
  leagueName: string
  googleFormUrl: string
  discordInvite: string
  leagueWebsite: string
  submissionEnabled: string
  submissionButtonText: string
  submissionButtonVisible: string
  bannerImage: string
  leagueLogo: string
  commissionerContact: string
  themeAccentColor: string
  seasonStartDate: string
  seasonEndDate: string
  registrationOpen: string
  googleOAuthClientId: string
  commissionerEmails: string
  portalVersion: string
  gitCommit: string
  deploymentUrl: string
}

export type AuditIssue = {
  severity: 'critical' | 'warning' | 'info'
  description: string
  suggestedFix: string
  link: string
}

export type LeagueAudit = {
  summary: {
    critical: number
    warning: number
    informational: number
  }
  issues: AuditIssue[]
}

export type OperationsNewsItem = CommissionerNewsItem & {
  pinned: boolean
  archived: boolean
}

export type SeasonStatus = {
  currentSeasonName: string
  startDate: string
  endDate: string
  weeksCompleted: number
  matchesPlayed: number
  remainingMatches: number
  registrationOpen: boolean
}

export type OperationsDashboardData = {
  summary: {
    pendingArmyLists: number
    pendingStreams: number
    pendingNews: number
    recentMatchSubmissions: RecentGame[]
    leagueStatistics: {
      games: number
      activePlayers: number
      factions: number
      missions: number
    }
    cacheStatus: {
      status: string
      version: string
      lastRefresh: string
      cacheAge: string
      entries: Array<{
        action: string
        ageSeconds: number
        createdAt: string
        expiresAt: string
        group: string
        health: string
        lastRefresh: string
        size: number
        status: string
        timeRemainingSeconds: number
        version: string
      }>
      performance: {
        averageApiResponse: string
        cacheHitRate: number
        cacheMissRate: number
        errors: number
        estimatedPerformanceImprovement: string
        fastestEndpoint: string
        googleSheetsReads: number
        slowestEndpoint: string
        staleFallbacks: number
        totalCacheRefreshes: number
      }
    }
    systemHealth: Record<string, string>
    leagueAuditSummary: LeagueAudit['summary']
    seasonStatus: SeasonStatus
    identityStatus: OperationsIdentityStatus
    notificationStatus: OperationsNotificationStatus
    discordStatus: OperationsDiscordStatus
    deploymentStatus: OperationsDeploymentStatus
  }
  pendingArmyLists: ArmyList[]
  streams: StreamedGame[]
  news: OperationsNewsItem[]
  players: OperationsPlayer[]
  identity: OperationsIdentityManagement
  eventLifecycle: EventLifecycleData
  discord: OperationsDiscordStatus
  settings: PortalSettings
  audit: LeagueAudit
}

export type EventLifecycleEvent = {
  achievements: string
  archive: string
  automation: string
  commissioners: string
  communityId: string
  createdAt: string
  description: string
  discord: string
  endDate: string
  history: string
  id: string
  lifecycleStage: string
  name: string
  owner: string
  participants: string
  registration: string
  rules: string
  scoringModel: string
  seriesId: string
  standingsModel: string
  startDate: string
  status: string
  templateId: string
  type: string
  updatedAt: string
}

export type EventLifecycleTransition = {
  available: boolean
  blockedReason: string
  confirmationBody: string[]
  confirmationTitle: string
  label: string
  repairAction: string
  targetStage: string
}

export type EventLifecycleRollback = {
  available: boolean
  label: string
  reason: string
  targetStage: string
}

export type EventLifecycleWarning = {
  message: string
  severity: string
  suggestedFix: string
}

export type EventLifecycleAuditEntry = {
  automationResult: string
  commissioner: string
  eventId: string
  eventName: string
  newStage: string
  problem: string
  previousStage: string
  repair: string
  reason: string
  timestamp: string
}

export type EventLifecycleValidationIssue = {
  blocksTransition: boolean
  id: string
  impact: string
  problem: string
  reason: string
  recommendedAction: string
  repairAction: string
  repairLabel: string
  severity: string
  targetStage: string
}

export type EventLifecycleValidation = {
  blockingIssues: EventLifecycleValidationIssue[]
  color: string
  healthScore: number
  issues: EventLifecycleValidationIssue[]
  overallStatus: string
  repairable: number
}

export type EventLifecycleData = {
  auditLog: EventLifecycleAuditEntry[]
  automation: {
    destinations: string[]
    enabled: boolean
    eventType: string
    template: {
      body: string
      enabled: boolean
      title: string
    }
  }
  currentRound: string
  currentSeason: string
  currentStage: string
  discord: {
    configured: boolean
    enabled: boolean
    preview: OperationsDiscordPreview
    status: string
    webhookMasked: string
  }
  endDate: string
  event: EventLifecycleEvent
  health: {
    automationHealth: string
    discordStatus: string
    gamesCompleted: number
    gamesRemaining: number
    latePlayers: Array<{
      displayName: string
      games: number
      player: string
    }>
    missingPairings: number
    participants: number
    playersWithoutIdentity: number
    registrationProgress: string
    rounds: number
  }
  nextTransition: EventLifecycleTransition
  participants: number
  registration: string
  rollback: EventLifecycleRollback
  rounds: number
  startDate: string
  status: string
  supportedStages: string[]
  validation: EventLifecycleValidation
  warnings: EventLifecycleWarning[]
}

export type OperationsIdentityStatus = {
  totalUsers: number
  enabledUsers: number
  disabledUsers: number
  linkedUsers: number
  unlinkedUsers: number
  commissionerUsers: number
  assistantUsers: number
  playersWithEmail: number
  playersWithoutEmail: number
  playersWithoutUser: number
}

export type OperationsNotificationStatus = {
  total: number
  highPriority: number
  normalPriority: number
}

export type OperationsDeploymentStatus = {
  portalVersion: string
  appsScriptVersion: string
  deploymentUrl: string
  gitCommit: string
  checkedAt: string
}

export type OperationsDiscordField = {
  inline: boolean
  name: string
  value: string
}

export type OperationsDiscordEmbed = {
  description: string
  fields: OperationsDiscordField[]
  title: string
  url: string
}

export type OperationsDiscordLogEntry = {
  rowNumber: number
  timestamp: string
  event: string
  title: string
  webhook: string
  success: boolean
  failure: string
  retryCount: number
  payload: string
  response: string
  status: string
}

export type OperationsDiscordPreview = {
  event: string
  label: string
  content: string
  embeds: OperationsDiscordEmbed[]
}

export type OperationsDiscordStatus = {
  enabled: boolean
  configured: boolean
  webhookMasked: string
  announcementChannel: string
  adminChannel: string
  rateLimitPerHour: number
  retryLimit: number
  automationEvents: string[]
  lastAutomationRun: string
  queueDepth: number
  failures: number
  lastResult: OperationsDiscordLogEntry | null
  log: OperationsDiscordLogEntry[]
  preview: OperationsDiscordPreview
}

export type AutomationDestination =
  | 'commissionerFeed'
  | 'discord'
  | 'email'
  | 'news'
  | 'portal'
  | 'publicApi'
  | 'push'
  | 'timeline'

export type AutomationRule = Record<AutomationDestination, boolean> & {
  enabled: boolean
  eventType: string
  priority: string
  templateId: string
}

export type AutomationEventType = {
  category: string
  eventType: string
  label: string
  priority: string
  rule: AutomationRule
}

export type AutomationTemplate = {
  body: string
  discordFormat: string
  enabled: boolean
  eventType: string
  name: string
  templateId: string
  title: string
}

export type AutomationQueueItem = {
  attempts: number
  destination: string
  eventId: string
  eventType: string
  lastAttempt: string
  payload: string
  queueId: string
  reason: string
  status: string
  timestamp: string
}

export type AutomationEventRecord = {
  category: string
  destinations: string
  division: string
  eventId: string
  eventType: string
  message: string
  payload: string
  player: string
  priority: string
  status: string
  timestamp: string
}

export type AutomationStatus = {
  discordConnected: boolean
  enabled: boolean
  health: string
  lastAutomationRun: string
  lastFailure: string
  lastMessage: string
  queueSize: number
  retryQueue: number
  webhookHealthy: boolean
}

export type AutomationCenterData = {
  destinations: AutomationDestination[]
  discord: OperationsDiscordStatus
  events: AutomationEventRecord[]
  eventTypes: AutomationEventType[]
  queue: AutomationQueueItem[]
  rules: Record<string, AutomationRule>
  status: AutomationStatus
  templates: AutomationTemplate[]
}

export type OperationsPlayer = {
  division: string
  displayName: string
  games: number
  player: string
  rank: number
}

export type OperationsIdentityRecord = {
  id: string
  player: string
  displayName: string
  division: string
  googleEmail: string
  portalUser: string
  role: string
  lastLogin: string
  lastSeen: string
  linked: boolean
  enabled: boolean
  missingEmail: boolean
  duplicateEmail: boolean
  duplicatePlayer: boolean
  neverLoggedIn: boolean
  brokenMapping: boolean
}

export type OperationsIdentityAudit = {
  severity: 'critical' | 'warning' | 'info'
  type: string
  player: string
  googleEmail: string
  message: string
}

export type OperationsIdentityManagement = {
  records: OperationsIdentityRecord[]
  audits: OperationsIdentityAudit[]
}

export type OperationsSeasonData = {
  season: SeasonStatus
  promotionRelegation: {
    relegatedFromMain: Standing[]
    promotedFromProvingGroundsA: Standing[]
    promotedFromProvingGroundsB: Standing[]
  }
  archive: Array<{
    date: string
    operation: string
    snapshot: string
  }>
}

export type IntegritySeverity = 'error' | 'info' | 'warning'

export type IntegrityIssue = {
  detail: string
  id: string
  repairAction: string
  repairable: boolean
  severity: IntegritySeverity
  target: string
  title: string
}

export type IntegrityCheck = {
  data: unknown[]
  detail: string
  status: string
  target: string
}

export type IntegritySection = {
  checks: IntegrityCheck[]
  description: string
  errors: number
  id: string
  issues: IntegrityIssue[]
  repairAction: string
  repairable: boolean
  status: string
  title: string
  warnings: number
}

export type IntegrityData = {
  durationMs: number
  healthScore: number
  healthStatus: string
  lastAudit: string
  lastRepair: string
  sections: IntegritySection[]
  summary: {
    errors: number
    repairable: number
    sections: number
    warnings: number
  }
  timestamp: string
  version: string
}

export type IntegrityReport = {
  durationMs: number
  errors: number
  healthScore: number
  leagueVersion: string
  portalVersion: string
  repairs: Array<{
    issue: string
    repairAction: string
    section: string
  }>
  sections: IntegritySection[]
  timestamp: string
  warnings: number
}

export type StreamedGame = {
  id: number
  date: string
  division: string
  mission: string
  player1: string
  player1Faction: string
  player2: string
  player2Faction: string
  youtubeUrl: string
  featured: boolean
}

export type LeaderData = Pick<DashboardSummary, 'leagueLeader'>

export type ApiClient = {
  getSession: (options?: ApiOptions) => Promise<AuthSession>
  getMyProfile: (options?: ApiOptions) => Promise<MyProfileData>
  updateProfile: (
    params: Record<string, string>,
    options?: ApiOptions,
  ) => Promise<MyProfileData>
  updateNotificationState: (
    params: {
      notificationId: string
      notificationIds?: string[]
      state: 'archived' | 'dismissed' | 'read'
    },
    options?: ApiOptions,
  ) => Promise<void>
  getHome: (options?: ApiOptions) => Promise<HomeData>
  getDashboard: (options?: ApiOptions) => Promise<DashboardData>
  getLeader: (options?: ApiOptions) => Promise<LeaderData>
  getRecentGames: (options?: ApiOptions) => Promise<RecentGame[]>
  getStandings: (
    division: DivisionKey,
    options?: ApiOptions,
  ) => Promise<DivisionStandings>
  getAllStandings: (options?: ApiOptions) => Promise<DivisionStandings[]>
  getPlayers: (options?: ApiOptions) => Promise<DivisionStandings[]>
  getSearchData: (options?: ApiOptions) => Promise<SearchData>
  getSearchIndex: (options?: ApiOptions) => Promise<SearchData>
  getPlayer: (
    playerName: string,
    options?: ApiOptions,
  ) => Promise<PlayerProfileData>
  getFactions: (options?: ApiOptions) => Promise<FactionSummary[]>
  getFaction: (
    factionName: string,
    options?: ApiOptions,
  ) => Promise<FactionProfileData>
  getMissions: (options?: ApiOptions) => Promise<MissionSummary[]>
  getMission: (
    missionName: string,
    options?: ApiOptions,
  ) => Promise<MissionProfileData>
  getAnalytics: (options?: ApiOptions) => Promise<LeagueIntelligenceData>
  getNews: (options?: ApiOptions) => Promise<CommissionerNewsItem[]>
  getNotifications: (options?: ApiOptions) => Promise<LeagueNotification[]>
  getTimeline: (options?: ApiOptions) => Promise<LeagueTimelineItem[]>
  getRecords: (options?: ApiOptions) => Promise<Record<string, LeagueRecordValue>>
  getHallOfFame: (options?: ApiOptions) => Promise<HallOfFameData>
  getPlayerComparison: (
    left: string,
    right: string,
    options?: ApiOptions,
  ) => Promise<PlayerComparisonData>
  getSettings: (options?: ApiOptions) => Promise<PortalSettings>
  getStreams: (options?: ApiOptions) => Promise<StreamedGame[]>
  getArmyLists: (options?: ApiOptions) => Promise<ArmyListsData>
  getCommunityCommandCenter: (
    options?: ApiOptions,
  ) => Promise<CommunityCommandCenterData>
  getSeasonCommandCenter: (options?: ApiOptions) => Promise<SeasonCommandCenterData>
  updateSeasonAvailability: (
    params: Record<string, string>,
    options?: ApiOptions,
  ) => Promise<SeasonCommandCenterData>
  submitArmyList: (
    submission: ArmyListSubmission,
    options?: ApiOptions,
  ) => Promise<void>
  voteArmyList: (
    id: number,
    vote: 'up' | 'down',
    options?: ApiOptions,
  ) => Promise<void>
  getOperations: (options?: ApiOptions) => Promise<OperationsDashboardData>
  getOperationsSummary: (options?: ApiOptions) => Promise<OperationsDashboardData>
  getOperationsLifecycle: (options?: ApiOptions) => Promise<OperationsDashboardData>
  getOperationsIdentity: (options?: ApiOptions) => Promise<OperationsDashboardData>
  getOperationsContent: (options?: ApiOptions) => Promise<OperationsDashboardData>
  getOperationsDiscord: (options?: ApiOptions) => Promise<OperationsDashboardData>
  getOperationsNotifications: (options?: ApiOptions) => Promise<OperationsDashboardData>
  getOperationsAudit: (options?: ApiOptions) => Promise<LeagueAudit>
  getOperationsSeason: (options?: ApiOptions) => Promise<OperationsSeasonData>
  getIntegrity: (options?: ApiOptions) => Promise<IntegrityData>
  getIntegrityFreshAudit: (options?: ApiOptions) => Promise<IntegrityData>
  getIntegrityReport: (options?: ApiOptions) => Promise<IntegrityReport>
  repairIntegrity: (
    repair: string,
    options?: ApiOptions,
  ) => Promise<IntegrityData>
  getAutomation: (options?: ApiOptions) => Promise<AutomationCenterData>
  automationAction: (
    action: string,
    params?: Record<string, string | number | boolean>,
    options?: ApiOptions,
  ) => Promise<void>
  operationsAction: (
    action: string,
    params?: Record<string, string | number | boolean>,
    options?: ApiOptions,
  ) => Promise<void>
}

const divisionKeys: DivisionKey[] = ['main', 'pga', 'pgb']

export async function getSession(
  options: ApiOptions = {},
): Promise<AuthSession> {
  const payload = await postRequest('session', options, {})
  return normalizeAuthSessionPayload(payload)
}

export async function getMyProfile(
  options: ApiOptions = {},
): Promise<MyProfileData> {
  const payload = await request('myProfile', options)
  return normalizeMyProfilePayload(payload)
}

export async function updateProfile(
  params: Record<string, string>,
  options: ApiOptions = {},
): Promise<MyProfileData> {
  const payload = await postRequest('updateProfile', options, params)
  return normalizeMyProfilePayload(payload)
}

export async function updateNotificationState(
  params: {
    notificationId: string
    notificationIds?: string[]
    state: 'archived' | 'dismissed' | 'read'
  },
  options: ApiOptions = {},
): Promise<void> {
  const payload = await postRequest('notificationState', options, {
    notificationId: params.notificationId,
    notificationIds: params.notificationIds?.join(',') ?? '',
    state: params.state,
  })
  normalizeMutationPayload(payload, 'Notification update failed.')
}

export async function getDashboard(
  options: ApiOptions = {},
): Promise<DashboardData> {
  const payload = await request('dashboard', options)
  return normalizeDashboardPayload(payload)
}

export async function getHome(options: ApiOptions = {}): Promise<HomeData> {
  const payload = await request('home', options)
  return normalizeHomePayload(payload)
}

export async function getLeader(
  options: ApiOptions = {},
): Promise<LeaderData> {
  const dashboard = await getDashboard(options)

  return {
    leagueLeader: dashboard.summary.leagueLeader,
  }
}

export async function getRecentGames(
  options: ApiOptions = {},
): Promise<RecentGame[]> {
  try {
    const payload = await request('recentGames', options)
    return normalizeRecentGamesPayload(payload)
  } catch (error) {
    if (options.signal?.aborted) {
      throw error
    }

    return []
  }
}

export async function getStandings(
  division: DivisionKey,
  options: ApiOptions = {},
): Promise<DivisionStandings> {
  const payload = await request('standings', options, {
    division,
  })

  return normalizeStandingsPayload(payload)
}

export async function getAllStandings(
  options: ApiOptions = {},
): Promise<DivisionStandings[]> {
  return Promise.all(
    divisionKeys.map((division) => getStandings(division, options)),
  )
}

export async function getPlayers(
  options: ApiOptions = {},
): Promise<DivisionStandings[]> {
  const payload = await request('players', options)
  return normalizePlayersPayload(payload)
}

export async function getSearchData(
  options: ApiOptions = {},
): Promise<SearchData> {
  const payload = await request('searchData', options)
  return normalizeSearchDataPayload(payload)
}

export async function getSearchIndex(
  options: ApiOptions = {},
): Promise<SearchData> {
  const payload = await request('searchIndex', options)
  return normalizeSearchDataPayload(payload)
}

export async function getPlayer(
  playerName: string,
  options: ApiOptions = {},
): Promise<PlayerProfileData> {
  const payload = await request('player', options, {
    name: playerName,
  })

  return normalizePlayerPayload(payload)
}

export async function getFactions(
  options: ApiOptions = {},
): Promise<FactionSummary[]> {
  const payload = await request('factions', options)
  return normalizeFactionsPayload(payload)
}

export async function getFaction(
  factionName: string,
  options: ApiOptions = {},
): Promise<FactionProfileData> {
  const payload = await request('faction', options, {
    name: factionName,
  })

  return normalizeFactionPayload(payload)
}

export async function getMissions(
  options: ApiOptions = {},
): Promise<MissionSummary[]> {
  const payload = await request('missions', options)
  return normalizeMissionsPayload(payload)
}

export async function getMission(
  missionName: string,
  options: ApiOptions = {},
): Promise<MissionProfileData> {
  const payload = await request('mission', options, {
    name: missionName,
  })

  return normalizeMissionPayload(payload)
}

export async function getAnalytics(
  options: ApiOptions = {},
): Promise<LeagueIntelligenceData> {
  const payload = await request('intelligence', options)
  return normalizeIntelligencePayload(payload)
}

export async function getNews(
  options: ApiOptions = {},
): Promise<CommissionerNewsItem[]> {
  const payload = await request('news', options)
  return normalizeNewsPayload(payload)
}

export async function getNotifications(
  options: ApiOptions = {},
): Promise<LeagueNotification[]> {
  const payload = await request('notifications', options)
  return normalizeNotificationsPayload(payload)
}

export async function getTimeline(
  options: ApiOptions = {},
): Promise<LeagueTimelineItem[]> {
  const payload = await request('timeline', options)
  return normalizeTimelinePayload(payload)
}

export async function getRecords(
  options: ApiOptions = {},
): Promise<Record<string, LeagueRecordValue>> {
  const payload = await request('records', options)
  return normalizeRecordsPayload(payload)
}

export async function getHallOfFame(
  options: ApiOptions = {},
): Promise<HallOfFameData> {
  const payload = await request('hallOfFame', options)
  return normalizeHallOfFamePayload(payload)
}

export async function getPlayerComparison(
  left: string,
  right: string,
  options: ApiOptions = {},
): Promise<PlayerComparisonData> {
  const payload = await request('comparison', options, {
    left,
    right,
  })

  return normalizePlayerComparisonPayload(payload)
}

export async function getSettings(
  options: ApiOptions = {},
): Promise<PortalSettings> {
  const payload = await request('settings', options)
  return normalizeSettingsPayload(payload)
}

export async function getStreams(
  options: ApiOptions = {},
): Promise<StreamedGame[]> {
  const payload = await request('streams', options)
  return normalizeStreamsPayload(payload)
}

export async function getArmyLists(
  options: ApiOptions = {},
): Promise<ArmyListsData> {
  const payload = await request('armyLists', options)
  return normalizeArmyListsPayload(payload)
}

export async function getCommunityCommandCenter(
  options: ApiOptions = {},
): Promise<CommunityCommandCenterData> {
  const payload = await request('communityCommandCenter', options)
  return normalizeCommunityCommandCenterPayload(payload)
}

export async function getSeasonCommandCenter(
  options: ApiOptions = {},
): Promise<SeasonCommandCenterData> {
  const payload = await request('seasonCommandCenter', options)
  return normalizeSeasonCommandCenterPayload(payload)
}

export async function updateSeasonAvailability(
  params: Record<string, string>,
  options: ApiOptions = {},
): Promise<SeasonCommandCenterData> {
  const payload = await postRequest('seasonAvailability', options, params)
  return normalizeSeasonCommandCenterPayload(payload)
}

export async function submitArmyList(
  submission: ArmyListSubmission,
  options: ApiOptions = {},
): Promise<void> {
  const payload = await postRequest('submitArmyList', options, submission)
  normalizeMutationPayload(payload, 'Army list submission failed.')
}

export async function voteArmyList(
  id: number,
  vote: 'up' | 'down',
  options: ApiOptions = {},
): Promise<void> {
  const payload = await postRequest('voteArmyList', options, {
    id: String(id),
    vote,
  })
  normalizeMutationPayload(payload, 'Army list vote failed.')
}

export async function getOperations(
  options: ApiOptions = {},
): Promise<OperationsDashboardData> {
  const payload = await request('operations', options)
  return normalizeOperationsPayload(payload)
}

export async function getOperationsSummary(
  options: ApiOptions = {},
): Promise<OperationsDashboardData> {
  const payload = await request('operationsSummary', options)
  return normalizeOperationsPayload(payload)
}

export async function getOperationsLifecycle(
  options: ApiOptions = {},
): Promise<OperationsDashboardData> {
  const payload = await request('operationsLifecycle', options)
  return normalizeOperationsPayload(payload)
}

export async function getOperationsIdentity(
  options: ApiOptions = {},
): Promise<OperationsDashboardData> {
  const payload = await request('operationsIdentity', options)
  return normalizeOperationsPayload(payload)
}

export async function getOperationsContent(
  options: ApiOptions = {},
): Promise<OperationsDashboardData> {
  const payload = await request('operationsContent', options)
  return normalizeOperationsPayload(payload)
}

export async function getOperationsDiscord(
  options: ApiOptions = {},
): Promise<OperationsDashboardData> {
  const payload = await request('operationsDiscord', options)
  return normalizeOperationsPayload(payload)
}

export async function getOperationsNotifications(
  options: ApiOptions = {},
): Promise<OperationsDashboardData> {
  const payload = await request('operationsNotifications', options)
  return normalizeOperationsPayload(payload)
}

export async function getIntegrity(
  options: ApiOptions = {},
): Promise<IntegrityData> {
  const payload = await request('integrity', options)
  return normalizeIntegrityPayload(payload)
}

export async function getIntegrityFreshAudit(
  options: ApiOptions = {},
): Promise<IntegrityData> {
  const payload = await request('integrityFreshAudit', options)
  return normalizeIntegrityPayload(payload)
}

export async function getIntegrityReport(
  options: ApiOptions = {},
): Promise<IntegrityReport> {
  const payload = await request('integrityReport', options)
  const record = asRecord(payload, 'Integrity report response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Integrity report failed.')
  }

  return normalizeIntegrityReport(getRequiredRecord(record, 'report'))
}

export async function repairIntegrity(
  repair: string,
  options: ApiOptions = {},
): Promise<IntegrityData> {
  const payload = await postRequest('integrityRepair', options, {
    repair,
  })
  const record = asRecord(payload, 'Integrity repair response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Integrity repair failed.')
  }

  return normalizeIntegrityRecord(getRequiredRecord(record, 'integrity'))
}

export async function getAutomation(
  options: ApiOptions = {},
): Promise<AutomationCenterData> {
  const payload = await request('automation', options)
  return normalizeAutomationPayload(payload)
}

export async function automationAction(
  action: string,
  params: Record<string, string | number | boolean> = {},
  options: ApiOptions = {},
): Promise<void> {
  const payload = await postRequest(
    action,
    options,
    Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ),
  )
  normalizeMutationPayload(payload, `${action} failed.`)
}

export async function getOperationsAudit(
  options: ApiOptions = {},
): Promise<LeagueAudit> {
  const payload = await request('operationsAudit', options)
  const record = asRecord(payload, 'Operations audit response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'League audit failed.')
  }

  return normalizeLeagueAudit(getRequiredRecord(record, 'audit'))
}

export async function getOperationsSeason(
  options: ApiOptions = {},
): Promise<OperationsSeasonData> {
  const payload = await request('operationsSeason', options)
  return normalizeOperationsSeasonPayload(payload)
}

export async function operationsAction(
  action: string,
  params: Record<string, string | number | boolean> = {},
  options: ApiOptions = {},
): Promise<void> {
  const payload = await postRequest(
    action,
    options,
    Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ),
  )
  normalizeMutationPayload(payload, `${action} failed.`)
}

export const apiClient: ApiClient = {
  getSession,
  getMyProfile,
  updateProfile,
  updateNotificationState,
  getHome,
  getDashboard,
  getLeader,
  getRecentGames,
  getStandings,
  getAllStandings,
  getPlayers,
  getSearchData,
  getSearchIndex,
  getPlayer,
  getFactions,
  getFaction,
  getMissions,
  getMission,
  getAnalytics,
  getNews,
  getNotifications,
  getTimeline,
  getRecords,
  getHallOfFame,
  getPlayerComparison,
  getSettings,
  getStreams,
  getArmyLists,
  getCommunityCommandCenter,
  getSeasonCommandCenter,
  updateSeasonAvailability,
  submitArmyList,
  voteArmyList,
  getOperations,
  getOperationsSummary,
  getOperationsLifecycle,
  getOperationsIdentity,
  getOperationsContent,
  getOperationsDiscord,
  getOperationsNotifications,
  getIntegrity,
  getIntegrityFreshAudit,
  getIntegrityReport,
  repairIntegrity,
  getAutomation,
  automationAction,
  getOperationsAudit,
  getOperationsSeason,
  operationsAction,
}

async function request(
  action: string,
  options: ApiOptions,
  params: RequestParams = {},
): Promise<unknown> {
  const url = new URL(API_URL)
  url.searchParams.set('action', action)

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  if (activeAuthToken) {
    url.searchParams.set('authToken', activeAuthToken)
  }

  if (activeOAuthClientId) {
    url.searchParams.set('oauthClientId', activeOAuthClientId)
  }

  const cacheKey = url.toString()
  const cached = frontendResponseCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload
  }

  const shouldShareInFlight = !options.signal
  const inFlight = shouldShareInFlight ? inFlightRequests.get(cacheKey) : null

  if (inFlight) {
    return inFlight
  }

  const pending = fetch(url, {
    signal: options.signal,
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`${action} request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as unknown

    frontendResponseCache.set(cacheKey, {
      expiresAt: Date.now() + frontendCacheTtlMs,
      payload,
    })

    return payload
  }).finally(() => {
    inFlightRequests.delete(cacheKey)
  })

  if (shouldShareInFlight) {
    inFlightRequests.set(cacheKey, pending)
  }

  return pending
}

async function postRequest(
  action: string,
  options: ApiOptions,
  params: RequestParams,
): Promise<unknown> {
  const url = new URL(API_URL)
  url.searchParams.set('action', action)

  const body = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    body.set(key, value)
  })

  if (activeAuthToken) {
    body.set('authToken', activeAuthToken)
  }

  if (activeOAuthClientId) {
    body.set('oauthClientId', activeOAuthClientId)
  }

  frontendResponseCache.clear()
  inFlightRequests.clear()

  const response = await fetch(url, {
    body,
    method: 'POST',
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`${action} request failed with status ${response.status}`)
  }

  return response.json()
}

function normalizeDashboardPayload(payload: unknown): DashboardData {
  const response = parseDashboardApiResponse(payload)

  return {
    summary: {
      leagueLeader: response.leader.displayName || response.leader.player,
      gamesPlayed: response.gamesPlayed,
      activePlayers: response.activePlayers,
      topFaction: response.topFaction,
    },
    standings: response.mainManStandings.map(normalizeStanding),
    leagueOverview:
      response.leagueOverview ??
      buildFallbackLeagueOverview(
        response.mainManStandings.map(normalizeStanding),
      ),
  }
}

function normalizeHomePayload(payload: unknown): HomeData {
  const record = asRecord(payload, 'Home response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Home failed.')
  }

  return {
    dashboard: normalizeDashboardPayload(getRequiredRecord(record, 'dashboard')),
    recentGames: getRequiredArray(record, 'recentGames').map(normalizeRecentGame),
    news: getRequiredArray(record, 'news').map(normalizeNewsItem),
    intelligence: getOptionalRecord(record, 'intelligence')
      ? normalizeIntelligencePayload(getRequiredRecord(record, 'intelligence'))
      : buildEmptyIntelligenceData(),
    records: normalizeLeagueRecords(getRequiredRecord(record, 'records')),
    hallOfFame: getOptionalRecord(record, 'hallOfFame')
      ? normalizeHallOfFamePayload(getRequiredRecord(record, 'hallOfFame'))
      : buildEmptyHallOfFameData(),
    settings: normalizeSettingsRecord(getRequiredRecord(record, 'settings')),
    streams: getArray(record, 'streams').map(normalizeStreamedGame),
    armyLists: getArray(record, 'armyLists').map(normalizeArmyList),
    armyListCommunity: normalizeArmyListCommunity(record.armyListCommunity),
    quickStats: normalizeHomeQuickStats(record.quickStats),
  }
}

function normalizeHomeQuickStats(value: unknown): HomeData['quickStats'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      activePlayers: 0,
      armyLists: 0,
      games: 0,
      news: 0,
      recentGames: 0,
      streams: 0,
    }
  }

  const record = value as Record<string, unknown>

  return {
    activePlayers: getNumber(record, 'activePlayers'),
    armyLists: getNumber(record, 'armyLists'),
    games: getNumber(record, 'games'),
    news: getNumber(record, 'news'),
    recentGames: getNumber(record, 'recentGames'),
    streams: getNumber(record, 'streams'),
  }
}

function buildEmptyIntelligenceData(): LeagueIntelligenceData {
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

function buildEmptyHallOfFameData(): HallOfFameData {
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

function normalizeAuthSessionPayload(payload: unknown): AuthSession {
  const record = asRecord(payload, 'Auth session response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Session failed.')
  }

  return {
    authenticated: getBoolean(record, 'authenticated'),
    user: normalizePortalUser(getRequiredRecord(record, 'user')),
    permissions: normalizeBooleanRecord(getRequiredRecord(record, 'permissions')),
    oauthConfigured: getBoolean(record, 'oauthConfigured'),
    error: getString(record, 'error'),
  }
}

function normalizeMyProfilePayload(payload: unknown): MyProfileData {
  const record = asRecord(payload, 'My profile response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Profile failed.')
  }

  const profile = getRequiredRecord(record, 'profile')

  return {
    user: normalizePortalUser(getRequiredRecord(profile, 'user')),
    submittedLists: getArray(profile, 'submittedLists').map(normalizeArmyList),
    votesCast: getNumber(profile, 'votesCast'),
    recentActivity: getArray(profile, 'recentActivity').map(normalizeTimelineItem),
    recentGames: getArray(profile, 'recentGames').map(normalizeRecentGame),
    leagueStatistics: profile.leagueStatistics
      ? normalizePlayerProfileRecord(asRecord(profile.leagueStatistics, 'Profile stats'))
      : null,
    currentSeasonStatistics: profile.currentSeasonStatistics
      ? normalizeProfileStatisticsSnapshot(
          asRecord(profile.currentSeasonStatistics, 'Current season profile stats'),
        )
      : null,
    careerStatistics: profile.careerStatistics
      ? normalizeProfileStatisticsSnapshot(
          asRecord(profile.careerStatistics, 'Career profile stats'),
        )
      : null,
    leaguePerformance: normalizeProfileLeaguePerformance(
      getOptionalRecord(profile, 'leaguePerformance') ?? {},
    ),
    intelligence: normalizeProfileIntelligenceContext(
      getOptionalRecord(profile, 'intelligence') ?? {},
    ),
    achievements: getArray(profile, 'achievements').map(normalizeProfileAchievement),
    futureSections: normalizeStringArray(profile.futureSections),
  }
}

function normalizeProfileStatisticsSnapshot(
  record: Record<string, unknown>,
): ProfileStatisticsSnapshot {
  return {
    division: getString(record, 'division'),
    rank: getNumber(record, 'rank'),
    games: getNumber(record, 'games'),
    wins: getNumber(record, 'wins'),
    losses: getNumber(record, 'losses'),
    tp: getNumber(record, 'tp'),
    op: getNumber(record, 'op'),
    vp: getNumber(record, 'vp'),
    winPercentage: getNumber(record, 'winPercentage'),
    averageTournamentPoints: getNumber(record, 'averageTournamentPoints'),
    averageObjectivePoints: getNumber(record, 'averageObjectivePoints'),
    averageVictoryPoints: getNumber(record, 'averageVictoryPoints'),
    promotionStatus: getString(record, 'promotionStatus'),
    seasonProgress: getNumber(record, 'seasonProgress'),
  }
}

function normalizeProfileLeaguePerformance(
  record: Record<string, unknown>,
): ProfileLeaguePerformance {
  return {
    bestOpponent: getString(record, 'bestOpponent'),
    worstOpponent: getString(record, 'worstOpponent'),
    longestWinStreak: getNumber(record, 'longestWinStreak'),
    longestLosingStreak: getNumber(record, 'longestLosingStreak'),
    currentStreak: getString(record, 'currentStreak') || 'None',
    mostPlayedOpponent: getString(record, 'mostPlayedOpponent'),
    closestVictory: record.closestVictory
      ? normalizeProfileGameSummary(
          asRecord(record.closestVictory, 'Closest victory'),
        )
      : null,
    worstDefeat: record.worstDefeat
      ? normalizeProfileGameSummary(asRecord(record.worstDefeat, 'Worst defeat'))
      : null,
    fallbackBestOpponent: getString(record, 'fallbackBestOpponent'),
    fallbackWorstOpponent: getString(record, 'fallbackWorstOpponent'),
  }
}

function normalizeProfileIntelligenceContext(
  record: Record<string, unknown>,
): ProfileIntelligenceContext {
  const ranks = getOptionalRecord(record, 'ranks') ?? {}

  return {
    player: getString(record, 'player'),
    division: getString(record, 'division'),
    divisionAverage: normalizeProfileIntelligenceAverage(
      getOptionalRecord(record, 'divisionAverage') ?? {},
    ),
    leagueAverage: normalizeProfileIntelligenceAverage(
      getOptionalRecord(record, 'leagueAverage') ?? {},
    ),
    topThreeAverage: normalizeProfileIntelligenceAverage(
      getOptionalRecord(record, 'topThreeAverage') ?? {},
    ),
    ranks: {
      objectivePoints: getNumber(ranks, 'objectivePoints'),
      tournamentPoints: getNumber(ranks, 'tournamentPoints'),
      victoryPoints: getNumber(ranks, 'victoryPoints'),
      winPercentage: getNumber(ranks, 'winPercentage'),
    },
  }
}

function normalizeProfileIntelligenceAverage(
  record: Record<string, unknown>,
): ProfileIntelligenceAverage {
  return {
    players: getNumber(record, 'players'),
    games: getNumber(record, 'games'),
    averageTP: getNumber(record, 'averageTP'),
    averageOP: getNumber(record, 'averageOP'),
    averageVP: getNumber(record, 'averageVP'),
    winPercentage: getNumber(record, 'winPercentage'),
  }
}

function normalizeProfileGameSummary(
  record: Record<string, unknown>,
): ProfileGameSummary {
  return {
    gameId: getNumber(record, 'gameId'),
    date: getString(record, 'date'),
    opponent: getString(record, 'opponent'),
    mission: getString(record, 'mission'),
    margin: getNumber(record, 'margin'),
    score: getString(record, 'score'),
  }
}

function normalizeProfileAchievement(item: unknown): ProfileAchievement {
  const record = asRecord(item, 'Profile achievement')
  const name = getString(record, 'name') || getString(record, 'title')

  return {
    id: getString(record, 'id'),
    name,
    title: name,
    description: getString(record, 'description'),
    category: getString(record, 'category'),
    tier: getString(record, 'tier') || 'Common',
    icon: getString(record, 'icon'),
    points: getNumber(record, 'points'),
    unlocked: getBoolean(record, 'unlocked'),
    dateEarned: getString(record, 'dateEarned'),
    seasonEarned: getString(record, 'seasonEarned'),
    visibility: getString(record, 'visibility') || 'Visible',
    automatic: getBoolean(record, 'automatic'),
    commissionerAward: getBoolean(record, 'commissionerAward'),
    progress: getNumber(record, 'progress'),
    requirement: getString(record, 'requirement'),
    value: getString(record, 'value'),
  }
}

function normalizePortalUser(record: Record<string, unknown>): PortalUser {
  return {
    email: getString(record, 'email'),
    displayName: getString(record, 'displayName') || 'Guest',
    leaguePlayer: getString(record, 'leaguePlayer'),
    playerDisplayName:
      getString(record, 'playerDisplayName') || getString(record, 'leaguePlayer'),
    leagueDivision: getString(record, 'leagueDivision'),
    role: normalizeUserRole(getString(record, 'role')),
    enabled: getBoolean(record, 'enabled'),
    favoriteFaction: getString(record, 'favoriteFaction'),
    avatarUrl: getString(record, 'avatarUrl'),
    created: getString(record, 'created'),
    lastLogin: getString(record, 'lastLogin'),
    lastSeen: getString(record, 'lastSeen'),
    notificationPreferences: getOptionalRecord(record, 'notificationPreferences') ?? {},
    themePreference: getString(record, 'themePreference') || 'system',
    dismissedAlerts: normalizeStringArray(record.dismissedAlerts),
    readAlerts: normalizeStringArray(record.readAlerts),
    archivedAlerts: normalizeStringArray(record.archivedAlerts),
    lastPage: getString(record, 'lastPage'),
    searchHistory: normalizeStringArray(record.searchHistory),
  }
}

function normalizeUserRole(role: string): UserRole {
  if (
    role === 'League Member' ||
    role === 'Assistant Commissioner' ||
    role === 'Commissioner'
  ) {
    return role
  }

  return 'Guest'
}

function parseDashboardApiResponse(payload: unknown): DashboardApiResponse {
  const record = asRecord(payload, 'Dashboard response')
  const leader = normalizeStanding(getRequiredRecord(record, 'leader'))
  const mainManStandings = getRequiredArray(record, 'mainManStandings').map(
    normalizeStanding,
  )
  const overview = getOptionalRecord(record, 'leagueOverview')

  return {
    success: getOptionalBoolean(record, 'success'),
    leader,
    topFaction: getRequiredString(record, 'topFaction'),
    gamesPlayed: getRequiredNumber(record, 'gamesPlayed'),
    activePlayers: getRequiredNumber(record, 'activePlayers'),
    mainManStandings,
    leagueOverview: overview ? normalizeLeagueOverview(overview) : undefined,
  }
}

function normalizeStandingsPayload(payload: unknown): DivisionStandings {
  const record = asRecord(payload, 'Standings response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Standings failed.')
  }

  return {
    division: getDivisionKey(record, 'division'),
    divisionLabel: getRequiredString(record, 'divisionLabel'),
    standings: getRequiredArray(record, 'standings').map(normalizeStanding),
    summary: normalizeDivisionSummary(getRequiredRecord(record, 'summary')),
  }
}

function normalizeLeagueOverview(record: Record<string, unknown>): LeagueOverview {
  return {
    divisions: getRequiredArray(record, 'divisions').map(normalizeOverviewDivision),
    totalLeagueGames: getRequiredNumber(record, 'totalLeagueGames'),
    totalActivePlayers: getRequiredNumber(record, 'totalActivePlayers'),
  }
}

function normalizeOverviewDivision(item: unknown): LeagueOverviewDivision {
  const record = asRecord(item, 'League overview division')

  return {
    division: getDivisionKey(record, 'division'),
    divisionLabel: getRequiredString(record, 'divisionLabel'),
    players: getRequiredNumber(record, 'players'),
    gamesPlayed: getRequiredNumber(record, 'gamesPlayed'),
    activePlayers: getRequiredNumber(record, 'activePlayers'),
  }
}

function normalizeDivisionSummary(record: Record<string, unknown>) {
  return {
    leader: getOptionalRecord(record, 'leader')
      ? normalizeStanding(getRequiredRecord(record, 'leader'))
      : null,
    players: getRequiredNumber(record, 'players'),
    gamesPlayed: getRequiredNumber(record, 'gamesPlayed'),
    activePlayers: getRequiredNumber(record, 'activePlayers'),
  }
}

function normalizeStanding(item: unknown): Standing {
  const record = asRecord(item, 'Standing')

  return {
    rank: getRequiredNumber(record, 'rank'),
    player: getRequiredString(record, 'player'),
    displayName: getString(record, 'displayName') || getRequiredString(record, 'player'),
    games: getRequiredNumber(record, 'games'),
    wins: getRequiredNumber(record, 'wins'),
    losses: getRequiredNumber(record, 'losses'),
    tp: getRequiredNumber(record, 'tp'),
    op: getRequiredNumber(record, 'op'),
    vp: getRequiredNumber(record, 'vp'),
  }
}

function normalizePlayerPayload(payload: unknown): PlayerProfileData {
  const record = asRecord(payload, 'Player response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Player could not be loaded.')
  }

  const player = getRequiredRecord(record, 'player')

  return normalizePlayerProfileRecord(player)
}

function normalizePlayerProfileRecord(
  player: Record<string, unknown>,
): PlayerProfileData {
  return {
    name: getRequiredString(player, 'name'),
    displayName: getString(player, 'displayName') || getRequiredString(player, 'name'),
    division: getString(player, 'division'),
    rank: getRequiredNumber(player, 'rank'),
    games: getRequiredNumber(player, 'games'),
    wins: getRequiredNumber(player, 'wins'),
    losses: getRequiredNumber(player, 'losses'),
    tp: getRequiredNumber(player, 'tp'),
    op: getRequiredNumber(player, 'op'),
    vp: getRequiredNumber(player, 'vp'),
    favoriteFaction: getString(player, 'favoriteFaction'),
    favoriteMission: getString(player, 'favoriteMission'),
    firstTurnGames: getRequiredNumber(player, 'firstTurnGames'),
    secondTurnGames: getRequiredNumber(player, 'secondTurnGames'),
    firstTurnWinRate: getRequiredNumber(player, 'firstTurnWinRate'),
    secondTurnWinRate: getRequiredNumber(player, 'secondTurnWinRate'),
    bestFaction: getString(player, 'bestFaction'),
    rival: getString(player, 'rival'),
    nemesis: getString(player, 'nemesis'),
    armyLists: getArray(player, 'armyLists').map(normalizeArmyList),
    armyListSummary: normalizePlayerArmyListSummary(player.armyListSummary),
  }
}

function normalizePlayersPayload(payload: unknown): DivisionStandings[] {
  const record = asRecord(payload, 'Players response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Players failed.')
  }

  return getRequiredArray(record, 'divisions').map(normalizeStandingsPayload)
}

function normalizeSearchDataPayload(payload: unknown): SearchData {
  const record = asRecord(payload, 'Search response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Search failed.')
  }

  return {
    players: getRequiredArray(record, 'players').map(normalizeStandingsPayload),
    factions: getRequiredArray(record, 'factions').map(normalizeFactionSummary),
    missions: getRequiredArray(record, 'missions').map(normalizeMissionSummary),
    games: getRequiredArray(record, 'games').map(normalizeRecentGame),
    armyLists: getArray(record, 'armyLists').map(normalizeArmyList),
  }
}

function normalizeRecentGamesPayload(payload: unknown): RecentGame[] {
  const record = asRecord(payload, 'Recent games response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Recent games failed.')
  }

  return getRequiredArray(record, 'games').map(normalizeRecentGame)
}

function normalizeFactionsPayload(payload: unknown): FactionSummary[] {
  const record = asRecord(payload, 'Factions response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Factions failed.')
  }

  return getRequiredArray(record, 'factions').map(normalizeFactionSummary)
}

function normalizeFactionPayload(payload: unknown): FactionProfileData {
  const record = asRecord(payload, 'Faction response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Faction could not be loaded.')
  }

  const faction = getRequiredRecord(record, 'faction')

  return {
    ...normalizeFactionSummary(faction),
    mostPlayedMission: getString(faction, 'mostPlayedMission'),
    recentGames: getRequiredArray(faction, 'recentGames').map(normalizeRecentGame),
    bestMoments: getRequiredArray(faction, 'bestMoments').map(
      normalizeFactionBestMoment,
    ),
    matchups: getArray(faction, 'matchups').map(normalizeFactionMatchup),
    matchupSummary: normalizeFactionMatchupSummary(faction.matchupSummary),
    armyLists: normalizeFactionArmyLists(faction.armyLists),
  }
}

function normalizeFactionSummary(item: unknown): FactionSummary {
  const record = asRecord(item, 'Faction')

  return {
    name: getRequiredString(record, 'name'),
    games: getRequiredNumber(record, 'games'),
    wins: getRequiredNumber(record, 'wins'),
    losses: getRequiredNumber(record, 'losses'),
    winRate: getRequiredNumber(record, 'winRate'),
    averageTP: getRequiredNumber(record, 'averageTP'),
    averageOP: getRequiredNumber(record, 'averageOP'),
    averageVP: getRequiredNumber(record, 'averageVP'),
    topPlayer: getString(record, 'topPlayer'),
    topPlayerDisplayName: getString(record, 'topPlayerDisplayName') || getString(record, 'topPlayer'),
    lastPlayed: getString(record, 'lastPlayed'),
    divisionBreakdown: normalizeFactionDivisionBreakdownList(
      record.divisionBreakdown,
    ),
  }
}

function normalizeFactionDivisionBreakdownList(
  value: unknown,
): FactionDivisionBreakdown[] {
  if (Array.isArray(value)) {
    return value.map(normalizeFactionDivisionBreakdown)
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    return [
      {
        division: 'Main Man',
        games: getRequiredNumber(record, 'mainMan'),
      },
      {
        division: 'Proving Grounds A',
        games: getRequiredNumber(record, 'provingGroundsA'),
      },
      {
        division: 'Proving Grounds B',
        games: getRequiredNumber(record, 'provingGroundsB'),
      },
    ]
  }

  throw new Error('API response is missing divisionBreakdown.')
}

function normalizeFactionDivisionBreakdown(
  item: unknown,
): FactionDivisionBreakdown {
  const record = asRecord(item, 'Faction division breakdown')

  return {
    division: getRequiredString(record, 'division'),
    games: getRequiredNumber(record, 'games'),
  }
}

function normalizeFactionBestMoment(item: unknown): FactionBestMoment {
  const record = asRecord(item, 'Faction best moment')

  return {
    gameId: getRequiredNumber(record, 'gameId'),
    date: getString(record, 'date'),
    mission: getString(record, 'mission'),
    moment: getRequiredString(record, 'moment'),
  }
}

function normalizeMissionsPayload(payload: unknown): MissionSummary[] {
  const record = asRecord(payload, 'Missions response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Missions failed.')
  }

  return getRequiredArray(record, 'missions').map(normalizeMissionSummary)
}

function normalizeMissionPayload(payload: unknown): MissionProfileData {
  const record = asRecord(payload, 'Mission response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Mission could not be loaded.')
  }

  const mission = getRequiredRecord(record, 'mission')

  return {
    ...normalizeMissionSummary(mission),
    mostPlayedFaction: getString(mission, 'mostPlayedFaction'),
    recentGames: getRequiredArray(mission, 'recentGames').map(normalizeRecentGame),
    bestMoments: getRequiredArray(mission, 'bestMoments').map(
      normalizeMissionBestMoment,
    ),
    divisionBreakdown: normalizeMissionDivisionBreakdownList(
      mission.divisionBreakdown,
    ),
  }
}

function normalizeMissionSummary(item: unknown): MissionSummary {
  const record = asRecord(item, 'Mission')

  return {
    mission: getRequiredString(record, 'mission'),
    games: getRequiredNumber(record, 'games'),
    averageTP: getRequiredNumber(record, 'averageTP'),
    averageOP: getRequiredNumber(record, 'averageOP'),
    averageVP: getRequiredNumber(record, 'averageVP'),
    firstTurnWinRate: getRequiredNumber(record, 'firstTurnWinRate'),
    mostSuccessfulFaction: getString(record, 'mostSuccessfulFaction'),
    lastPlayed: getString(record, 'lastPlayed'),
  }
}

function normalizeMissionDivisionBreakdownList(
  value: unknown,
): MissionDivisionBreakdown[] {
  if (Array.isArray(value)) {
    return value.map(normalizeMissionDivisionBreakdown)
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    return [
      {
        division: 'Main Man',
        games: getRequiredNumber(record, 'mainMan'),
      },
      {
        division: 'Proving Grounds A',
        games: getRequiredNumber(record, 'provingGroundsA'),
      },
      {
        division: 'Proving Grounds B',
        games: getRequiredNumber(record, 'provingGroundsB'),
      },
    ]
  }

  throw new Error('API response is missing divisionBreakdown.')
}

function normalizeMissionDivisionBreakdown(
  item: unknown,
): MissionDivisionBreakdown {
  const record = asRecord(item, 'Mission division breakdown')

  return {
    division: getRequiredString(record, 'division'),
    games: getRequiredNumber(record, 'games'),
  }
}

function normalizeMissionBestMoment(item: unknown): MissionBestMoment {
  const record = asRecord(item, 'Mission best moment')

  return {
    gameId: getRequiredNumber(record, 'gameId'),
    date: getString(record, 'date'),
    mission: getString(record, 'mission'),
    moment: getRequiredString(record, 'moment'),
  }
}

function normalizeIntelligencePayload(payload: unknown): LeagueIntelligenceData {
  const record = asRecord(payload, 'League intelligence response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'League intelligence failed.')
  }

  return {
    winStreaks: getRequiredArray(record, 'winStreaks').map(
      normalizeIntelligenceStreak,
    ),
    losingStreaks: getRequiredArray(record, 'losingStreaks').map(
      normalizeIntelligenceStreak,
    ),
    highestVPGames: getRequiredArray(record, 'highestVPGames').map(
      normalizeIntelligenceGame,
    ),
    biggestVictories: getRequiredArray(record, 'biggestVictories').map(
      normalizeIntelligenceGame,
    ),
    closestGames: getRequiredArray(record, 'closestGames').map(
      normalizeIntelligenceGame,
    ),
    factionMomentum: getRequiredArray(record, 'factionMomentum').map(
      normalizeFactionMomentum,
    ),
    missionTrends: getRequiredArray(record, 'missionTrends').map(
      normalizeIntelligenceMissionTrend,
    ),
    recentUpsets: getRequiredArray(record, 'recentUpsets').map(
      normalizeRecentUpset,
    ),
    promotionBattle: getRequiredArray(record, 'promotionBattle').map(
      normalizeStandingsBattle,
    ),
    relegationBattle: getRequiredArray(record, 'relegationBattle').map(
      normalizeStandingsBattle,
    ),
    records: normalizeLeagueRecords(getRequiredRecord(record, 'records')),
  }
}

function normalizeNewsPayload(payload: unknown): CommissionerNewsItem[] {
  const record = asRecord(payload, 'News response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'News failed.')
  }

  return getRequiredArray(record, 'news').map(normalizeNewsItem)
}

function normalizeNewsItem(item: unknown): CommissionerNewsItem {
  const record = asRecord(item, 'News item')

  return {
    body: getRequiredString(record, 'body'),
    id: getRequiredNumber(record, 'id'),
    date: getString(record, 'date'),
    link: getString(record, 'link'),
    relatedFaction: getString(record, 'relatedFaction'),
    relatedMission: getString(record, 'relatedMission'),
    relatedPlayer: getString(record, 'relatedPlayer'),
    title: getRequiredString(record, 'title'),
  }
}

function normalizeNotificationsPayload(payload: unknown): LeagueNotification[] {
  const record = asRecord(payload, 'Notifications response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Notifications failed.')
  }

  return getRequiredArray(record, 'notifications').map(normalizeNotification)
}

function normalizeNotification(item: unknown): LeagueNotification {
  const record = asRecord(item, 'Notification')

  return {
    body: getRequiredString(record, 'body'),
    id: getRequiredString(record, 'id'),
    link: getString(record, 'link'),
    priority: getString(record, 'priority') || 'normal',
    timestamp: getString(record, 'timestamp'),
    title: getRequiredString(record, 'title'),
    type: getRequiredString(record, 'type'),
    unread: getRequiredBoolean(record, 'unread'),
  }
}

function normalizeTimelinePayload(payload: unknown): LeagueTimelineItem[] {
  const record = asRecord(payload, 'Timeline response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Timeline failed.')
  }

  return getRequiredArray(record, 'timeline').map(normalizeTimelineItem)
}

function normalizeTimelineItem(item: unknown): LeagueTimelineItem {
  const record = asRecord(item, 'Timeline item')

  return {
    body: getRequiredString(record, 'body'),
    id: getRequiredString(record, 'id'),
    link: getString(record, 'link'),
    relatedFaction: getString(record, 'relatedFaction'),
    relatedMission: getString(record, 'relatedMission'),
    relatedPlayer: getString(record, 'relatedPlayer'),
    timestamp: getString(record, 'timestamp'),
    title: getRequiredString(record, 'title'),
    type: getRequiredString(record, 'type'),
  }
}

function normalizeRecordsPayload(
  payload: unknown,
): Record<string, LeagueRecordValue> {
  const record = asRecord(payload, 'Records response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Records failed.')
  }

  return normalizeLeagueRecords(getRequiredRecord(record, 'records'))
}

function normalizeHallOfFamePayload(payload: unknown): HallOfFameData {
  const record = asRecord(payload, 'Hall of Fame response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Hall of Fame failed.')
  }

  const leaders = getRequiredRecord(record, 'leaders')

  return {
    leaders: {
      games: getRequiredArray(leaders, 'games').map(normalizeHallOfFameLeader),
      objectivePoints: getRequiredArray(leaders, 'objectivePoints').map(
        normalizeHallOfFameLeader,
      ),
      tournamentPoints: getRequiredArray(leaders, 'tournamentPoints').map(
        normalizeHallOfFameLeader,
      ),
      victoryPoints: getRequiredArray(leaders, 'victoryPoints').map(
        normalizeHallOfFameLeader,
      ),
      wins: getRequiredArray(leaders, 'wins').map(normalizeHallOfFameLeader),
    },
    records: normalizeLeagueRecords(getRequiredRecord(record, 'records')),
    careerLeaders: normalizeHallOfFameCareerLeaders(
      getOptionalRecord(record, 'careerLeaders') ?? {},
    ),
    recordBook: getArray(record, 'recordBook').map(normalizeHallOfFameRecordBookItem),
    leagueHistory: getArray(record, 'leagueHistory').map(normalizeHallOfFameTimelineItem),
    seasonHistory: getArray(record, 'seasonHistory').map(normalizeHallOfFameSeason),
    playerCareers: getArray(record, 'playerCareers').map(normalizeHallOfFameCareer),
  }
}

function normalizeHallOfFameLeader(item: unknown): HallOfFameLeader {
  const record = asRecord(item, 'Hall of Fame leader')

  return {
    division: getRequiredString(record, 'division'),
    player: getRequiredString(record, 'player'),
    displayName: getString(record, 'displayName') || getRequiredString(record, 'player'),
    rank: getRequiredNumber(record, 'rank'),
    games: getRequiredNumber(record, 'games'),
    wins: getRequiredNumber(record, 'wins'),
    losses: getRequiredNumber(record, 'losses'),
    tp: getRequiredNumber(record, 'tp'),
    op: getRequiredNumber(record, 'op'),
    vp: getRequiredNumber(record, 'vp'),
  }
}

function normalizeHallOfFameCareer(item: unknown): HallOfFameCareer {
  const record = asRecord(item, 'Hall of Fame career')
  const leader = normalizeHallOfFameLeader(record)

  return {
    ...leader,
    achievementPoints: getNumber(record, 'achievementPoints'),
    seasonsPlayed: getNumber(record, 'seasonsPlayed'),
    promotions: getNumber(record, 'promotions'),
    relegations: getNumber(record, 'relegations'),
    championships: getNumber(record, 'championships'),
    awards: getNumber(record, 'awards'),
    achievements: getNumber(record, 'achievements'),
    winPercentage: getNumber(record, 'winPercentage'),
    seasons: getArray(record, 'seasons').map(normalizeHallOfFameSeason),
    hallOfFameEntries: normalizeStringArray(record.hallOfFameEntries),
    timeline: getArray(record, 'timeline').map(normalizeHallOfFameTimelineItem),
  }
}

function normalizeHallOfFameCareerLeaders(
  record: Record<string, unknown>,
): HallOfFameData['careerLeaders'] {
  return {
    achievementPoints: getArray(record, 'achievementPoints').map(normalizeHallOfFameCareer),
    championships: getArray(record, 'championships').map(normalizeHallOfFameCareer),
    communityAwards: getArray(record, 'communityAwards').map(normalizeHallOfFameCareer),
    promotions: getArray(record, 'promotions').map(normalizeHallOfFameCareer),
    seasonsPlayed: getArray(record, 'seasonsPlayed').map(normalizeHallOfFameCareer),
    winPercentage: getArray(record, 'winPercentage').map(normalizeHallOfFameCareer),
  }
}

function normalizeHallOfFameSeason(item: unknown): HallOfFameSeason {
  const record = asRecord(item, 'Hall of Fame season')

  return {
    season: getString(record, 'season'),
    division: getString(record, 'division'),
    finalRank: getString(record, 'finalRank') || getNumber(record, 'finalRank'),
    record: getString(record, 'record'),
    tp: getNumber(record, 'tp'),
    op: getNumber(record, 'op'),
    vp: getNumber(record, 'vp'),
    movement: getString(record, 'movement'),
    achievementsEarned: getNumber(record, 'achievementsEarned'),
    armyListsSubmitted: getNumber(record, 'armyListsSubmitted'),
    specialAwards: getNumber(record, 'specialAwards'),
    date: getString(record, 'date'),
    details: getString(record, 'details'),
  }
}

function normalizeHallOfFameRecordBookItem(item: unknown): HallOfFameRecordBookItem {
  const record = asRecord(item, 'Hall of Fame record book item')

  return {
    title: getString(record, 'title'),
    value: getString(record, 'value'),
    holder: getString(record, 'holder'),
    story: getString(record, 'story'),
  }
}

function normalizeHallOfFameTimelineItem(item: unknown): HallOfFameTimelineItem {
  const record = asRecord(item, 'Hall of Fame timeline item')

  return {
    id: getString(record, 'id'),
    type: getString(record, 'type'),
    title: getString(record, 'title'),
    body: getString(record, 'body'),
    timestamp: getString(record, 'timestamp'),
    relatedPlayer: getString(record, 'relatedPlayer'),
  }
}

function normalizePlayerComparisonPayload(
  payload: unknown,
): PlayerComparisonData {
  const record = asRecord(payload, 'Player comparison response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Comparison failed.')
  }

  const headToHead = getRequiredRecord(record, 'headToHead')

  return {
    headToHead: {
      games: getRequiredNumber(headToHead, 'games'),
      leftWins: getRequiredNumber(headToHead, 'leftWins'),
      rightWins: getRequiredNumber(headToHead, 'rightWins'),
    },
    players: getRequiredArray(record, 'players').map(normalizeComparisonPlayer),
  }
}

function normalizeComparisonPlayer(item: unknown): PlayerComparisonPlayer {
  const record = asRecord(item, 'Comparison player')

  return {
    name: getRequiredString(record, 'name'),
    displayName: getString(record, 'displayName') || getRequiredString(record, 'name'),
    division: getString(record, 'division'),
    rank: getRequiredNumber(record, 'rank'),
    games: getRequiredNumber(record, 'games'),
    wins: getRequiredNumber(record, 'wins'),
    losses: getRequiredNumber(record, 'losses'),
    tp: getRequiredNumber(record, 'tp'),
    op: getRequiredNumber(record, 'op'),
    vp: getRequiredNumber(record, 'vp'),
    favoriteFaction: getString(record, 'favoriteFaction'),
    favoriteMission: getString(record, 'favoriteMission'),
    firstTurnGames: 0,
    secondTurnGames: 0,
    firstTurnWinRate: 0,
    secondTurnWinRate: 0,
    bestFaction: getString(record, 'bestFaction'),
    rival: '',
    nemesis: '',
    armyLists: [],
    armyListSummary: {
      submitted: 0,
      highestRated: null,
      newest: null,
      averageRating: 0,
      favoriteFaction: '',
    },
  }
}

function normalizeSettingsPayload(payload: unknown): PortalSettings {
  const record = asRecord(payload, 'Settings response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Settings failed.')
  }

  const settings = getRequiredRecord(record, 'settings')
  return normalizeSettingsRecord(settings)
}

function normalizeSettingsRecord(settings: Record<string, unknown>): PortalSettings {
  return {
    currentSeason: getString(settings, 'currentSeason'),
    leagueName: getString(settings, 'leagueName'),
    googleFormUrl: getString(settings, 'googleFormUrl'),
    discordInvite: getString(settings, 'discordInvite'),
    leagueWebsite: getString(settings, 'leagueWebsite'),
    submissionEnabled: getString(settings, 'submissionEnabled'),
    submissionButtonText: getString(settings, 'submissionButtonText'),
    submissionButtonVisible: getString(settings, 'submissionButtonVisible'),
    bannerImage: getString(settings, 'bannerImage'),
    leagueLogo: getString(settings, 'leagueLogo'),
    commissionerContact: getString(settings, 'commissionerContact'),
    themeAccentColor: getString(settings, 'themeAccentColor'),
    seasonStartDate: getString(settings, 'seasonStartDate'),
    seasonEndDate: getString(settings, 'seasonEndDate'),
    registrationOpen: getString(settings, 'registrationOpen'),
    googleOAuthClientId: getString(settings, 'googleOAuthClientId'),
    commissionerEmails: getString(settings, 'commissionerEmails'),
    portalVersion: getString(settings, 'portalVersion'),
    gitCommit: getString(settings, 'gitCommit'),
    deploymentUrl: getString(settings, 'deploymentUrl'),
  }
}

function normalizeStreamsPayload(payload: unknown): StreamedGame[] {
  const record = asRecord(payload, 'Streams response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Streams failed.')
  }

  return getRequiredArray(record, 'streams').map(normalizeStreamedGame)
}

function normalizeArmyListsPayload(payload: unknown): ArmyListsData {
  const record = asRecord(payload, 'Army lists response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Army lists failed.')
  }

  return {
    lists: getRequiredArray(record, 'lists').map(normalizeArmyList),
    community: normalizeArmyListCommunity(record.community),
  }
}

function normalizeCommunityCommandCenterPayload(
  payload: unknown,
): CommunityCommandCenterData {
  const record = asRecord(payload, 'Community command center response')

  if (record.success === false) {
    throw new Error(
      getString(record, 'error') || 'Community command center failed.',
    )
  }

  const commandCenter = getRequiredRecord(record, 'commandCenter')

  return {
    activeEvents: getRequiredArray(commandCenter, 'activeEvents').map(
      normalizeCommunityCommandEvent,
    ),
    communityActivity: normalizeCommunityCommandActivity(
      getRequiredRecord(commandCenter, 'communityActivity'),
    ),
    eventSwitcher: getRequiredArray(commandCenter, 'eventSwitcher').map(
      normalizeCommunityEventSwitcherItem,
    ),
    intelligence: getRequiredArray(commandCenter, 'intelligence').map((item) =>
      typeof item === 'string' ? item : String(item ?? ''),
    ),
    nudgeEngine: getRequiredArray(commandCenter, 'nudgeEngine').map(
      normalizeCommunityNudge,
    ),
    nextActions: getRequiredArray(commandCenter, 'nextActions').map(
      normalizeCommunityCommandAction,
    ),
    opponentTracker: normalizeCommunityOpponentTracker(
      getRequiredRecord(commandCenter, 'opponentTracker'),
    ),
    promotion: normalizeSeasonPromotionTracker(
      getRequiredRecord(commandCenter, 'promotion'),
    ),
    quickActions: getRequiredArray(commandCenter, 'quickActions').map((item) => {
      const action = asRecord(item, 'Community quick action')

      return {
        label: getRequiredString(action, 'label'),
        link: getRequiredString(action, 'link'),
      }
    }),
    schedule: normalizeCommunityCommandSchedule(
      getRequiredRecord(commandCenter, 'schedule'),
    ),
    today: getRequiredArray(commandCenter, 'today').map(
      normalizeCommunityCommandAction,
    ),
    welcome: normalizeCommunityCommandWelcome(
      getRequiredRecord(commandCenter, 'welcome'),
    ),
  }
}

function normalizeCommunityCommandWelcome(
  record: Record<string, unknown>,
): CommunityCommandWelcome {
  return {
    currentActiveEvents: getRequiredNumber(record, 'currentActiveEvents'),
    currentLeague: getRequiredString(record, 'currentLeague'),
    currentRank: getRequiredNumber(record, 'currentRank'),
    displayName: getRequiredString(record, 'displayName'),
    leaguePlayer: getRequiredString(record, 'leaguePlayer'),
    playerDisplayName: getRequiredString(record, 'playerDisplayName'),
  }
}

function normalizeCommunityCommandEvent(
  item: unknown,
): CommunityCommandEvent {
  const record = asRecord(item, 'Community command event')

  return {
    completionPercentage: getRequiredNumber(record, 'completionPercentage'),
    eventId: getRequiredString(record, 'eventId'),
    gamesRemaining: getRequiredNumber(record, 'gamesRemaining'),
    link: getRequiredString(record, 'link'),
    name: getRequiredString(record, 'name'),
    primaryAction: getRequiredString(record, 'primaryAction'),
    status: getRequiredString(record, 'status'),
    statusDetail: getString(record, 'statusDetail'),
    type: getRequiredString(record, 'type'),
  }
}

function normalizeCommunityOpponentTracker(
  record: Record<string, unknown>,
) {
  const suggested = record.suggested

  return {
    completed: getRequiredArray(record, 'completed').map(
      normalizeCommunityOpponentCard,
    ),
    progress: normalizeCommunityOpponentProgress(
      getRequiredRecord(record, 'progress'),
    ),
    remaining: getRequiredArray(record, 'remaining').map(
      normalizeCommunityOpponentCard,
    ),
    suggested:
      suggested && typeof suggested === 'object' && !Array.isArray(suggested)
        ? normalizeSeasonRecommendation(suggested)
        : null,
  }
}

function normalizeCommunityOpponentProgress(
  record: Record<string, unknown>,
) {
  return {
    completionPercentage: getRequiredNumber(record, 'completionPercentage'),
    gamesCompleted: getRequiredNumber(record, 'gamesCompleted'),
    gamesRemaining: getRequiredNumber(record, 'gamesRemaining'),
    gamesRequired: getRequiredNumber(record, 'gamesRequired'),
  }
}

function normalizeCommunityOpponentCard(
  item: unknown,
): CommunityOpponentCard {
  const record = asRecord(item, 'Community opponent card')

  return {
    availability: normalizeSeasonAvailability(
      getRequiredRecord(record, 'availability'),
    ),
    displayName: getString(record, 'displayName') || getRequiredString(record, 'player'),
    division: getString(record, 'division'),
    gamesCompleted: getRequiredNumber(record, 'gamesCompleted'),
    lastActivity: getString(record, 'lastActivity'),
    player: getRequiredString(record, 'player'),
    quickMessage: getString(record, 'quickMessage') || 'Message',
    rank: getRequiredNumber(record, 'rank'),
    reason: getString(record, 'reason'),
    suggestedPriority: getString(record, 'suggestedPriority') || 'Normal',
    status: getRequiredString(record, 'status'),
  }
}

function normalizeCommunityCommandAction(
  item: unknown,
): CommunityCommandAction {
  const record = asRecord(item, 'Community next action')

  return {
    label: getRequiredString(record, 'label'),
    link: getRequiredString(record, 'link'),
    priority: getString(record, 'priority') || 'Normal',
  }
}

function normalizeCommunityCommandActivity(
  record: Record<string, unknown>,
): CommunityCommandActivity {
  const featuredBattle = record.featuredBattle

  return {
    featuredBattle:
      featuredBattle &&
      typeof featuredBattle === 'object' &&
      !Array.isArray(featuredBattle)
        ? normalizeRecentGame(featuredBattle)
        : null,
    latestAchievements: getRequiredArray(record, 'latestAchievements').map(
      normalizeNotification,
    ),
    latestResults: getRequiredArray(record, 'latestResults').map(
      normalizeRecentGame,
    ),
    news: getRequiredArray(record, 'news').map(normalizeNewsItem),
    streams: getRequiredArray(record, 'streams').map(normalizeStreamedGame),
  }
}

function normalizeCommunityCommandSchedule(
  record: Record<string, unknown>,
): CommunityCommandSchedule {
  return {
    currentRound: getRequiredString(record, 'currentRound'),
    deadlines: normalizeSeasonDeadlines(getRequiredRecord(record, 'deadlines')),
    gamesRemaining: getRequiredNumber(record, 'gamesRemaining'),
    upcomingEventDates: getRequiredArray(record, 'upcomingEventDates').map(
      (item) => (typeof item === 'string' ? item : String(item ?? '')),
    ),
  }
}

function normalizeCommunityNudge(item: unknown): CommunityNudge {
  const record = asRecord(item, 'Community nudge')

  return {
    category: getRequiredString(record, 'category'),
    deepLink: getRequiredString(record, 'deepLink'),
    priority: getRequiredString(record, 'priority'),
    reason: getRequiredString(record, 'reason'),
    suggestedAction: getRequiredString(record, 'suggestedAction'),
  }
}

function normalizeCommunityEventSwitcherItem(
  item: unknown,
): CommunityEventSwitcherItem {
  const record = asRecord(item, 'Community event switcher item')

  return {
    active: Boolean(record.active),
    eventId: getRequiredString(record, 'eventId'),
    label: getRequiredString(record, 'label'),
    link: getRequiredString(record, 'link'),
    status: getRequiredString(record, 'status'),
    type: getRequiredString(record, 'type'),
  }
}

function normalizeSeasonCommandCenterPayload(
  payload: unknown,
): SeasonCommandCenterData {
  const record = asRecord(payload, 'Season command center response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Season command center failed.')
  }

  return normalizeSeasonCommandCenter(
    getRequiredRecord(record, 'seasonCommand'),
  )
}

function normalizeSeasonCommandCenter(
  record: Record<string, unknown>,
): SeasonCommandCenterData {
  return {
    availability: normalizeSeasonAvailability(
      getRequiredRecord(record, 'availability'),
    ),
    commissioner: normalizeSeasonCommissionerStatus(
      getRequiredRecord(record, 'commissioner'),
    ),
    deadlines: normalizeSeasonDeadlines(getRequiredRecord(record, 'deadlines')),
    divisionStatus: getRequiredArray(record, 'divisionStatus').map(
      normalizeSeasonDivisionStatus,
    ),
    leagueActivity: normalizeSeasonLeagueActivity(
      getRequiredRecord(record, 'leagueActivity'),
    ),
    nextOpponents: getRequiredArray(record, 'nextOpponents').map(
      normalizeSeasonRecommendation,
    ),
    opponents: getRequiredArray(record, 'opponents').map(normalizeSeasonOpponent),
    player: normalizeSeasonCommandPlayer(getRequiredRecord(record, 'player')),
    progress: normalizeSeasonProgress(getRequiredRecord(record, 'progress')),
    promotion: normalizeSeasonPromotionTracker(
      getRequiredRecord(record, 'promotion'),
    ),
  }
}

function normalizeSeasonAvailability(item: unknown): SeasonAvailability {
  const record = asRecord(item, 'Season availability')

  return {
    notes: getString(record, 'notes'),
    player: getString(record, 'player'),
    preferredDays: getString(record, 'preferredDays'),
    preferredTimes: getString(record, 'preferredTimes'),
    status: getString(record, 'status'),
    updatedAt: getString(record, 'updatedAt'),
  }
}

function normalizeSeasonOpponent(item: unknown): SeasonOpponent {
  const record = asRecord(item, 'Season opponent')

  return {
    availability: normalizeSeasonAvailability(
      getRequiredRecord(record, 'availability'),
    ),
    displayName: getString(record, 'displayName') || getRequiredString(record, 'player'),
    gameId: getNumber(record, 'gameId'),
    games: getRequiredNumber(record, 'games'),
    lastResult: getString(record, 'lastResult'),
    player: getRequiredString(record, 'player'),
    rank: getRequiredNumber(record, 'rank'),
    status: getRequiredString(record, 'status'),
  }
}

function normalizeSeasonCommandPlayer(
  item: unknown,
): SeasonCommandPlayer {
  const record = asRecord(item, 'Season command player')

  return {
    displayName: getString(record, 'displayName') || getRequiredString(record, 'player'),
    division: getString(record, 'division'),
    games: getRequiredNumber(record, 'games'),
    losses: getRequiredNumber(record, 'losses'),
    op: getRequiredNumber(record, 'op'),
    player: getRequiredString(record, 'player'),
    rank: getRequiredNumber(record, 'rank'),
    tp: getRequiredNumber(record, 'tp'),
    vp: getRequiredNumber(record, 'vp'),
    wins: getRequiredNumber(record, 'wins'),
  }
}

function normalizeSeasonProgress(record: Record<string, unknown>): SeasonProgress {
  return {
    completionPercentage: getRequiredNumber(record, 'completionPercentage'),
    gamesCompleted: getRequiredNumber(record, 'gamesCompleted'),
    gamesRemaining: getRequiredNumber(record, 'gamesRemaining'),
    gamesRequired: getRequiredNumber(record, 'gamesRequired'),
    midseasonProgress: getRequiredNumber(record, 'midseasonProgress'),
    opponentsCompleted: getRequiredNumber(record, 'opponentsCompleted'),
    opponentsRemaining: getRequiredNumber(record, 'opponentsRemaining'),
    seasonProgress: getRequiredNumber(record, 'seasonProgress'),
  }
}

function normalizeSeasonRecommendation(item: unknown): SeasonRecommendation {
  const record = asRecord(item, 'Season recommendation')

  return {
    availability: normalizeSeasonAvailability(
      getRequiredRecord(record, 'availability'),
    ),
    displayName: getString(record, 'displayName') || getRequiredString(record, 'player'),
    player: getRequiredString(record, 'player'),
    rank: getRequiredNumber(record, 'rank'),
    reason: getRequiredString(record, 'reason'),
    urgency: getString(record, 'urgency'),
  }
}

function normalizeSeasonDeadlines(record: Record<string, unknown>): SeasonDeadlines {
  return {
    currentWeek: getRequiredNumber(record, 'currentWeek'),
    gamesNeededBeforeEnd: getRequiredNumber(record, 'gamesNeededBeforeEnd'),
    gamesNeededBeforeMidseason: getRequiredNumber(
      record,
      'gamesNeededBeforeMidseason',
    ),
    lateStatus: getString(record, 'lateStatus'),
    midseasonDeadline: getString(record, 'midseasonDeadline'),
    seasonEndDeadline: getString(record, 'seasonEndDeadline'),
  }
}

function normalizeSeasonPromotionTracker(
  record: Record<string, unknown>,
): SeasonPromotionTracker {
  return {
    currentRank: getRequiredNumber(record, 'currentRank'),
    gamesNeeded: getRequiredNumber(record, 'gamesNeeded'),
    magicNumber: getRequiredNumber(record, 'magicNumber'),
    projectedFinish: getRequiredNumber(record, 'projectedFinish'),
    promotionZone: getBoolean(record, 'promotionZone'),
    relegationZone: getBoolean(record, 'relegationZone'),
    safe: getBoolean(record, 'safe'),
    status: getString(record, 'status'),
  }
}

function normalizeSeasonDivisionStatus(item: unknown): SeasonDivisionStatus {
  const record = asRecord(item, 'Season division status')

  return {
    ...normalizeSeasonCommandPlayer(record),
    pairingStatus: getString(record, 'pairingStatus'),
  }
}

function normalizeSeasonLeagueActivity(
  record: Record<string, unknown>,
): SeasonLeagueActivity {
  return {
    playersCatchingUp: getRequiredArray(record, 'playersCatchingUp').map(
      normalizeSeasonCommandPlayer,
    ),
    promotionRace: getRequiredArray(record, 'promotionRace').map(
      normalizeSeasonCommandPlayer,
    ),
    recentDivisionGames: getRequiredArray(record, 'recentDivisionGames').map(
      normalizeRecentGame,
    ),
    relegationRace: getRequiredArray(record, 'relegationRace').map(
      normalizeSeasonCommandPlayer,
    ),
  }
}

function normalizeSeasonCommissionerStatus(
  record: Record<string, unknown>,
): SeasonCommissionerStatus {
  return {
    behind: getRequiredNumber(record, 'behind'),
    division: getString(record, 'division'),
    finished: getRequiredNumber(record, 'finished'),
    latePlayers: getRequiredArray(record, 'latePlayers').map((item) => {
      const player = asRecord(item, 'Late player')

      return {
        displayName: getString(player, 'displayName') || getRequiredString(player, 'player'),
        games: getRequiredNumber(player, 'games'),
        player: getRequiredString(player, 'player'),
      }
    }),
    missingPairings: getRequiredNumber(record, 'missingPairings'),
  }
}

function normalizeIntegrityPayload(payload: unknown): IntegrityData {
  const record = asRecord(payload, 'Integrity response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Integrity audit failed.')
  }

  return normalizeIntegrityRecord(getRequiredRecord(record, 'integrity'))
}

function normalizeIntegrityRecord(record: Record<string, unknown>): IntegrityData {
  const summary = getRequiredRecord(record, 'summary')

  return {
    durationMs: getNumber(record, 'durationMs'),
    healthScore: getRequiredNumber(record, 'healthScore'),
    healthStatus: getString(record, 'healthStatus'),
    lastAudit: getString(record, 'lastAudit'),
    lastRepair: getString(record, 'lastRepair'),
    sections: getRequiredArray(record, 'sections').map(normalizeIntegritySection),
    summary: {
      errors: getRequiredNumber(summary, 'errors'),
      repairable: getRequiredNumber(summary, 'repairable'),
      sections: getRequiredNumber(summary, 'sections'),
      warnings: getRequiredNumber(summary, 'warnings'),
    },
    timestamp: getString(record, 'timestamp'),
    version: getString(record, 'version'),
  }
}

function normalizeIntegrityReport(
  record: Record<string, unknown>,
): IntegrityReport {
  return {
    durationMs: getNumber(record, 'durationMs'),
    errors: getRequiredNumber(record, 'errors'),
    healthScore: getRequiredNumber(record, 'healthScore'),
    leagueVersion: getString(record, 'leagueVersion'),
    portalVersion: getString(record, 'portalVersion'),
    repairs: getArray(record, 'repairs').map((item) => {
      const repair = asRecord(item, 'Integrity repair item')
      return {
        issue: getString(repair, 'issue'),
        repairAction: getString(repair, 'repairAction'),
        section: getString(repair, 'section'),
      }
    }),
    sections: getRequiredArray(record, 'sections').map(normalizeIntegritySection),
    timestamp: getString(record, 'timestamp'),
    warnings: getRequiredNumber(record, 'warnings'),
  }
}

function normalizeIntegritySection(item: unknown): IntegritySection {
  const record = asRecord(item, 'Integrity section')

  return {
    checks: getArray(record, 'checks').map(normalizeIntegrityCheck),
    description: getString(record, 'description'),
    errors: getNumber(record, 'errors'),
    id: getRequiredString(record, 'id'),
    issues: getArray(record, 'issues').map(normalizeIntegrityIssue),
    repairAction: getString(record, 'repairAction'),
    repairable: getBoolean(record, 'repairable'),
    status: getString(record, 'status'),
    title: getRequiredString(record, 'title'),
    warnings: getNumber(record, 'warnings'),
  }
}

function normalizeIntegrityCheck(item: unknown): IntegrityCheck {
  const record = asRecord(item, 'Integrity check')

  return {
    data: getArray(record, 'data'),
    detail: getString(record, 'detail'),
    status: getString(record, 'status'),
    target: getRequiredString(record, 'target'),
  }
}

function normalizeIntegrityIssue(item: unknown): IntegrityIssue {
  const record = asRecord(item, 'Integrity issue')
  const severity = getString(record, 'severity')

  return {
    detail: getString(record, 'detail'),
    id: getRequiredString(record, 'id'),
    repairAction: getString(record, 'repairAction'),
    repairable: getBoolean(record, 'repairable'),
    severity:
      severity === 'error' || severity === 'warning' || severity === 'info'
        ? severity
        : 'info',
    target: getString(record, 'target'),
    title: getRequiredString(record, 'title'),
  }
}

function normalizeOperationsPayload(payload: unknown): OperationsDashboardData {
  const record = asRecord(payload, 'Operations response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Operations failed.')
  }

  const summary = getRequiredRecord(record, 'summary')
  const leagueStatistics = getRequiredRecord(summary, 'leagueStatistics')
  const cacheStatus = getRequiredRecord(summary, 'cacheStatus')
  const discordStatus = normalizeOperationsDiscordStatus(
    getOptionalRecord(summary, 'discordStatus') ??
      getOptionalRecord(record, 'discord') ??
      {},
  )

  return {
    summary: {
      pendingArmyLists: getRequiredNumber(summary, 'pendingArmyLists'),
      pendingStreams: getRequiredNumber(summary, 'pendingStreams'),
      pendingNews: getRequiredNumber(summary, 'pendingNews'),
      recentMatchSubmissions: getRequiredArray(
        summary,
        'recentMatchSubmissions',
      ).map(normalizeRecentGame),
      leagueStatistics: {
        games: getRequiredNumber(leagueStatistics, 'games'),
        activePlayers: getRequiredNumber(leagueStatistics, 'activePlayers'),
        factions: getRequiredNumber(leagueStatistics, 'factions'),
        missions: getRequiredNumber(leagueStatistics, 'missions'),
      },
      cacheStatus: normalizeCacheStatus(cacheStatus),
      systemHealth: normalizeStringRecord(getRequiredRecord(summary, 'systemHealth')),
      leagueAuditSummary: normalizeAuditSummary(
        getRequiredRecord(summary, 'leagueAuditSummary'),
      ),
      seasonStatus: normalizeSeasonStatus(getRequiredRecord(summary, 'seasonStatus')),
      identityStatus: normalizeOperationsIdentityStatus(
        getRequiredRecord(summary, 'identityStatus'),
      ),
      notificationStatus: normalizeOperationsNotificationStatus(
        getRequiredRecord(summary, 'notificationStatus'),
      ),
      discordStatus,
      deploymentStatus: normalizeOperationsDeploymentStatus(
        getRequiredRecord(summary, 'deploymentStatus'),
      ),
    },
    pendingArmyLists: getRequiredArray(record, 'pendingArmyLists').map(
      normalizeArmyList,
    ),
    streams: getRequiredArray(record, 'streams').map(normalizeStreamedGame),
    news: getRequiredArray(record, 'news').map(normalizeOperationsNewsItem),
    players: getRequiredArray(record, 'players').map(normalizeOperationsPlayer),
    identity: normalizeOperationsIdentityManagement(
      getRequiredRecord(record, 'identity'),
    ),
    eventLifecycle: normalizeEventLifecycleData(
      getRequiredRecord(record, 'eventLifecycle'),
    ),
    discord: normalizeOperationsDiscordStatus(
      getOptionalRecord(record, 'discord') ?? discordStatus,
    ),
    settings: normalizeSettingsRecord(getRequiredRecord(record, 'settings')),
    audit: normalizeLeagueAudit(getRequiredRecord(record, 'audit')),
  }
}

function normalizeEventLifecycleData(
  record: Record<string, unknown>,
): EventLifecycleData {
  const automation = getRequiredRecord(record, 'automation')
  const template = getRequiredRecord(automation, 'template')
  const discord = getRequiredRecord(record, 'discord')
  const health = getRequiredRecord(record, 'health')
  const validation = getRequiredRecord(record, 'validation')

  return {
    auditLog: getRequiredArray(record, 'auditLog').map(
      normalizeEventLifecycleAuditEntry,
    ),
    automation: {
      destinations: getRequiredArray(automation, 'destinations').map(String),
      enabled: getBoolean(automation, 'enabled'),
      eventType: getRequiredString(automation, 'eventType'),
      template: {
        body: getString(template, 'body'),
        enabled: getBoolean(template, 'enabled'),
        title: getString(template, 'title'),
      },
    },
    currentRound: getString(record, 'currentRound'),
    currentSeason: getString(record, 'currentSeason'),
    currentStage: getRequiredString(record, 'currentStage'),
    discord: {
      configured: getBoolean(discord, 'configured'),
      enabled: getBoolean(discord, 'enabled'),
      preview: normalizeOperationsDiscordPreview(
        getOptionalRecord(discord, 'preview') ?? {},
      ),
      status: getRequiredString(discord, 'status'),
      webhookMasked: getString(discord, 'webhookMasked'),
    },
    endDate: getString(record, 'endDate'),
    event: normalizeEventLifecycleEvent(getRequiredRecord(record, 'event')),
    health: {
      automationHealth: getRequiredString(health, 'automationHealth'),
      discordStatus: getRequiredString(health, 'discordStatus'),
      gamesCompleted: getRequiredNumber(health, 'gamesCompleted'),
      gamesRemaining: getRequiredNumber(health, 'gamesRemaining'),
      latePlayers: getRequiredArray(health, 'latePlayers').map((item) => {
        const latePlayer = asRecord(item, 'Event lifecycle late player')

        return {
          displayName: getString(latePlayer, 'displayName'),
          games: getNumber(latePlayer, 'games'),
          player: getRequiredString(latePlayer, 'player'),
        }
      }),
      missingPairings: getRequiredNumber(health, 'missingPairings'),
      participants: getRequiredNumber(health, 'participants'),
      playersWithoutIdentity: getRequiredNumber(health, 'playersWithoutIdentity'),
      registrationProgress: getRequiredString(health, 'registrationProgress'),
      rounds: getRequiredNumber(health, 'rounds'),
    },
    nextTransition: normalizeEventLifecycleTransition(
      getRequiredRecord(record, 'nextTransition'),
    ),
    participants: getRequiredNumber(record, 'participants'),
    registration: getString(record, 'registration'),
    rollback: normalizeEventLifecycleRollback(getRequiredRecord(record, 'rollback')),
    rounds: getRequiredNumber(record, 'rounds'),
    startDate: getString(record, 'startDate'),
    status: getString(record, 'status'),
    supportedStages: getRequiredArray(record, 'supportedStages').map(String),
    validation: {
      blockingIssues: getRequiredArray(validation, 'blockingIssues').map(
        normalizeEventLifecycleValidationIssue,
      ),
      color: getRequiredString(validation, 'color'),
      healthScore: getRequiredNumber(validation, 'healthScore'),
      issues: getRequiredArray(validation, 'issues').map(
        normalizeEventLifecycleValidationIssue,
      ),
      overallStatus: getRequiredString(validation, 'overallStatus'),
      repairable: getRequiredNumber(validation, 'repairable'),
    },
    warnings: getRequiredArray(record, 'warnings').map(
      normalizeEventLifecycleWarning,
    ),
  }
}

function normalizeEventLifecycleEvent(
  record: Record<string, unknown>,
): EventLifecycleEvent {
  return {
    achievements: getString(record, 'achievements'),
    archive: getString(record, 'archive'),
    automation: getString(record, 'automation'),
    commissioners: getString(record, 'commissioners'),
    communityId: getString(record, 'communityId'),
    createdAt: getString(record, 'createdAt'),
    description: getString(record, 'description'),
    discord: getString(record, 'discord'),
    endDate: getString(record, 'endDate'),
    history: getString(record, 'history'),
    id: getRequiredString(record, 'id'),
    lifecycleStage: getRequiredString(record, 'lifecycleStage'),
    name: getRequiredString(record, 'name'),
    owner: getString(record, 'owner'),
    participants: getString(record, 'participants'),
    registration: getString(record, 'registration'),
    rules: getString(record, 'rules'),
    scoringModel: getString(record, 'scoringModel'),
    seriesId: getString(record, 'seriesId'),
    standingsModel: getString(record, 'standingsModel'),
    startDate: getString(record, 'startDate'),
    status: getString(record, 'status'),
    templateId: getString(record, 'templateId'),
    type: getString(record, 'type'),
    updatedAt: getString(record, 'updatedAt'),
  }
}

function normalizeEventLifecycleTransition(
  record: Record<string, unknown>,
): EventLifecycleTransition {
  return {
    available: getBoolean(record, 'available'),
    blockedReason: getString(record, 'blockedReason'),
    confirmationBody: getArray(record, 'confirmationBody').map(String),
    confirmationTitle: getString(record, 'confirmationTitle'),
    label: getRequiredString(record, 'label'),
    repairAction: getString(record, 'repairAction'),
    targetStage: getString(record, 'targetStage'),
  }
}

function normalizeEventLifecycleValidationIssue(
  item: unknown,
): EventLifecycleValidationIssue {
  const record = asRecord(item, 'Event lifecycle validation issue')

  return {
    blocksTransition: getBoolean(record, 'blocksTransition'),
    id: getRequiredString(record, 'id'),
    impact: getRequiredString(record, 'impact'),
    problem: getRequiredString(record, 'problem'),
    reason: getRequiredString(record, 'reason'),
    recommendedAction: getRequiredString(record, 'recommendedAction'),
    repairAction: getString(record, 'repairAction'),
    repairLabel: getString(record, 'repairLabel'),
    severity: getRequiredString(record, 'severity'),
    targetStage: getString(record, 'targetStage'),
  }
}

function normalizeEventLifecycleRollback(
  record: Record<string, unknown>,
): EventLifecycleRollback {
  return {
    available: getBoolean(record, 'available'),
    label: getRequiredString(record, 'label'),
    reason: getString(record, 'reason'),
    targetStage: getString(record, 'targetStage'),
  }
}

function normalizeEventLifecycleWarning(item: unknown): EventLifecycleWarning {
  const record = asRecord(item, 'Event lifecycle warning')

  return {
    message: getRequiredString(record, 'message'),
    severity: getRequiredString(record, 'severity'),
    suggestedFix: getRequiredString(record, 'suggestedFix'),
  }
}

function normalizeEventLifecycleAuditEntry(
  item: unknown,
): EventLifecycleAuditEntry {
  const record = asRecord(item, 'Event lifecycle audit entry')

  return {
    automationResult: getString(record, 'automationResult'),
    commissioner: getString(record, 'commissioner'),
    eventId: getRequiredString(record, 'eventId'),
    eventName: getString(record, 'eventName'),
    newStage: getRequiredString(record, 'newStage'),
    problem: getString(record, 'problem'),
    previousStage: getRequiredString(record, 'previousStage'),
    repair: getString(record, 'repair'),
    reason: getString(record, 'reason'),
    timestamp: getRequiredString(record, 'timestamp'),
  }
}

function normalizeOperationsDiscordStatus(
  record: Record<string, unknown>,
): OperationsDiscordStatus {
  return {
    enabled: getBoolean(record, 'enabled'),
    configured: getBoolean(record, 'configured'),
    webhookMasked: getString(record, 'webhookMasked'),
    announcementChannel: getString(record, 'announcementChannel'),
    adminChannel: getString(record, 'adminChannel'),
    rateLimitPerHour: getNumber(record, 'rateLimitPerHour'),
    retryLimit: getNumber(record, 'retryLimit'),
    automationEvents: getArray(record, 'automationEvents').map(String),
    lastAutomationRun: getString(record, 'lastAutomationRun'),
    queueDepth: getNumber(record, 'queueDepth'),
    failures: getNumber(record, 'failures'),
    lastResult: getOptionalRecord(record, 'lastResult')
      ? normalizeOperationsDiscordLogEntry(
          getRequiredRecord(record, 'lastResult'),
        )
      : null,
    log: getArray(record, 'log').map(normalizeOperationsDiscordLogEntry),
    preview: normalizeOperationsDiscordPreview(
      getOptionalRecord(record, 'preview') ?? {},
    ),
  }
}

function normalizeOperationsDiscordLogEntry(
  item: unknown,
): OperationsDiscordLogEntry {
  const record = asRecord(item, 'Discord log entry')

  return {
    rowNumber: getNumber(record, 'rowNumber'),
    timestamp: getString(record, 'timestamp'),
    event: getString(record, 'event'),
    title: getString(record, 'title'),
    webhook: getString(record, 'webhook'),
    success: getBoolean(record, 'success'),
    failure: getString(record, 'failure'),
    retryCount: getNumber(record, 'retryCount'),
    payload: getString(record, 'payload'),
    response: getString(record, 'response'),
    status: getString(record, 'status'),
  }
}

function normalizeOperationsDiscordPreview(
  record: Record<string, unknown>,
): OperationsDiscordPreview {
  return {
    event: getString(record, 'event'),
    label: getString(record, 'label'),
    content: getString(record, 'content'),
    embeds: getArray(record, 'embeds').map(normalizeOperationsDiscordEmbed),
  }
}

function normalizeOperationsDiscordEmbed(
  item: unknown,
): OperationsDiscordEmbed {
  const record = asRecord(item, 'Discord preview embed')

  return {
    description: getString(record, 'description'),
    fields: getArray(record, 'fields').map(normalizeOperationsDiscordField),
    title: getString(record, 'title'),
    url: getString(record, 'url'),
  }
}

function normalizeOperationsDiscordField(
  item: unknown,
): OperationsDiscordField {
  const record = asRecord(item, 'Discord preview field')

  return {
    inline: getBoolean(record, 'inline'),
    name: getString(record, 'name'),
    value: getString(record, 'value'),
  }
}

function normalizeAutomationPayload(payload: unknown): AutomationCenterData {
  const record = asRecord(payload, 'Automation response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Automation Center failed.')
  }

  const automation = getRequiredRecord(record, 'automation')

  return {
    destinations: getArray(automation, 'destinations').map(
      normalizeAutomationDestination,
    ),
    discord: normalizeOperationsDiscordStatus(
      getRequiredRecord(automation, 'discord'),
    ),
    events: getArray(automation, 'events').map(normalizeAutomationEventRecord),
    eventTypes: getArray(automation, 'eventTypes').map(
      normalizeAutomationEventType,
    ),
    queue: getArray(automation, 'queue').map(normalizeAutomationQueueItem),
    rules: normalizeAutomationRules(getRequiredRecord(automation, 'rules')),
    status: normalizeAutomationStatus(getRequiredRecord(automation, 'status')),
    templates: getArray(automation, 'templates').map(normalizeAutomationTemplate),
  }
}

function normalizeAutomationEventType(item: unknown): AutomationEventType {
  const record = asRecord(item, 'Automation event type')

  return {
    category: getString(record, 'category'),
    eventType: getString(record, 'eventType'),
    label: getString(record, 'label'),
    priority: getString(record, 'priority'),
    rule: normalizeAutomationRule(getRequiredRecord(record, 'rule')),
  }
}

function normalizeAutomationRules(
  record: Record<string, unknown>,
): Record<string, AutomationRule> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      normalizeAutomationRule(asRecord(value, 'Automation rule')),
    ]),
  )
}

function normalizeAutomationRule(record: Record<string, unknown>): AutomationRule {
  return {
    commissionerFeed: getBoolean(record, 'commissionerFeed'),
    discord: getBoolean(record, 'discord'),
    email: getBoolean(record, 'email'),
    enabled: getBoolean(record, 'enabled'),
    eventType: getString(record, 'eventType'),
    news: getBoolean(record, 'news'),
    portal: getBoolean(record, 'portal'),
    priority: getString(record, 'priority'),
    publicApi: getBoolean(record, 'publicApi'),
    push: getBoolean(record, 'push'),
    templateId: getString(record, 'templateId'),
    timeline: getBoolean(record, 'timeline'),
  }
}

function normalizeAutomationTemplate(item: unknown): AutomationTemplate {
  const record = asRecord(item, 'Automation template')

  return {
    body: getString(record, 'body'),
    discordFormat: getString(record, 'discordFormat'),
    enabled: getBoolean(record, 'enabled'),
    eventType: getString(record, 'eventType'),
    name: getString(record, 'name'),
    templateId: getString(record, 'templateId'),
    title: getString(record, 'title'),
  }
}

function normalizeAutomationQueueItem(item: unknown): AutomationQueueItem {
  const record = asRecord(item, 'Automation queue item')

  return {
    attempts: getNumber(record, 'attempts'),
    destination: getString(record, 'destination'),
    eventId: getString(record, 'eventId'),
    eventType: getString(record, 'eventType'),
    lastAttempt: getString(record, 'lastAttempt'),
    payload: getString(record, 'payload'),
    queueId: getString(record, 'queueId'),
    reason: getString(record, 'reason'),
    status: getString(record, 'status'),
    timestamp: getString(record, 'timestamp'),
  }
}

function normalizeAutomationEventRecord(item: unknown): AutomationEventRecord {
  const record = asRecord(item, 'Automation event record')

  return {
    category: getString(record, 'category'),
    destinations: getString(record, 'destinations'),
    division: getString(record, 'division'),
    eventId: getString(record, 'eventId'),
    eventType: getString(record, 'eventType'),
    message: getString(record, 'message'),
    payload: getString(record, 'payload'),
    player: getString(record, 'player'),
    priority: getString(record, 'priority'),
    status: getString(record, 'status'),
    timestamp: getString(record, 'timestamp'),
  }
}

function normalizeAutomationStatus(record: Record<string, unknown>): AutomationStatus {
  return {
    discordConnected: getBoolean(record, 'discordConnected'),
    enabled: getBoolean(record, 'enabled'),
    health: getString(record, 'health'),
    lastAutomationRun: getString(record, 'lastAutomationRun'),
    lastFailure: getString(record, 'lastFailure'),
    lastMessage: getString(record, 'lastMessage'),
    queueSize: getNumber(record, 'queueSize'),
    retryQueue: getNumber(record, 'retryQueue'),
    webhookHealthy: getBoolean(record, 'webhookHealthy'),
  }
}

function normalizeAutomationDestination(value: unknown): AutomationDestination {
  const destination = String(value)

  if (
    destination === 'commissionerFeed' ||
    destination === 'discord' ||
    destination === 'email' ||
    destination === 'news' ||
    destination === 'portal' ||
    destination === 'publicApi' ||
    destination === 'push' ||
    destination === 'timeline'
  ) {
    return destination
  }

  return 'portal'
}

function normalizeOperationsIdentityStatus(
  record: Record<string, unknown>,
): OperationsIdentityStatus {
  return {
    totalUsers: getNumber(record, 'totalUsers'),
    enabledUsers: getNumber(record, 'enabledUsers'),
    disabledUsers: getNumber(record, 'disabledUsers'),
    linkedUsers: getNumber(record, 'linkedUsers'),
    unlinkedUsers: getNumber(record, 'unlinkedUsers'),
    commissionerUsers: getNumber(record, 'commissionerUsers'),
    assistantUsers: getNumber(record, 'assistantUsers'),
    playersWithEmail: getNumber(record, 'playersWithEmail'),
    playersWithoutEmail: getNumber(record, 'playersWithoutEmail'),
    playersWithoutUser: getNumber(record, 'playersWithoutUser'),
  }
}

function normalizeOperationsNotificationStatus(
  record: Record<string, unknown>,
): OperationsNotificationStatus {
  return {
    total: getNumber(record, 'total'),
    highPriority: getNumber(record, 'highPriority'),
    normalPriority: getNumber(record, 'normalPriority'),
  }
}

function normalizeOperationsDeploymentStatus(
  record: Record<string, unknown>,
): OperationsDeploymentStatus {
  return {
    portalVersion: getString(record, 'portalVersion'),
    appsScriptVersion: getString(record, 'appsScriptVersion'),
    deploymentUrl: getString(record, 'deploymentUrl'),
    gitCommit: getString(record, 'gitCommit'),
    checkedAt: getString(record, 'checkedAt'),
  }
}

function normalizeOperationsPlayer(item: unknown): OperationsPlayer {
  const record = asRecord(item, 'Operations player')

  return {
    division: getString(record, 'division'),
    displayName: getString(record, 'displayName') || getString(record, 'player'),
    games: getNumber(record, 'games'),
    player: getString(record, 'player'),
    rank: getNumber(record, 'rank'),
  }
}

function normalizeOperationsIdentityManagement(
  record: Record<string, unknown>,
): OperationsIdentityManagement {
  return {
    records: getRequiredArray(record, 'records').map(normalizeOperationsIdentityRecord),
    audits: getRequiredArray(record, 'audits').map(normalizeOperationsIdentityAudit),
  }
}

function normalizeOperationsIdentityRecord(
  item: unknown,
): OperationsIdentityRecord {
  const record = asRecord(item, 'Operations identity record')

  return {
    id: getString(record, 'id'),
    player: getString(record, 'player'),
    displayName: getString(record, 'displayName') || getString(record, 'player'),
    division: getString(record, 'division'),
    googleEmail: getString(record, 'googleEmail'),
    portalUser: getString(record, 'portalUser'),
    role: getString(record, 'role'),
    lastLogin: getString(record, 'lastLogin'),
    lastSeen: getString(record, 'lastSeen'),
    linked: getBoolean(record, 'linked'),
    enabled: getBoolean(record, 'enabled'),
    missingEmail: getBoolean(record, 'missingEmail'),
    duplicateEmail: getBoolean(record, 'duplicateEmail'),
    duplicatePlayer: getBoolean(record, 'duplicatePlayer'),
    neverLoggedIn: getBoolean(record, 'neverLoggedIn'),
    brokenMapping: getBoolean(record, 'brokenMapping'),
  }
}

function normalizeOperationsIdentityAudit(
  item: unknown,
): OperationsIdentityAudit {
  const record = asRecord(item, 'Operations identity audit')
  const severity = getString(record, 'severity')

  return {
    severity:
      severity === 'critical' || severity === 'warning' ? severity : 'info',
    type: getString(record, 'type'),
    player: getString(record, 'player'),
    googleEmail: getString(record, 'googleEmail'),
    message: getString(record, 'message'),
  }
}

function normalizeOperationsSeasonPayload(payload: unknown): OperationsSeasonData {
  const record = asRecord(payload, 'Operations season response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Season data failed.')
  }

  const promotionRelegation = getRequiredRecord(record, 'promotionRelegation')

  return {
    season: normalizeSeasonStatus(getRequiredRecord(record, 'season')),
    promotionRelegation: {
      relegatedFromMain: getRequiredArray(
        promotionRelegation,
        'relegatedFromMain',
      ).map(normalizeStanding),
      promotedFromProvingGroundsA: getRequiredArray(
        promotionRelegation,
        'promotedFromProvingGroundsA',
      ).map(normalizeStanding),
      promotedFromProvingGroundsB: getRequiredArray(
        promotionRelegation,
        'promotedFromProvingGroundsB',
      ).map(normalizeStanding),
    },
    archive: getRequiredArray(record, 'archive').map((item) => {
      const archive = asRecord(item, 'Season archive item')
      return {
        date: getString(archive, 'date'),
        operation: getString(archive, 'operation'),
        snapshot: getString(archive, 'snapshot'),
      }
    }),
  }
}

function normalizeLeagueAudit(record: Record<string, unknown>): LeagueAudit {
  return {
    summary: normalizeAuditSummary(getRequiredRecord(record, 'summary')),
    issues: getRequiredArray(record, 'issues').map(normalizeAuditIssue),
  }
}

function normalizeAuditSummary(record: Record<string, unknown>) {
  return {
    critical: getRequiredNumber(record, 'critical'),
    warning: getRequiredNumber(record, 'warning'),
    informational: getRequiredNumber(record, 'informational'),
  }
}

function normalizeAuditIssue(item: unknown): AuditIssue {
  const record = asRecord(item, 'Audit issue')
  const severity = getRequiredString(record, 'severity')

  return {
    severity:
      severity === 'critical' || severity === 'warning' ? severity : 'info',
    description: getRequiredString(record, 'description'),
    suggestedFix: getRequiredString(record, 'suggestedFix'),
    link: getString(record, 'link'),
  }
}

function normalizeSeasonStatus(record: Record<string, unknown>): SeasonStatus {
  return {
    currentSeasonName: getString(record, 'currentSeasonName'),
    startDate: getString(record, 'startDate'),
    endDate: getString(record, 'endDate'),
    weeksCompleted: getRequiredNumber(record, 'weeksCompleted'),
    matchesPlayed: getRequiredNumber(record, 'matchesPlayed'),
    remainingMatches: getRequiredNumber(record, 'remainingMatches'),
    registrationOpen: getBoolean(record, 'registrationOpen'),
  }
}

function normalizeCacheStatus(record: Record<string, unknown>) {
  const performance = getOptionalRecord(record, 'performance') ?? {}

  return {
    status: getString(record, 'status'),
    version: getString(record, 'version'),
    lastRefresh: getString(record, 'lastRefresh'),
    cacheAge: getString(record, 'cacheAge'),
    entries: getArray(record, 'entries').map((item) => {
      const entry = asRecord(item, 'Cache entry')
      return {
        action: getString(entry, 'action'),
        ageSeconds: getNumber(entry, 'ageSeconds'),
        createdAt: getString(entry, 'createdAt'),
        expiresAt: getString(entry, 'expiresAt'),
        group: getString(entry, 'group'),
        health: getString(entry, 'health'),
        lastRefresh: getString(entry, 'lastRefresh'),
        size: getNumber(entry, 'size'),
        status: getString(entry, 'status'),
        timeRemainingSeconds: getNumber(entry, 'timeRemainingSeconds'),
        version: getString(entry, 'version'),
      }
    }),
    performance: {
      averageApiResponse: getString(performance, 'averageApiResponse'),
      cacheHitRate: getNumber(performance, 'cacheHitRate'),
      cacheMissRate: getNumber(performance, 'cacheMissRate'),
      errors: getNumber(performance, 'errors'),
      estimatedPerformanceImprovement: getString(
        performance,
        'estimatedPerformanceImprovement',
      ),
      fastestEndpoint: getString(performance, 'fastestEndpoint'),
      googleSheetsReads: getNumber(performance, 'googleSheetsReads'),
      slowestEndpoint: getString(performance, 'slowestEndpoint'),
      staleFallbacks: getNumber(performance, 'staleFallbacks'),
      totalCacheRefreshes: getNumber(performance, 'totalCacheRefreshes'),
    },
  }
}

function normalizeStringRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : String(value ?? ''),
    ]),
  )
}

function normalizeBooleanRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value === true]),
  )
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
    .filter((item) => item.trim().length > 0)
}

function normalizeOperationsNewsItem(item: unknown): OperationsNewsItem {
  const record = asRecord(item, 'Operations news item')

  return {
    body: getString(record, 'body'),
    id: getRequiredNumber(record, 'id'),
    date: getString(record, 'date'),
    link: getString(record, 'link'),
    relatedFaction: getString(record, 'relatedFaction'),
    relatedMission: getString(record, 'relatedMission'),
    relatedPlayer: getString(record, 'relatedPlayer'),
    title: getString(record, 'title'),
    pinned: getBoolean(record, 'pinned'),
    archived: getBoolean(record, 'archived'),
  }
}

function normalizeMutationPayload(payload: unknown, fallbackMessage: string) {
  const record = asRecord(payload, 'Mutation response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || fallbackMessage)
  }
}

function normalizeArmyList(item: unknown): ArmyList {
  const record = asRecord(item, 'Army list')

  return {
    id: getRequiredNumber(record, 'id'),
    submissionDate: getString(record, 'submissionDate'),
    player: getRequiredString(record, 'player'),
    playerDisplayName:
      getString(record, 'playerDisplayName') || getRequiredString(record, 'player'),
    faction: getRequiredString(record, 'faction'),
    sectorial: getString(record, 'sectorial'),
    mission: getString(record, 'mission'),
    event: getString(record, 'event'),
    armyCode: getString(record, 'armyCode'),
    armyLink: getString(record, 'armyLink'),
    armyName: getRequiredString(record, 'armyName'),
    description: getString(record, 'description'),
    submitterEmail: getString(record, 'submitterEmail'),
    upvotes: getRequiredNumber(record, 'upvotes'),
    downvotes: getRequiredNumber(record, 'downvotes'),
    score: getRequiredNumber(record, 'score'),
    approved: getBoolean(record, 'approved'),
  }
}

function normalizePlayerArmyListSummary(value: unknown): PlayerArmyListSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      submitted: 0,
      highestRated: null,
      newest: null,
      averageRating: 0,
      favoriteFaction: '',
    }
  }

  const record = value as Record<string, unknown>

  return {
    submitted: getNumber(record, 'submitted'),
    highestRated: record.highestRated ? normalizeArmyList(record.highestRated) : null,
    newest: record.newest ? normalizeArmyList(record.newest) : null,
    averageRating: getNumber(record, 'averageRating'),
    favoriteFaction: getString(record, 'favoriteFaction'),
  }
}

function normalizeFactionArmyLists(value: unknown): FactionArmyLists {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      mostPopular: [],
      highestRated: [],
      newest: [],
    }
  }

  const record = value as Record<string, unknown>

  return {
    mostPopular: getArray(record, 'mostPopular').map(normalizeArmyList),
    highestRated: getArray(record, 'highestRated').map(normalizeArmyList),
    newest: getArray(record, 'newest').map(normalizeArmyList),
  }
}

function normalizeFactionMatchup(item: unknown): FactionMatchup {
  const record = asRecord(item, 'Faction matchup')

  return {
    opponent: getRequiredString(record, 'opponent'),
    games: getRequiredNumber(record, 'games'),
    wins: getRequiredNumber(record, 'wins'),
    losses: getRequiredNumber(record, 'losses'),
    winRate: getRequiredNumber(record, 'winRate'),
    averageTP: getRequiredNumber(record, 'averageTP'),
    averageOP: getRequiredNumber(record, 'averageOP'),
    averageVP: getRequiredNumber(record, 'averageVP'),
  }
}

function normalizeFactionMatchupSummary(value: unknown): FactionMatchupSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      opponents: 0,
      games: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      bestOpponent: '',
    }
  }

  const record = value as Record<string, unknown>

  return {
    opponents: getNumber(record, 'opponents'),
    games: getNumber(record, 'games'),
    wins: getNumber(record, 'wins'),
    losses: getNumber(record, 'losses'),
    winRate: getNumber(record, 'winRate'),
    bestOpponent: getString(record, 'bestOpponent'),
  }
}

function normalizeArmyListCommunity(value: unknown): ArmyListCommunitySummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      topContributors: [],
      highestRatedDesigner: null,
      mostPopularFaction: '',
      trendingLists: [],
      mostListsSubmitted: [],
    }
  }

  const record = value as Record<string, unknown>

  return {
    topContributors: getArray(record, 'topContributors').map(normalizeNameCount),
    highestRatedDesigner: record.highestRatedDesigner
      ? normalizeDesigner(record.highestRatedDesigner)
      : null,
    mostPopularFaction: getString(record, 'mostPopularFaction'),
    trendingLists: getArray(record, 'trendingLists').map(normalizeArmyList),
    mostListsSubmitted: getArray(record, 'mostListsSubmitted').map(
      normalizeNameCount,
    ),
  }
}

function normalizeNameCount(item: unknown) {
  const record = asRecord(item, 'Name count')

  return {
    count: getRequiredNumber(record, 'count'),
    displayName: getString(record, 'displayName') || undefined,
    name: getRequiredString(record, 'name'),
  }
}

function normalizeDesigner(item: unknown) {
  const record = asRecord(item, 'Designer')

  return {
    displayName: getString(record, 'displayName') || undefined,
    lists: getRequiredNumber(record, 'lists'),
    name: getRequiredString(record, 'name'),
    score: getRequiredNumber(record, 'score'),
  }
}

function normalizeStreamedGame(item: unknown): StreamedGame {
  const record = asRecord(item, 'Streamed game')

  return {
    id: getRequiredNumber(record, 'id'),
    date: getString(record, 'date'),
    division: getString(record, 'division'),
    mission: getString(record, 'mission'),
    player1: getString(record, 'player1'),
    player1Faction: getString(record, 'player1Faction'),
    player2: getString(record, 'player2'),
    player2Faction: getString(record, 'player2Faction'),
    youtubeUrl: getRequiredString(record, 'youtubeUrl'),
    featured: getBoolean(record, 'featured'),
  }
}

function normalizeIntelligenceStreak(item: unknown): IntelligenceStreak {
  const record = asRecord(item, 'Intelligence streak')

  return {
    player: getRequiredString(record, 'player'),
    displayName: getString(record, 'displayName') || getRequiredString(record, 'player'),
    games: getRequiredNumber(record, 'games'),
    type: getString(record, 'type'),
    story: getRequiredString(record, 'story'),
  }
}

function normalizeIntelligenceGame(item: unknown): IntelligenceGame {
  const record = asRecord(item, 'Intelligence game')

  return {
    id: getRequiredNumber(record, 'id'),
    date: getString(record, 'date'),
    division: getString(record, 'division'),
    mission: getRequiredString(record, 'mission'),
    winner: getRequiredString(record, 'winner'),
    winnerDisplayName:
      getString(record, 'winnerDisplayName') || getRequiredString(record, 'winner'),
    loser: getRequiredString(record, 'loser'),
    loserDisplayName:
      getString(record, 'loserDisplayName') || getRequiredString(record, 'loser'),
    winnerFaction: getString(record, 'winnerFaction'),
    loserFaction: getString(record, 'loserFaction'),
    vp: getString(record, 'vp'),
    op: getString(record, 'op'),
    tp: getString(record, 'tp'),
    value: getRequiredNumber(record, 'value'),
    label: getString(record, 'label'),
    story: getRequiredString(record, 'story'),
  }
}

function normalizeFactionMomentum(item: unknown): FactionMomentum {
  const record = asRecord(item, 'Faction momentum')

  return {
    faction: getRequiredString(record, 'faction'),
    games: getRequiredNumber(record, 'games'),
    wins: getRequiredNumber(record, 'wins'),
    losses: getRequiredNumber(record, 'losses'),
    trend: getRequiredString(record, 'trend'),
    story: getRequiredString(record, 'story'),
  }
}

function normalizeIntelligenceMissionTrend(
  item: unknown,
): IntelligenceMissionTrend {
  const record = asRecord(item, 'Mission trend')

  return {
    mission: getRequiredString(record, 'mission'),
    games: getRequiredNumber(record, 'games'),
    averageVP: getRequiredNumber(record, 'averageVP'),
    averageOP: getRequiredNumber(record, 'averageOP'),
    averageTP: getRequiredNumber(record, 'averageTP'),
    firstTurnWinRate: getRequiredNumber(record, 'firstTurnWinRate'),
    mostSuccessfulFaction: getString(record, 'mostSuccessfulFaction'),
    story: getRequiredString(record, 'story'),
  }
}

function normalizeRecentUpset(item: unknown): RecentUpset {
  const record = asRecord(item, 'Recent upset')

  return {
    id: getRequiredNumber(record, 'id'),
    date: getString(record, 'date'),
    division: getString(record, 'division'),
    winner: getRequiredString(record, 'winner'),
    winnerDisplayName:
      getString(record, 'winnerDisplayName') || getRequiredString(record, 'winner'),
    loser: getRequiredString(record, 'loser'),
    loserDisplayName:
      getString(record, 'loserDisplayName') || getRequiredString(record, 'loser'),
    winnerRank: getRequiredNumber(record, 'winnerRank'),
    loserRank: getRequiredNumber(record, 'loserRank'),
    mission: getRequiredString(record, 'mission'),
    story: getRequiredString(record, 'story'),
  }
}

function normalizeStandingsBattle(item: unknown): StandingsBattle {
  const record = asRecord(item, 'Standings battle')

  return {
    division: getRequiredString(record, 'division'),
    player: getRequiredString(record, 'player'),
    displayName: getString(record, 'displayName') || getRequiredString(record, 'player'),
    rank: getRequiredNumber(record, 'rank'),
    tp: getRequiredNumber(record, 'tp'),
    op: getRequiredNumber(record, 'op'),
    vp: getRequiredNumber(record, 'vp'),
    chaser: getString(record, 'chaser') || undefined,
    chaserDisplayName: getString(record, 'chaserDisplayName') || undefined,
    target: getString(record, 'target') || undefined,
    targetDisplayName: getString(record, 'targetDisplayName') || undefined,
    withinOneGame: getRequiredBoolean(record, 'withinOneGame'),
    story: getRequiredString(record, 'story'),
  }
}

function normalizeLeagueRecords(
  records: Record<string, unknown>,
): Record<string, LeagueRecordValue> {
  return Object.fromEntries(
    Object.entries(records).map(([key, value]) => [
      key,
      normalizeLeagueRecordValue(value),
    ]),
  )
}

function normalizeLeagueRecordValue(value: unknown): LeagueRecordValue {
  if (value === null) {
    return null
  }

  const record = asRecord(value, 'League record')

  if (typeof record.id === 'number') {
    return normalizeIntelligenceGame(record)
  }

  return {
    faction: getString(record, 'faction') || undefined,
    displayName: getString(record, 'displayName') || undefined,
    games: getRequiredNumber(record, 'games'),
    name: getString(record, 'name') || undefined,
    story: getRequiredString(record, 'story'),
    type: getString(record, 'type') || undefined,
    winRate:
      typeof record.winRate === 'number' && Number.isFinite(record.winRate)
        ? record.winRate
        : undefined,
    wins:
      typeof record.wins === 'number' && Number.isFinite(record.wins)
        ? record.wins
        : undefined,
  }
}

function normalizeRecentGame(item: unknown): RecentGame {
  const record = asRecord(item, 'Recent game')

  return {
    id: getRequiredNumber(record, 'id'),
    date: getRequiredString(record, 'date'),
    division: getString(record, 'division'),
    winner: getRequiredString(record, 'winner'),
    winnerDisplayName:
      getString(record, 'winnerDisplayName') || getRequiredString(record, 'winner'),
    loser: getRequiredString(record, 'loser'),
    loserDisplayName:
      getString(record, 'loserDisplayName') || getRequiredString(record, 'loser'),
    winnerFaction: getString(record, 'winnerFaction'),
    loserFaction: getString(record, 'loserFaction'),
    mission: getRequiredString(record, 'mission'),
    tp: getString(record, 'tp'),
    op: getString(record, 'op'),
    vp: getRequiredString(record, 'vp'),
    bestMoment: getString(record, 'bestMoment'),
    firstTurn: getString(record, 'firstTurn'),
  }
}

function buildFallbackLeagueOverview(standings: Standing[]): LeagueOverview {
  const gamesPlayed =
    standings.reduce((total, player) => total + player.games, 0) / 2
  const activePlayers = standings.filter((player) => player.games > 0).length

  return {
    divisions: [
      {
        division: 'main',
        divisionLabel: 'Main Man',
        players: standings.length,
        gamesPlayed,
        activePlayers,
      },
    ],
    totalLeagueGames: gamesPlayed,
    totalActivePlayers: activePlayers,
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  throw new Error(`${label} was not a JSON object.`)
}

function getRequiredRecord(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = record[key]

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  throw new Error(`API response is missing ${key}.`)
}

function getOptionalRecord(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return undefined
}

function getRequiredArray(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (Array.isArray(value)) {
    return value
  }

  throw new Error(`API response is missing ${key}.`)
}

function getArray(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return Array.isArray(value) ? value : []
}

function getRequiredString(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  throw new Error(`API response is missing ${key}.`)
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function getRequiredNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  throw new Error(`API response is missing ${key}.`)
}

function getNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getRequiredBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (typeof value === 'boolean') {
    return value
  }

  throw new Error(`API response is missing ${key}.`)
}

function getBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'boolean' ? value : false
}

function getDivisionKey(
  record: Record<string, unknown>,
  key: string,
): DivisionKey {
  const value = getRequiredString(record, key)

  if (value === 'main' || value === 'pga' || value === 'pgb') {
    return value
  }

  throw new Error(`API response has an unknown division: ${value}.`)
}

function getOptionalBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'boolean' ? value : undefined
}
