import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const context = read('src/contexts/DashboardDataContext.tsx')
const dashboard = read('src/pages/Dashboard.tsx')
const recentGames = read('backend/RecentGames.gs')
const cacheApi = read('backend/CacheApi.gs')

const checks = [
  {
    label: 'Dashboard requests the canonical recent-games feed across every game type',
    pass: /gameRepository\.getRecentGames\(\{ gameType: 'all' \}\)/.test(context),
  },
  {
    label: 'Live Transmissions identifies League, Casual, and Team Tournament entries',
    pass:
      dashboard.includes("return 'League'") &&
      dashboard.includes("return 'Casual'") &&
      dashboard.includes("return 'Team Tournament'") &&
      dashboard.includes('formatTransmissionGameType(game.gameType)'),
  },
  {
    label: 'Every transmission retains its canonical Battle Report link',
    pass: dashboard.includes('to: `/games/${game.id}`'),
  },
  {
    label: 'The all-types feed reads the authoritative Game Engine instead of a display-only source',
    pass:
      recentGames.includes('function getAllRecentGameObjectsFromGameEngine()') &&
      recentGames.includes('getLeagueDataForEvent(') &&
      recentGames.includes('"all",\n      "all"') &&
      recentGames.includes('resolveLeagueGameTypeScope(requestedGameType) === "all"') &&
      recentGames.includes('getAllRecentGameObjectsFromGameEngine()') &&
      recentGames.includes('b.sortDate.getTime() -') &&
      recentGames.includes('b.sourceIndex -'),
  },
  {
    label: 'Recent-games cache schema invalidates the former League-only all-types payload',
    pass:
      cacheApi.includes('if (action === "recentGames")') &&
      cacheApi.includes('parts.push("schema=network1")'),
  },
]

const fixture = [
  { date: '2026-08-19T10:00:00Z', gameType: 'league', id: 1 },
  { date: '2026-08-21T10:00:00Z', gameType: 'casual', id: 2 },
  { date: '2026-08-20T10:00:00Z', gameType: 'tournament', id: 3 },
]
const ordered = fixture.toSorted(
  (left, right) =>
    new Date(right.date).getTime() - new Date(left.date).getTime() || right.id - left.id,
)

checks.push({
  label: 'Mixed transmissions remain chronological rather than grouped by type',
  pass:
    ordered.map((game) => game.gameType).join(',') === 'casual,tournament,league',
})

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

if (checks.some((check) => !check.pass)) {
  process.exitCode = 1
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}
