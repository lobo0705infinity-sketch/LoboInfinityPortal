import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fail, pass, repoRoot } from './release-utils.mjs'
import type { GameCenterGame } from '../src/services/api.ts'
import {
  applyGameCenterView,
  defaultGameCenterFilters,
  defaultGameCenterSort,
  filterGameCenterGames,
  gameCenterColumns,
  sortGameCenterGames,
  type GameCenterFilters,
} from '../src/services/gameCenter.ts'

const games: GameCenterGame[] = [
  game({
    id: 913,
    date: '2026-08-15',
    event: 'August Team Tournament',
    gameType: 'tournament',
    gameTypeLabel: 'Team Tournament',
    mission: 'Firefight',
    player1DisplayName: 'Cipher',
    player2DisplayName: 'Delta',
    result: 'Draw',
    player1Faction: 'Combined Army',
    player2Faction: 'Haqqislam',
    team: 'Wolves / Falcons',
    tp: '3-3',
    op: '6-6',
    vp: '112-112',
  }),
  game({
    id: 725,
    date: '2026-01-09',
    event: 'Casual',
    gameType: 'casual',
    gameTypeLabel: 'Casual',
    mission: 'Decapitation',
    player1DisplayName: 'Echo',
    player2DisplayName: 'Flux',
    result: 'Flux',
    player1Faction: 'Morat Aggression Force',
    player2Faction: 'PanOceania',
    team: '',
    tp: '0-5',
    op: '2-9',
    vp: '55-170',
  }),
  game({
    id: 448,
    date: '2026-07-12',
    event: 'July League',
    gameType: 'league',
    gameTypeLabel: 'League',
    mission: 'Supplies',
    player1DisplayName: 'Bowie',
    player2DisplayName: 'Atlas',
    result: 'Bowie',
    player1Faction: 'Bakunin',
    player2Faction: 'Kosmoflot',
    team: '',
    tp: '5-2',
    op: '7-4',
    vp: '120-80',
  }),
]

const expectedFirstByColumn: Record<
  (typeof gameCenterColumns)[number]['key'],
  { asc: number; desc: number }
> = {
  id: { asc: 448, desc: 913 },
  date: { asc: 725, desc: 913 },
  event: { asc: 913, desc: 448 },
  gameTypeLabel: { asc: 725, desc: 913 },
  mission: { asc: 725, desc: 448 },
  player1DisplayName: { asc: 448, desc: 725 },
  player2DisplayName: { asc: 448, desc: 725 },
  result: { asc: 448, desc: 725 },
  player1Faction: { asc: 448, desc: 725 },
  player2Faction: { asc: 913, desc: 725 },
  team: { asc: 725, desc: 913 },
  tp: { asc: 725, desc: 448 },
  op: { asc: 725, desc: 913 },
  vp: { asc: 448, desc: 725 },
}

const failures: string[] = []

assertEqual(
  applyGameCenterView(games, defaultGameCenterFilters, defaultGameCenterSort)[0]?.id,
  913,
  'Default Game Center sort should be newest first.',
)

for (const column of gameCenterColumns) {
  const ascending = sortGameCenterGames(games, {
    key: column.key,
    direction: 'asc',
  })
  const descending = sortGameCenterGames(games, {
    key: column.key,
    direction: 'desc',
  })

  assertEqual(
    ascending[0]?.id,
    expectedFirstByColumn[column.key].asc,
    `${column.label} ascending sort did not produce the expected first row.`,
  )
  assertEqual(
    descending[0]?.id,
    expectedFirstByColumn[column.key].desc,
    `${column.label} descending sort did not produce the expected first row.`,
  )
}

assertIds(
  withFilters({ player: 'Atlas' }),
  [448],
  'Player filter should include Player 2 matches.',
)

assertIds(
  withFilters({ player: 'Echo' }),
  [725],
  'Player filter should include Player 1 matches.',
)

assertIds(
  withFilters({ faction: 'PanOceania' }),
  [725],
  'Faction filter should include Player 2 factions.',
)

assertIds(
  withFilters({ faction: 'Bakunin' }),
  [448],
  'Faction filter should include Player 1 factions.',
)

assertIds(
  withFilters({ event: 'July League' }),
  [448],
  'Event filter should match the selected event.',
)

assertIds(
  withFilters({ gameType: 'League' }),
  [448],
  'Game Type filter should match League games.',
)

assertIds(
  withFilters({ mission: 'Firefight' }),
  [913],
  'Mission filter should match selected mission.',
)

assertIds(
  withFilters({ team: 'Wolves / Falcons' }),
  [913],
  'Team filter should match Team Tournament teams.',
)

