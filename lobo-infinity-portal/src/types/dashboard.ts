export type DivisionKey = 'main' | 'pga' | 'pgb'

export type DashboardSummary = {
  leagueLeader: string
  gamesPlayed: number
  activePlayers: number
  topFaction: string
}

export type Standing = {
  eventId?: string
  rank: number
  player: string
  displayName: string
  games: number
  wins: number
  losses: number
  tp: number
  op: number
  vp: number
}

export type DivisionSummary = {
  leader: Standing | null
  players: number
  gamesPlayed: number
  activePlayers: number
}

export type DivisionStandings = {
  division: DivisionKey
  divisionLabel: string
  event?: LeagueEvent | null
  eventId?: string
  standings: Standing[]
  summary: DivisionSummary
}

export type LeagueEvent = {
  achievements: string
  archive: string
  automation: string
  capabilities: string[]
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

export type EventCatalog = {
  currentEvent: LeagueEvent
  events: LeagueEvent[]
}

export type LeagueOverviewDivision = {
  division: DivisionKey
  divisionLabel: string
  players: number
  gamesPlayed: number
  activePlayers: number
}

export type LeagueOverview = {
  divisions: LeagueOverviewDivision[]
  totalLeagueGames: number
  totalActivePlayers: number
}

export type DashboardData = {
  summary: DashboardSummary
  standings: Standing[]
  leagueOverview: LeagueOverview
}

export type MainManStanding = Standing
