import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolvePlayerFactionIdentity } from '../src/services/playerFactionIdentity.ts'

type LivePlayer = {
  displayName?: string
  faction?: string
  favoriteArmy?: string
  favoriteFaction?: string
  gameDerivedFavoriteFaction?: string
  player: string
  preferredArmy?: string
}

type LiveProfile = {
  bestFaction?: string
  careerSummary?: {
    armies?: {
      favorite?: {
        label?: string
        parentFaction?: string
      }
    }
    quickStats?: {
      mostPlayedArmy?: string
      mostPlayedArmyParentFaction?: string
    }
  }
  favoriteFaction?: string
  name: string
}

const mode = process.argv[2] || 'players'
const apiUrl = readApiUrl()
const expected = new Map([
  ['Vision', { normalizedFaction: 'Steel Phalanx', portraitPath: '/faction-portraits/steel-phalanx.png' }],
  ['Brooke', { normalizedFaction: 'Next Wave', portraitPath: '/faction-portraits/next-wave.png' }],
  [
    'Arg',
    {
      normalizedFaction: 'USAriadna Ranger Force',
      portraitPath: '/faction-portraits/usariadna.png',
    },
  ],
  ['Diabloknk', { normalizedFaction: 'Next Wave', portraitPath: '/faction-portraits/next-wave.png' }],
  ['Jqam1', { normalizedFaction: 'Next Wave', portraitPath: '/faction-portraits/next-wave.png' }],
  ['Erichagz', { normalizedFaction: 'Next Wave', portraitPath: '/faction-portraits/next-wave.png' }],
  ['King Butt', { normalizedFaction: 'PanOceania', portraitPath: '/faction-portraits/panoceania.png' }],
  ['krazyglue04', { normalizedFaction: 'Next Wave', portraitPath: '/faction-portraits/next-wave.png' }],
  [
    'Rattlernxt',
    {
      normalizedFaction: 'Onyx Contact Force',
      portraitPath: '/faction-portraits/onyx-contact-force.png',
    },
  ],
])

assertResolverRules()
assertPlayersListPreferredArmyRules()

const players = await getPlayers()

const profiles =
  mode === 'players'
    ? new Map<string, LiveProfile>()
    : await getProfiles(players)

const results = players.map((player) => {
  const profile = profiles.get(player.player)
  const cardIdentity = resolvePlayerFactionIdentity(player)
  const profileIdentity = resolvePlayerFactionIdentity(profile || {})
  const badgeIdentity = profileIdentity

  return {
    badgeFactionKey: badgeIdentity.badgeFactionKey || '',
    cardNormalizedFaction: cardIdentity.normalizedFaction || '',
    cardPortraitPath: cardIdentity.portraitPath || '',
    player: player.player,
    preferredArmyDisplay: profileIdentity.normalizedFaction || '',
    preferredArmy: profile?.favoriteFaction || '',
    profileNormalizedFaction: profileIdentity.normalizedFaction || '',
    profilePortraitPath: profileIdentity.portraitPath || '',
  }
})

if (mode === 'players') {
  assertExpected('Players page', results.map((result) => ({
    normalizedFaction: result.cardNormalizedFaction,
    player: result.player,
    portraitPath: result.cardPortraitPath,
  })))
  console.log(`PASS players portrait preferences checked ${players.length} players`)
} else if (mode === 'public-profiles') {
  assertExpected('Public profile', results.map((result) => ({
    normalizedFaction: result.profileNormalizedFaction,
    player: result.player,
    portraitPath: result.profilePortraitPath,
  })))
  console.log(`PASS public profile portrait preferences checked ${players.length} players`)
} else if (mode === 'consistency') {
  const mismatches = results.filter(
    (result) =>
      result.cardNormalizedFaction !== result.profileNormalizedFaction ||
      result.cardNormalizedFaction !== result.badgeFactionKey ||
      result.cardNormalizedFaction !== result.preferredArmyDisplay,
  )

  if (mismatches.length > 0) {
    throw new Error(`Player/profile/badge/preferred-army faction identity mismatches: ${mismatches.length}`)
  }

  console.log(`PASS player portrait consistency checked ${players.length} players`)
} else if (mode === 'audit') {
  const mismatches = results.filter(
    (result) =>
      result.cardNormalizedFaction !== result.profileNormalizedFaction ||
      result.cardNormalizedFaction !== result.badgeFactionKey,
  )

  console.log(JSON.stringify({
    affected: results
      .filter((result) => expected.has(result.player))
      .map((result) => ({
        badgeFaction: result.badgeFactionKey,
        player: result.player,
        playersPage: result.cardNormalizedFaction,
        playersPagePortrait: result.cardPortraitPath,
        preferredArmy: result.preferredArmy,
        publicProfile: result.profileNormalizedFaction,
        publicProfilePortrait: result.profilePortraitPath,
      })),
    mismatches,
    mismatchCount: mismatches.length,
    noPortrait: results
      .filter((result) => !result.profilePortraitPath)
      .map((result) => result.player),
    players: players.length,
  }, null, 2))
} else {
  throw new Error(`Unknown player portrait check mode: ${mode}`)
}

