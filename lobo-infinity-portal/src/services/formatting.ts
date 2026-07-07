export const ScoreType = {
  TP: 'TP',
  OP: 'OP',
  VP: 'VP',
} as const

export type ScoreType = (typeof ScoreType)[keyof typeof ScoreType]

export type LeagueScoreGame = {
  division?: string
  loser?: string
  loserDisplayName?: string
  mission?: string
  op?: number | string
  tp?: number | string
  vp?: number | string
  winner?: string
  winnerDisplayName?: string
}

export type LeagueResult = {
  division: string
  loser: string
  mission: string
  op: string
  tp: string
  vp: string
  winner: string
}

export function formatObjectiveScore(game: LeagueScoreGame) {
  return formatScore(game, ScoreType.OP)
}

export function formatVictoryScore(game: LeagueScoreGame) {
  return formatScore(game, ScoreType.VP)
}

export function formatTournamentScore(game: LeagueScoreGame) {
  return formatScore(game, ScoreType.TP)
}

export function formatGameSummary(game: LeagueScoreGame) {
  const result = formatLeagueResult(game)

  return `${result.winner} defeated ${result.loser}\non ${result.mission}\n${result.op}`
}

export function formatLeagueResult(game: LeagueScoreGame): LeagueResult {
  return {
    division: formatText(game.division),
    loser: formatPlayerName(game.loser, game.loserDisplayName),
    mission: formatText(game.mission),
    op: formatObjectiveScore(game),
    tp: formatTournamentScore(game),
    vp: formatVictoryScore(game),
    winner: formatPlayerName(game.winner, game.winnerDisplayName),
  }
}

export function formatScore(game: LeagueScoreGame, scoreType: ScoreType) {
  return `${formatText(game[scoreType.toLowerCase() as 'op' | 'tp' | 'vp'])} ${scoreType}`
}

export function formatPercentage(value: number) {
  return `${formatNumber(value)}%`
}

export function formatRank(value: number) {
  return value > 0 ? `#${value}` : 'Unranked'
}

export function formatRecord(wins: number, losses: number) {
  return `${wins}-${losses}`
}

export function formatStreak(value: string | number) {
  return formatText(value)
}

export function formatDivision(value: string) {
  return formatText(value)
}

export function formatDate(value: string) {
  return formatText(value)
}

export function formatRelativeTime(value: string) {
  return formatText(value)
}

export function formatPlayerName(
  player: number | string | undefined,
  displayName?: number | string,
) {
  return formatText(displayName) || formatText(player)
}

function formatText(value: number | string | undefined) {
  return String(value ?? '').trim()
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
