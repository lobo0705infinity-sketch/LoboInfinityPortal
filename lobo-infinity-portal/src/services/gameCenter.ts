import type { GameCenterGame } from './api'

export type GameCenterSortKey =
  | 'id'
  | 'date'
  | 'event'
  | 'gameTypeLabel'
  | 'mission'
  | 'player1DisplayName'
  | 'player2DisplayName'
  | 'result'
  | 'player1Faction'
  | 'player2Faction'
  | 'team'
  | 'tp'
  | 'op'
  | 'vp'

export type GameCenterSortDirection = 'asc' | 'desc'

export type GameCenterSortState = {
  key: GameCenterSortKey
  direction: GameCenterSortDirection
}

export type GameCenterFilters = {
  event: string
  player: string
  faction: string
  gameType: string
  mission: string
  team: string
  search: string
}

export type GameCenterFilterKey = keyof GameCenterFilters

export type GameCenterColumn = {
  key: GameCenterSortKey
  label: string
  numeric?: boolean
}

export const gameCenterColumns: GameCenterColumn[] = [
  { key: 'id', label: 'Game ID', numeric: true },
  { key: 'date', label: 'Date' },
  { key: 'event', label: 'Event' },
  { key: 'gameTypeLabel', label: 'Game Type' },
  { key: 'mission', label: 'Mission' },
  { key: 'player1DisplayName', label: 'Player 1' },
  { key: 'player2DisplayName', label: 'Player 2' },
  { key: 'result', label: 'Winner / Draw' },
  { key: 'player1Faction', label: 'Player 1 Faction' },
  { key: 'player2Faction', label: 'Player 2 Faction' },
  { key: 'team', label: 'Team' },
  { key: 'tp', label: 'TP' },
  { key: 'op', label: 'OP' },
  { key: 'vp', label: 'VP' },
]

export const defaultGameCenterFilters: GameCenterFilters = {
  event: '',
  player: '',
  faction: '',
  gameType: '',
  mission: '',
  team: '',
  search: '',
}

export const defaultGameCenterSort: GameCenterSortState = {
  key: 'date',
  direction: 'desc',
}

export function buildGameCenterFilterOptions(games: GameCenterGame[]) {
  return {
    events: uniqueSorted(games.map((game) => game.event)),
    players: uniqueSorted(
      games.flatMap((game) => [game.player1DisplayName, game.player2DisplayName]),
    ),
    factions: uniqueSorted(
      games.flatMap((game) => [game.player1Faction, game.player2Faction]),
    ),
    gameTypes: uniqueSorted(games.map((game) => game.gameTypeLabel)),
    missions: uniqueSorted(games.map((game) => game.mission)),
    teams: uniqueSorted(games.map((game) => game.team)),
  }
}

export function filterGameCenterGames(
  games: GameCenterGame[],
  filters: GameCenterFilters,
) {
  const search = normalizeSearch(filters.search)

  return games.filter((game) => {
    if (filters.event && game.event !== filters.event) return false
    if (filters.gameType && game.gameTypeLabel !== filters.gameType) return false
    if (filters.mission && game.mission !== filters.mission) return false
    if (filters.team && game.team !== filters.team) return false

    if (
      filters.player &&
      game.player1DisplayName !== filters.player &&
      game.player2DisplayName !== filters.player
    ) {
      return false
    }

    if (
      filters.faction &&
      game.player1Faction !== filters.faction &&
      game.player2Faction !== filters.faction
    ) {
      return false
    }

    return search === '' || getGameCenterSearchText(game).includes(search)
  })
}

export function sortGameCenterGames(
  games: GameCenterGame[],
  sort: GameCenterSortState,
) {
  const direction = sort.direction === 'asc' ? 1 : -1

  return games
    .map((game, index) => ({ game, index }))
    .sort((left, right) => {
      const order = compareGameCenterValues(
        getGameCenterSortValue(left.game, sort.key),
        getGameCenterSortValue(right.game, sort.key),
        sort.key,
      )

      return order === 0 ? left.index - right.index : order * direction
    })
    .map((item) => item.game)
}

export function applyGameCenterView(
  games: GameCenterGame[],
  filters: GameCenterFilters,
  sort: GameCenterSortState,
) {
  return sortGameCenterGames(filterGameCenterGames(games, filters), sort)
}

export function nextGameCenterSort(
  current: GameCenterSortState,
  key: GameCenterSortKey,
): GameCenterSortState {
  return {
    key,
    direction:
      current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }
}

function getGameCenterSearchText(game: GameCenterGame) {
  return normalizeSearch(
    [
      game.id,
      game.player1,
      game.player1DisplayName,
      game.player2,
      game.player2DisplayName,
      game.mission,
      game.player1Faction,
      game.player2Faction,
      game.team,
      game.event,
      game.gameTypeLabel,
    ].join(' '),
  )
}

function getGameCenterSortValue(
  game: GameCenterGame,
  key: GameCenterSortKey,
) {
  if (key === 'date') {
    return Date.parse(game.sortDate || game.date) || 0
  }

  if (key === 'id') {
    return game.id
  }

  return String(game[key] ?? '')
}

function compareGameCenterValues(
  left: string | number,
  right: string | number,
  key: GameCenterSortKey,
) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  if (key === 'tp' || key === 'op' || key === 'vp') {
    return compareScores(String(left), String(right))
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function compareScores(left: string, right: string) {
  const leftParts = parseScore(left)
  const rightParts = parseScore(right)

  if (leftParts.total !== rightParts.total) {
    return leftParts.total - rightParts.total
  }

  if (leftParts.player1 !== rightParts.player1) {
    return leftParts.player1 - rightParts.player1
  }

  return leftParts.player2 - rightParts.player2
}

function parseScore(score: string) {
  const [player1, player2] = score
    .split('-')
    .map((value) => Number(value.trim()))

  return {
    player1: Number.isFinite(player1) ? player1 : 0,
    player2: Number.isFinite(player2) ? player2 : 0,
    total:
      (Number.isFinite(player1) ? player1 : 0) +
      (Number.isFinite(player2) ? player2 : 0),
  }
}

function uniqueSorted(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) =>
    left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  )
}

function normalizeSearch(value: string | number) {
  return String(value).trim().toLowerCase()
}