assertIds(
  withFilters({ search: 'Flux' }),
  [725],
  'Search should match player and opponent names.',
)

assertIds(
  withFilters({ search: 'Supplies' }),
  [448],
  'Search should match missions.',
)

assertIds(
  withFilters({ search: 'Kosmoflot' }),
  [448],
  'Search should match factions.',
)

assertIds(
  withFilters({ search: 'Falcons' }),
  [913],
  'Search should match teams.',
)

assertIds(
  withFilters({ search: '725' }),
  [725],
  'Search should match Game ID.',
)

assertEqual(
  new Set(games.map((item) => item.gameTypeLabel)).size,
  3,
  'League, Casual, and Team Tournament games should all be represented.',
)

assertEqual(
  games.filter((item) => item.gameTypeLabel === 'League').length,
  1,
  'League games should appear exactly once in the audited fixture.',
)

assertEqual(
  games.filter((item) => item.gameTypeLabel === 'Casual').length,
  1,
  'Casual games should appear exactly once in the audited fixture.',
)

assertEqual(
  games.filter((item) => item.gameTypeLabel === 'Team Tournament').length,
  1,
  'Team Tournament games should appear exactly once in the audited fixture.',
)

assertNoDuplicateGameIds(games, 'Game Center fixture should not contain duplicate Game IDs.')

assertDuplicateIds(
  games.concat(
    game({
      id: 913,
      date: '2026-08-15',
      event: 'August Team Tournament',
      gameType: 'tournament',
      gameTypeLabel: 'Team Tournament',
      mission: 'Firefight',
      player1DisplayName: 'Cipher',
      player2DisplayName: 'Delta',
      result: 'Draw',
      player1Faction: 'Combined Army',
      player2Faction: 'Haqqislam',
      team: 'Legacy Projection',
      tp: '3-3',
      op: '6-6',
      vp: '112-112',
    }),
  ),
  [913],
  'Duplicate audit should detect legacy projection rows by immutable Game ID.',
)

const api = read('backend/API.gs')
const backend = read('backend/RecentGames.gs')
const clientApi = read('src/services/api.ts')
const page = read('src/pages/CommissionerGameCenter.tsx')
const app = read('src/App.tsx')
const gameCenterBackendBlock = sliceFunctionRange(
  backend,
  'function getGameCenter(e)',
  'function filterRecentGamesByGameId',
)