async function getProfiles(players: LivePlayer[]) {
  const profiles = new Map<string, LiveProfile>()

  for (const player of players) {
    profiles.set(player.player, await getProfile(player.player))
  }

  return profiles
}

function assertExpected(
  label: string,
  actual: Array<{ normalizedFaction: string; player: string; portraitPath: string }>,
) {
  const failures = []

  for (const [player, expectedIdentity] of expected) {
    const actualIdentity = actual.find((result) => result.player === player)
    const actualFaction = actualIdentity?.normalizedFaction ?? ''
    const actualPortraitPath = actualIdentity?.portraitPath ?? ''

    if (
      actualFaction !== expectedIdentity.normalizedFaction ||
      actualPortraitPath !== expectedIdentity.portraitPath
    ) {
      failures.push(
        `${label}: ${player} resolved faction "${actualFaction || 'none'}" and portrait "${actualPortraitPath || 'none'}", expected faction "${expectedIdentity.normalizedFaction || 'none'}" and portrait "${expectedIdentity.portraitPath || 'none'}".`,
      )
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'))
  }
}

async function getPlayers() {
  const payload = await getJson('players')
  const divisions = Array.isArray(payload.divisions) ? payload.divisions : []

  return divisions.flatMap((division) =>
    Array.isArray(division.standings) ? division.standings : [],
  ) as LivePlayer[]
}

async function getProfile(player: string) {
  const payload = await getJson('player', { name: player })
  const profile = payload.player as LiveProfile | undefined

  if (!profile?.name) {
    throw new Error(`Missing player profile for ${player}.`)
  }

  return profile
}

async function getJson(action: string, params: Record<string, string> = {}) {
  const url = new URL(apiUrl)
  url.searchParams.set('action', action)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`${action} returned HTTP ${response.status}.`)
  }

  return await response.json() as Record<string, any>
}

function readApiUrl() {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  const match = env.match(/^VITE_API_URL=(.+)$/m)

  if (!match?.[1]) {
    throw new Error('VITE_API_URL is missing from .env.local.')
  }

  return match[1].trim()
}

function assertResolverRules() {
  const blankIdentity = resolvePlayerFactionIdentity({
    favoriteFaction: '',
    preferredArmy: 'Next Wave',
  })
  const brookeMetricIdentity = resolvePlayerFactionIdentity({
    favoriteFaction: 'Next Wave (2 games)',
  })
  const argIdentity = resolvePlayerFactionIdentity({
    favoriteFaction: 'Corregidor Jurisdictional Command',
  })
  const shockArmyIdentity = resolvePlayerFactionIdentity({
    favoriteFaction: 'Shock Army of Acontecimento (1 games)',
  })

  if (
    blankIdentity.normalizedFaction !== null ||
    blankIdentity.badgeFactionKey !== null ||
    blankIdentity.portraitPath !== null
  ) {
    throw new Error('Blank favoriteFaction must yield default badge and no portrait.')
  }

  if (
    brookeMetricIdentity.normalizedFaction !== 'Next Wave' ||
    brookeMetricIdentity.badgeFactionKey !== 'Next Wave' ||
    brookeMetricIdentity.portraitPath !== '/faction-portraits/next-wave.png'
  ) {
    throw new Error('Metric suffixes must be removed before resolving Brooke/Next Wave identity.')
  }

  if (
    argIdentity.normalizedFaction !== 'Corregidor Jurisdictional Command' ||
    argIdentity.badgeFactionKey !== 'Corregidor Jurisdictional Command' ||
    argIdentity.parentFaction !== 'Nomads' ||
    argIdentity.portraitPath !== '/faction-portraits/corregidor.png'
  ) {
    throw new Error('Sectorial preferred armies must not fall back to parent-faction portraits when mapped.')
  }

  if (
    shockArmyIdentity.normalizedFaction !== 'Shock Army of Acontecimento' ||
    shockArmyIdentity.badgeFactionKey !== 'Shock Army of Acontecimento' ||
    shockArmyIdentity.portraitPath !== '/faction-portraits/acontecimento.png'
  ) {
    throw new Error('Approved Shock Army portrait asset must not change the badge faction identity.')
  }
}

