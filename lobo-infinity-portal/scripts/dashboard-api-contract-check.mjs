const requiredStandingFields = [
  'rank',
  'player',
  'games',
  'wins',
  'losses',
  'tp',
  'op',
  'vp',
  'faction',
  'favoriteArmy',
  'favoriteFaction',
  'preferredArmy',
]

import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertStandingContract(standing, path) {
  assert(standing && typeof standing === 'object', `${path} must be an object`)

  for (const field of requiredStandingFields) {
    assert(
      Object.prototype.hasOwnProperty.call(standing, field),
      `${path} is missing ${field}`,
    )
    assert(
      standing[field] !== null && standing[field] !== undefined,
      `${path}.${field} must not be null or undefined`,
    )
  }
}

const validDashboardPayload = {
  success: true,
  leader: {
    rank: 1,
    player: 'Lobo',
    games: 2,
    wins: 2,
    losses: 0,
    draws: 0,
    tp: 10,
    op: 15,
    vp: 301,
    faction: 'Steel Phalanx',
    favoriteArmy: 'Steel Phalanx',
    favoriteFaction: 'Steel Phalanx',
    preferredArmy: 'Steel Phalanx',
  },
  mainManStandings: [
    {
      rank: 1,
      player: 'Lobo',
      games: 2,
      wins: 2,
      losses: 0,
      draws: 0,
      tp: 10,
      op: 15,
      vp: 301,
      faction: 'Steel Phalanx',
      favoriteArmy: 'Steel Phalanx',
      favoriteFaction: 'Steel Phalanx',
      preferredArmy: 'Steel Phalanx',
    },
  ],
}

const invalidDashboardPayload = {
  success: true,
  leader: {
    rank: 1,
    player: 'Lobo',
    games: 2,
    wins: 2,
    losses: 0,
    tp: 10,
    op: 15,
  },
  mainManStandings: [
    {
      rank: 1,
      player: 'Lobo',
      games: 2,
      wins: 2,
      losses: 0,
      tp: 10,
      op: 15,
    },
  ],
}

function assertDashboardContract(payload) {
  assert(payload && typeof payload === 'object', 'Dashboard payload must be an object')
  assertStandingContract(payload.leader, 'leader')
  assert(
    Array.isArray(payload.mainManStandings),
    'mainManStandings must be an array',
  )
  payload.mainManStandings.forEach((standing, index) => {
    assertStandingContract(standing, `mainManStandings[${index}]`)
  })
}

assertDashboardContract(validDashboardPayload)

let failedAsExpected = false
try {
  assertDashboardContract(invalidDashboardPayload)
} catch (error) {
  failedAsExpected = /missing vp/.test(String(error.message))
}

assert(
  failedAsExpected,
  'Dashboard contract check must fail when VP is missing',
)

const dashboardSource = readFileSync('backend/Dashboard.gs', 'utf8')
const dashboardPageSource = readFileSync('src/pages/Dashboard.tsx', 'utf8')
const standingsSource = readFileSync('backend/StandingsApi.gs', 'utf8')
const playersSource = readFileSync('backend/PlayersApi.gs', 'utf8')
const cacheSource = readFileSync('backend/CacheApi.gs', 'utf8')
const resultSubmissionSource = readFileSync('backend/ResultSubmissionApi.gs', 'utf8')

assert(
  /buildStandingsResponse\(\s*getStandingsDivisionConfig\("main"\),\s*dashboardContext\s*\)/s.test(
    dashboardSource,
  ),
  'Dashboard leader must use the same event-scoped Main Man standings builder as the Standings API.',
)

assert(
  !/const standings\s*=\s*ss\.getSheetByName\(CONFIG\.SHEETS\.MAIN_MAN\)/.test(
    dashboardSource,
  ),
  'Dashboard must not read the legacy Main Man Standings sheet for Current Leader.',
)

assert(
  /const leader\s*=\s*mainManResponse\.summary\.leader/.test(dashboardSource) &&
    /const mainManStandings\s*=\s*mainManResponse\.standings/.test(dashboardSource),
  'Dashboard leader and mainManStandings must be populated from the shared standings response.',
)

assert(
  /favoriteArmy:\s*leader\.favoriteArmy \|\| leader\.faction \|\| ""/.test(dashboardSource) &&
    /favoriteFaction:\s*leader\.favoriteFaction \|\| leader\.favoriteArmy \|\| leader\.faction \|\| ""/.test(dashboardSource),
  'Dashboard leader must retain favorite-army fields from the shared standings response.',
)

assert(
  !dashboardPageSource.includes('Commander Overview') &&
    !dashboardPageSource.includes('dashboard-commander'),
  'Dashboard must not render the removed Commander Overview panel.',
)

assert(
  standingsSource.includes('buildCommunityResolvedFavoriteArmyMaps()') &&
    /faction:\s*favoriteArmy/.test(standingsSource) &&
    /favoriteArmy:\s*favoriteArmy/.test(standingsSource) &&
    /favoriteFaction:\s*favoriteArmy/.test(standingsSource) &&
    /preferredArmy:\s*favoriteArmy/.test(standingsSource),
  'Standings rows must preserve the shared resolved favorite army contract.',
)

assert(
  playersSource.includes('function buildCommunityResolvedFavoriteArmyMaps') &&
    playersSource.includes('function buildCommunityGameFavoriteArmyMap') &&
    playersSource.includes('function buildCommunityArmyListFavoriteArmyMap') &&
    /favoriteArmy\s*=\s*gameDerivedFavoriteFaction\s*\|\|\s*armyListDerivedFavoriteFaction\s*\|\|\s*""/.test(
      playersSource,
    ) &&
    !/favoriteArmy\s*=\s*record\.favoriteFaction\s*\|\|\s*gameDerivedFavoriteFaction/.test(
      playersSource,
    ),
  'Primary Faction must resolve from Game Engine first, then Army Lists, without manual player-sheet maintenance.',
)

assert(
  /const PORTAL_CACHE_PREFIX = "portal:v2\.0\.8:"/.test(cacheSource),
  'Dashboard cache schema must be bumped so stale legacy dashboard responses are not reused.',
)

assert(
  /invalidatePortalCacheGroup\("dashboard"\);[\s\S]*invalidatePortalCacheGroup\("standings"\);/.test(
    resultSubmissionSource,
  ),
  'League result submission must invalidate both Dashboard and standings caches.',
)

console.log('dashboard API contract checks passed')