assertMatches(
  api,
  /case "gameCenter":[\s\S]*?requireApiPermission\(e, "viewOperations"/,
  'gameCenter endpoint must be read-only and protected by viewOperations.',
)

assertMatches(
  backend,
  /function getGameCenter\(e\) \{[\s\S]*?getGameCenterCanonicalGames\(\)[\s\S]*?buildGameCenterGameResponse/,
  'Game Center backend must return a canonical game list through a dedicated reader.',
)

assertMatches(
  backend,
  /function getGameCenterCanonicalGames\(\) \{[\s\S]*?getAllRecentGameObjects\(\)[\s\S]*?buildRecentGame\(/,
  'Game Center backend must reuse canonical Game Engine helpers and the existing Game Analytics fallback.',
)

assertMatches(
  backend,
  /dedupeGameCenterCanonicalGames\([\s\S]*?getAllRecentGameObjects\(\)/,
  'Game Center must dedupe the canonical Recent Games stream before display.',
)

assertMatches(
  backend,
  /return dedupeGameCenterCanonicalGames\([\s\S]*?values[\s\S]*?\.map\(function\(row, index\)/,
  'Game Center must dedupe the Game Analytics fallback stream before display.',
)

assertMatches(
  backend,
  /function dedupeGameCenterCanonicalGames\(games\) \{[\s\S]*?getGameCenterCanonicalGameId\(game\)[\s\S]*?seen\[id\][\s\S]*?return false/,
  'Game Center must suppress duplicate canonical IDs before rendering rows.',
)

assertMatches(
  backend,
  /function getGameCenterCanonicalGameId\(game\) \{[\s\S]*?game &&[\s\S]*?game\.id[\s\S]*?Number\.isInteger\(id\)[\s\S]*?game &&[\s\S]*?game\.sourceIndex/,
  'Duplicate detection must use immutable game identity, not display names or timestamps.',
)

assertNotMatches(
  gameCenterBackendBlock,
  /getTeamTournamentResults|TEAM_TOURNAMENT_RESULTS|tournamentResults/,
  'Game Center must not query Team Tournament Results as a game source.',
)

assertMatches(
  gameCenterBackendBlock,
  /getTeamTournamentTeams/,
  'Game Center may query Team Tournament Teams only for team labels, not game rows.',
)

assertMatches(
  backend,
  /function buildGameCenterGameResponse\(game, context\) \{[\s\S]*?buildRecentGameResponse\(game\)/,
  'Game Center rows must reuse the existing recent-game response builder.',
)

assertMatches(
  clientApi,
  /export async function getGameCenter\([\s\S]*?request\('gameCenter', options\)[\s\S]*?normalizeGameCenterPayload/,
  'Frontend API client must expose getGameCenter().',
)

assertMatches(
  page,
  /apiClient[\s\S]{0,80}\.getGameCenter\(/,
  'Game Center page must load the read-only endpoint.',
)

assertMatches(
  page,
  /applyGameCenterView\(/,
  'Game Center page must apply the shared client-side filtering and sorting view.',
)

assertMatches(
  page,
  /navigate\(`\/games\/\$\{game\.id\}`\)/,
  'Game Center rows must open the existing Game Details route.',
)

assertMatches(
  app,
  /path="\/commissioner\/game-center"/,
  'Game Center route must be registered.',
)

if (failures.length) {
  fail('Game Center regression check failed', failures)
}

pass('Game Center regression check passed')

function game(overrides: Partial<GameCenterGame>): GameCenterGame {
  const id = overrides.id ?? 0
  const player1DisplayName = overrides.player1DisplayName ?? ''
  const player2DisplayName = overrides.player2DisplayName ?? ''

  return {
    id,
    date: overrides.date ?? '',
    sortDate: `${overrides.date ?? '1970-01-01'}T00:00:00.000Z`,
    eventId: overrides.eventId ?? '',
    event: overrides.event ?? '',
    gameType: overrides.gameType ?? 'league',
    gameTypeLabel: overrides.gameTypeLabel ?? 'League',
    mission: overrides.mission ?? '',
    player1: player1DisplayName,
    player1DisplayName,
    player2: player2DisplayName,
    player2DisplayName,
    winner: overrides.winner ?? '',
    winnerDisplayName: overrides.winnerDisplayName ?? '',
    result: overrides.result ?? '',
    player1Faction: overrides.player1Faction ?? '',
    player2Faction: overrides.player2Faction ?? '',
    team: overrides.team ?? '',
    tp: overrides.tp ?? '0-0',
    op: overrides.op ?? '0-0',
    vp: overrides.vp ?? '0-0',
  }
}

function withFilters(overrides: Partial<GameCenterFilters>) {
  return filterGameCenterGames(games, {
    ...defaultGameCenterFilters,
    ...overrides,
  })
}

function assertIds(actual: GameCenterGame[], expected: number[], message: string) {
  const actualIds = actual.map((item) => item.id)

  if (actualIds.join(',') !== expected.join(',')) {
    failures.push(`${message} Expected ${expected.join(',')}, got ${actualIds.join(',')}.`)
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    failures.push(`${message} Expected ${String(expected)}, got ${String(actual)}.`)
  }
}

function assertNoDuplicateGameIds(actual: GameCenterGame[], message: string) {
  const duplicateIds = getDuplicateGameIds(actual)

  if (duplicateIds.length > 0) {
    failures.push(`${message} Duplicate IDs: ${duplicateIds.join(', ')}.`)
  }
}

function assertDuplicateIds(
  actual: GameCenterGame[],
  expected: number[],
  message: string,
) {
  const duplicateIds = getDuplicateGameIds(actual)

  if (duplicateIds.join(',') !== expected.join(',')) {
    failures.push(`${message} Expected ${expected.join(',')}, got ${duplicateIds.join(',')}.`)
  }
}

function getDuplicateGameIds(actual: GameCenterGame[]) {
  const seen = new Set<number>()
  const duplicates = new Set<number>()

  for (const game of actual) {
    if (seen.has(game.id)) {
      duplicates.add(game.id)
    }
    seen.add(game.id)
  }

  return Array.from(duplicates).sort((left, right) => left - right)
}

function assertMatches(source: string, pattern: RegExp, message: string) {
  if (!pattern.test(source)) {
    failures.push(message)
  }
}

function assertNotMatches(source: string, pattern: RegExp, message: string) {
  if (pattern.test(source)) {
    failures.push(message)
  }
}

function read(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function sliceFunctionRange(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker)

  if (start === -1 || end === -1 || end <= start) {
    failures.push(`Could not slice source range from ${startMarker} to ${endMarker}.`)
    return ''
  }

  return source.slice(start, end)
}