function assertPlayersListPreferredArmyRules() {
  const playersPage = readFileSync(resolve(process.cwd(), 'src/pages/Players.tsx'), 'utf8')
  const playersApi = readFileSync(resolve(process.cwd(), 'backend/PlayersApi.gs'), 'utf8')
  const cacheApi = readFileSync(resolve(process.cwd(), 'backend/CacheApi.gs'), 'utf8')
  const playersListPath = [
    extractFunction(playersApi, 'buildCommunityPlayerRegistryRows'),
    extractFunction(playersApi, 'applyCommunityGameStatistics'),
    extractFunction(playersApi, 'buildCommunityPreferredFactionMap'),
    extractFunction(playersApi, 'finalizeCommunityPlayerRecord'),
    extractFunction(playersApi, 'getCommunityGameDerivedPreferredArmy'),
  ].join('\n')

  if (playersPage.includes('applyCommunityPreferredArmies')) {
    throw new Error('Players page must not run per-player profile enrichment.')
  }

  if (/apiClient\.getPlayer\(/.test(playersPage)) {
    throw new Error('Players page must not call getPlayer() for every card.')
  }

  if (!playersApi.includes('function getCommunityGameDerivedPreferredArmy')) {
    throw new Error('Players list must use the shared game-derived preferred-army helper.')
  }

  if (!playersApi.includes('function buildCommunityPreferredFactionMap')) {
    throw new Error('Players list must build preferred-faction fallback from a shared map.')
  }

  if (/FAVORITEFACTION|PLAYERFACTIONS|PLAYERGAMES/.test(playersListPath)) {
    throw new Error('Players list path must not call per-player faction spreadsheet functions.')
  }

  if (!/MOSTCOMMON\(\s*valuesByPlayerKey\[playerKey\]\s*\)/.test(playersListPath)) {
    throw new Error('Players list fallback must preserve FAVORITEFACTION tie-breaking via MOSTCOMMON.')
  }

  if (
    !/preferredFactionByPlayerKey/.test(playersListPath) ||
    !/buildCommunityResolvedFavoriteArmyMaps/.test(playersListPath)
  ) {
    throw new Error('Players list finalization must consume the shared resolved favorite-army map.')
  }

  if (
    !/favoriteArmy\s*=\s*gameDerivedFavoriteFaction\s*\|\|\s*armyListDerivedFavoriteFaction\s*\|\|\s*""/.test(
      playersApi,
    ) ||
    /favoriteArmy\s*=\s*record\.favoriteFaction\s*\|\|\s*gameDerivedFavoriteFaction/.test(
      playersApi,
    )
  ) {
    throw new Error('Players list must derive Primary Faction from Game Engine first, then Army Lists.')
  }

  if (
    !/favoriteFaction:\s*favoriteArmy/.test(playersApi) ||
    !/preferredArmy:\s*favoriteArmy/.test(playersApi)
  ) {
    throw new Error('Players list must expose the resolved preferred army as favoriteFaction and preferredArmy.')
  }

  if (
    !cacheApi.includes('function sanitizePortalCacheContent') ||
    !/action !== "players"[\s\S]*delete parsed\.pipelineDiagnostics/.test(cacheApi) ||
    !cacheApi.includes('communityPlayerRegistrySchema=5.4')
  ) {
    throw new Error('Players cache must avoid persisting cold pipeline diagnostics and use the current players schema key.')
  }
}

function extractFunction(source: string, name: string) {
  const start = source.indexOf(`function ${name}`)

  if (start === -1) {
    return ''
  }

  const next = source.indexOf('\nfunction ', start + 1)

  return next === -1 ? source.slice(start) : source.slice(start, next)
}
