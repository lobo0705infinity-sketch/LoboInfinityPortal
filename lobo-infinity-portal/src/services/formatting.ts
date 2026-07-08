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

export function formatSchedulingDate(value: string) {
  const text = formatText(value)

  if (!text) {
    return ''
  }

  const inputDate = parseDateInput(text)
  const parsedDate = inputDate ?? parseRuntimeDate(text)

  if (!parsedDate) {
    return text
  }

  return parsedDate.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  })
}

export function formatSchedulingTime(value: string) {
  const text = formatText(value)

  if (!text) {
    return ''
  }

  const timeParts = parseTimeParts(text)

  if (!timeParts) {
    return text
  }

  const date = new Date(2000, 0, 1, timeParts.hours, timeParts.minutes)

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatSchedulingDateTime(dateValue: string, timeValue: string) {
  const date = formatSchedulingDate(dateValue)
  const time = formatSchedulingTime(timeValue)

  if (date && time) {
    return `${date} at ${time}`
  }

  return date || time || ''
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

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function parseRuntimeDate(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function parseTimeParts(value: string) {
  const timeMatch = /(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$)/.exec(value)

  if (timeMatch) {
    return {
      hours: Number(timeMatch[1]),
      minutes: Number(timeMatch[2]),
    }
  }

  const parsed = parseRuntimeDate(value)

  if (!parsed) {
    return null
  }

  return {
    hours: parsed.getHours(),
    minutes: parsed.getMinutes(),
  }
}
