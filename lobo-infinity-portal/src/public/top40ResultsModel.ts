import type { PublicEvent, PublicGame } from './snapshotTypes'

export type Top40ResultRow = {
  bracket: string
  game: PublicGame
  round: string
  sides: [Top40ResultSide, Top40ResultSide]
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
      sides: getTop40ResultSides(game),
      round: roundLabel(bracketRecord),
    }
  }).sort((left, right) => {
    const dateOrder = Date.parse(right.game.date) - Date.parse(left.game.date)
    return Number.isNaN(dateOrder) || dateOrder === 0 ? right.game.id - left.game.id : dateOrder
  })
}

export function getTop40ResultsSummary(event: PublicEvent, rows: Top40ResultRow[]) {
  const bracket = event.bracket ?? []
  const losses = new Map<string, number>()
  let completedMatches = 0
  let activeMatches = 0

  for (const record of bracket) {
    const status = text(record, 'status').toLowerCase()
    if (status === 'active') activeMatches += 1
    if (status === 'completed') {
      completedMatches += 1
      const loser = text(record, 'loser').toLocaleLowerCase()
      if (loser && loser !== 'bye') losses.set(loser, (losses.get(loser) || 0) + 1)
    }
  }

  return {
    activeMatches,
    eliminated: [...losses.values()].filter((count) => count >= 2).length,
    matchesComplete: Math.max(completedMatches, rows.length),
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

export type Top40ResultSide = {
  player: string
  name: string
  faction: string
  result: 'Winner' | 'Defeated' | 'Draw' | 'Result unavailable'
  tp: string
  op: string
  vp: string
}

// Public score pairs are winner–loser, independently of who submitted the game.
// Draws retain player1–player2 order. Never infer a winner from a score magnitude.
export function getTop40ResultSides(game: PublicGame): [Top40ResultSide, Top40ResultSide] {
  const normalize = (value: string) => String(value || '').trim().toLocaleLowerCase()
  const draw = normalize(game.winner) === 'draw'
  const players = [
    { player: game.player1, name: game.player1DisplayName || game.player1, faction: game.player1Faction },
    { player: game.player2, name: game.player2DisplayName || game.player2, faction: game.player2Faction },
  ]
  const winnerIndex = players.findIndex(side => normalize(side.player) === normalize(game.winner) && Boolean(side.player))
  const pair = (value: string) => {
    const parts = String(value || '').trim().split(/\s*[–—-]\s*/)
    return parts.length === 2 && parts.every(part => /^\d+$/.test(part)) ? parts : null
  }
  const tp = pair(game.tp), op = pair(game.op), vp = pair(game.vp)
  const sides = players.map((side, index): Top40ResultSide => {
    const winner = index === winnerIndex
    const scoreIndex = draw ? index : winnerIndex < 0 ? -1 : winner ? 0 : 1
    return { ...side, result: draw ? 'Draw' : winnerIndex < 0 ? 'Result unavailable' : winner ? 'Winner' : 'Defeated',
      tp: tp?.[scoreIndex] ?? '—', op: op?.[scoreIndex] ?? '—', vp: vp?.[scoreIndex] ?? '—' }
  })
  return !draw && winnerIndex === 1 ? [sides[1], sides[0]] : [sides[0], sides[1]]
}
