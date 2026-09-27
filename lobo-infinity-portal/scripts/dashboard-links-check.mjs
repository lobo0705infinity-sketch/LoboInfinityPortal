import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const recentGamesApi = read('backend/RecentGames.gs')
const factionApi = read('backend/FactionApi.gs')
const dashboard = read('src/pages/Dashboard.tsx')
const publicDashboard = read('src/public/SnapshotPublicApp.tsx')
const publicArmyIntelligence = read('src/public/SnapshotArmyIntelligence.tsx')
const gameDetails = read('src/pages/GameDetails.tsx')
const recentGames = read('src/components/RecentGames.tsx')
const playerProfile = read('src/pages/PlayerProfile.tsx')

const checks = [
  {
    label: 'Recent game responses use immutable source game id',
    pass:
      recentGamesApi.includes('function buildRecentGameResponse(game)') &&
      recentGamesApi.includes('id: game.id') &&
      recentGamesApi.includes('id: sourceIndex'),
  },
  {
    label: 'Recent games endpoint does not rewrite ids from sorted list index',
    pass:
      !recentGamesApi.includes('buildRecentGameResponse(game, index + 1)') &&
      !recentGamesApi.includes('buildRecentGameResponse(game, id)') &&
      !recentGamesApi.includes('id: id,'),
  },
  {
    label: 'Shared all-games helper does not rewrite ids from sorted list index',
    pass: !factionApi.includes('buildRecentGameResponse(game, index + 1)'),
  },
  {
    label: 'Live transmissions link with the same RecentGame.id used for headline text',
    pass:
      dashboard.includes('games.slice(0, 4).map((game)') &&
      dashboard.includes('title: getGameHeadline(game)') &&
      dashboard.includes('to: `/games/${game.id}`'),
  },
  {
    label: 'Featured battle report links to the same public report as search content',
    pass:
      publicDashboard.includes('to="/games/109"') &&
      publicArmyIntelligence.includes('to="/games/109"') &&
      publicDashboard.includes("buildArmyIntelligenceFactionPath('Corregidor Jurisdictional Command')") &&
      publicArmyIntelligence.includes('const selected = readArmyIntelligenceFactionParam(params)') &&
      read('shared/public-search-content.mjs').includes("href: '/games/109'"),
  },
  {
    label: 'Battle report resolves by immutable RecentGame.id',
    pass:
      gameDetails.includes('gameId,') &&
      gameDetails.includes('games.find((candidate) => candidate.id === gameId)'),
  },
  {
    label: 'Battle report endpoint can fetch a specific immutable game id',
    pass:
      recentGamesApi.includes('function filterRecentGamesByGameId(games, gameId)') &&
      recentGamesApi.includes('getAllRecentGameObjects()') &&
      recentGamesApi.includes('game.id === target') &&
      recentGamesApi.includes('e.parameter.gameId'),
  },
  {
    label: 'Recent Games component links by immutable RecentGame.id',
    pass: recentGames.includes('to={`/games/${game.id}`}'),
  },
  {
    label: 'Player history links by immutable RecentGame.id',
    pass: playerProfile.includes('to={`/games/${game.id}`}'),
  },
]

const sampleGames = [
  { id: 1, sourceIndex: 1, sortDate: new Date('2026-07-01'), winner: 'Old', loser: 'Game' },
  { id: 2, sourceIndex: 2, sortDate: new Date('2026-07-10'), winner: 'New', loser: 'Game' },
  { id: 3, sourceIndex: 3, sortDate: new Date('2026-07-05'), winner: 'Middle', loser: 'Game' },
]

const sorted = sampleGames
  .toSorted((a, b) => b.sortDate.getTime() - a.sortDate.getTime() || b.sourceIndex - a.sourceIndex)
  .map((game) => ({ id: game.id, headline: `${game.winner} defeated ${game.loser}`, href: `/games/${game.id}` }))

checks.push({
  label: 'Deterministic dashboard links preserve source ids after sorting',
  pass:
    sorted[0].id === 2 &&
    sorted[0].href === '/games/2' &&
    sorted[1].id === 3 &&
    sorted[2].id === 1,
})

const failures = checks.filter((check) => !check.pass)

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

if (failures.length > 0) {
  process.exitCode = 1
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}
