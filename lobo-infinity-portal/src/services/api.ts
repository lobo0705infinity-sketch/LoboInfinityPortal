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
  'https://script.google.com/macros/s/AKfycbwVmtbnFl0IcqViWhO5j13c_Z5dZ95KRDpFbFQEqY2UQVO-RSg0bPMk1Kn6EDIbb271AA/exec'

type ApiOptions = {
  signal?: AbortSignal
}

type RequestParams = Record<string, string>

export type ArmyList = {
  id: number
  submissionDate: string
  player: string
  faction: string
  sectorial: string
  mission: string
  event: string
  armyCode: string
  armyLink: string
  armyName: string
  description: string
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
}

export type ArmyListCommunitySummary = {
  topContributors: Array<{ count: number; name: string }>
  highestRatedDesigner: { lists: number; name: string; score: number } | null
  mostPopularFaction: string
  trendingLists: ArmyList[]
  mostListsSubmitted: Array<{ count: number; name: string }>
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
  loser: string
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
  loser: string
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
  rank: number
  tp: number
  op: number
  vp: number
  chaser?: string
  target?: string
  withinOneGame: boolean
  story: string
}

export type RecentUpset = {
  id: number
  date: string
  division: string
  winner: string
  loser: string
  winnerRank: number
  loserRank: number
  mission: string
  story: string
}

export type LeagueRecordValue =
  | IntelligenceGame
  | {
      faction?: string
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
  rank: number
  games: number
  wins: number
  losses: number
  tp: number
  op: number
  vp: number
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
  armyLists: ArmyList[]
  armyListCommunity: ArmyListCommunitySummary
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
    }
    systemHealth: Record<string, string>
    leagueAuditSummary: LeagueAudit['summary']
    seasonStatus: SeasonStatus
  }
  pendingArmyLists: ArmyList[]
  streams: StreamedGame[]
  news: OperationsNewsItem[]
  settings: PortalSettings
  audit: LeagueAudit
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
  getOperationsAudit: (options?: ApiOptions) => Promise<LeagueAudit>
  getOperationsSeason: (options?: ApiOptions) => Promise<OperationsSeasonData>
  operationsAction: (
    action: string,
    params?: Record<string, string | number | boolean>,
    options?: ApiOptions,
  ) => Promise<void>
}

const divisionKeys: DivisionKey[] = ['main', 'pga', 'pgb']

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
  getHome,
  getDashboard,
  getLeader,
  getRecentGames,
  getStandings,
  getAllStandings,
  getPlayers,
  getSearchData,
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
  submitArmyList,
  voteArmyList,
  getOperations,
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

  const response = await fetch(url, {
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`${action} request failed with status ${response.status}`)
  }

  return response.json()
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
      leagueLeader: response.leader.player,
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
    intelligence: normalizeIntelligencePayload(
      getRequiredRecord(record, 'intelligence'),
    ),
    records: normalizeLeagueRecords(getRequiredRecord(record, 'records')),
    hallOfFame: normalizeHallOfFamePayload(getRequiredRecord(record, 'hallOfFame')),
    settings: normalizeSettingsRecord(getRequiredRecord(record, 'settings')),
    armyLists: getArray(record, 'armyLists').map(normalizeArmyList),
    armyListCommunity: normalizeArmyListCommunity(record.armyListCommunity),
  }
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

  return {
    name: getRequiredString(player, 'name'),
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
  }
}

function normalizeHallOfFameLeader(item: unknown): HallOfFameLeader {
  const record = asRecord(item, 'Hall of Fame leader')

  return {
    division: getRequiredString(record, 'division'),
    player: getRequiredString(record, 'player'),
    rank: getRequiredNumber(record, 'rank'),
    games: getRequiredNumber(record, 'games'),
    wins: getRequiredNumber(record, 'wins'),
    losses: getRequiredNumber(record, 'losses'),
    tp: getRequiredNumber(record, 'tp'),
    op: getRequiredNumber(record, 'op'),
    vp: getRequiredNumber(record, 'vp'),
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

function normalizeOperationsPayload(payload: unknown): OperationsDashboardData {
  const record = asRecord(payload, 'Operations response')

  if (record.success === false) {
    throw new Error(getString(record, 'error') || 'Operations failed.')
  }

  const summary = getRequiredRecord(record, 'summary')
  const leagueStatistics = getRequiredRecord(summary, 'leagueStatistics')
  const cacheStatus = getRequiredRecord(summary, 'cacheStatus')

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
    },
    pendingArmyLists: getRequiredArray(record, 'pendingArmyLists').map(
      normalizeArmyList,
    ),
    streams: getRequiredArray(record, 'streams').map(normalizeStreamedGame),
    news: getRequiredArray(record, 'news').map(normalizeOperationsNewsItem),
    settings: normalizeSettingsRecord(getRequiredRecord(record, 'settings')),
    audit: normalizeLeagueAudit(getRequiredRecord(record, 'audit')),
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
  return {
    status: getString(record, 'status'),
    version: getString(record, 'version'),
    lastRefresh: getString(record, 'lastRefresh'),
    cacheAge: getString(record, 'cacheAge'),
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
    faction: getRequiredString(record, 'faction'),
    sectorial: getString(record, 'sectorial'),
    mission: getString(record, 'mission'),
    event: getString(record, 'event'),
    armyCode: getString(record, 'armyCode'),
    armyLink: getString(record, 'armyLink'),
    armyName: getRequiredString(record, 'armyName'),
    description: getString(record, 'description'),
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
    name: getRequiredString(record, 'name'),
  }
}

function normalizeDesigner(item: unknown) {
  const record = asRecord(item, 'Designer')

  return {
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
    loser: getRequiredString(record, 'loser'),
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
    loser: getRequiredString(record, 'loser'),
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
    rank: getRequiredNumber(record, 'rank'),
    tp: getRequiredNumber(record, 'tp'),
    op: getRequiredNumber(record, 'op'),
    vp: getRequiredNumber(record, 'vp'),
    chaser: getString(record, 'chaser') || undefined,
    target: getString(record, 'target') || undefined,
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
    loser: getRequiredString(record, 'loser'),
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
