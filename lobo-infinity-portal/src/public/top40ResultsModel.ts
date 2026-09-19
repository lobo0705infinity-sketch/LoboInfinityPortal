import type { PublicEvent, PublicGame } from './snapshotTypes'

export type Top40ResultRow = {
  bracket: string
  game: PublicGame
  round: string
}

type BracketRecord = Record<string, unknown>

function text(record: BracketRecord, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

function numeric(record: BracketRecord, key: string) {
  const value = Number(record[key])
  return Number.isFinite(value) ? value : 0
}

function bracketLabel(record: BracketRecord) {
  const bracket = text(record, 'bracket')
  return bracket === 'Grand Final' ? bracket : bracket ? `${bracket} Bracket` : 'Bracket unavailable'
}

function roundLabel(record: BracketRecord) {
  const bracket = text(record, 'bracket')
  const round = numeric(record, 'bracketRound')
  if (bracket === 'Grand Final') return 'Grand Final'
  return round ? `Round ${round}` : 'Round unavailable'
}

export function buildTop40ResultRows(event: PublicEvent, games: PublicGame[]): Top40ResultRow[] {
  const bracketByGameId = new Map<number, BracketRecord>()
  for (const record of event.bracket ?? []) {
    const gameId = numeric(record, 'gameId')
    if (gameId) bracketByGameId.set(gameId, record)
  }

  return games.map((game) => {
    const bracketRecord = bracketByGameId.get(game.id) ?? {}
    return {
      bracket: bracketLabel(bracketRecord),
      game,
      round: roundLabel(bracketRecord),
    }
  }).sort((left, right) => {
    const dateOrder = Date.parse(right.game.date) - Date.parse(left.game.date)
    return Number.isNaN(dateOrder) || dateOrder === 0 ? right.game.id - left.game.id : dateOrder
  })
}

export function getTop40ResultsSummary(event: PublicEvent, rows: Top40ResultRow[]) {
  const bracket = event.bracket ?? []
  const eliminated = new Set<string>()
  let activeMatches = 0

  for (const record of bracket) {
    const status = text(record, 'status').toLowerCase()
    const bracketName = text(record, 'bracket')
    if (status === 'active') activeMatches += 1
    if (status === 'completed' && (bracketName === 'Losers' || bracketName === 'Grand Final')) {
      const loser = text(record, 'loser')
      if (loser) eliminated.add(loser.toLocaleLowerCase())
    }
  }

  return {
    activeMatches,
    eliminated: eliminated.size,
    matchesComplete: rows.length,
    players: event.registeredCount || event.participants?.length || 0,
  }
}

export function filterTop40ResultRows(
  rows: Top40ResultRow[],
  bracket: string,
  round: string,
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return rows.filter((row) => {
    if (bracket && row.bracket !== bracket) return false
    if (round && row.round !== round) return false
    if (!normalizedQuery) return true
    const players = [
      row.game.player1DisplayName || row.game.player1,
      row.game.player2DisplayName || row.game.player2,
    ].join(' ').toLocaleLowerCase()
    return players.includes(normalizedQuery)
  })
}
