export type DivisionKey = 'main' | 'pga' | 'pgb'

export type DashboardSummary = {
  leagueLeader: string
  gamesPlayed: number
  activePlayers: number
  topFaction: string
}

export type Standing = {
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
  standings: Standing[]
  summary: DivisionSummary
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
