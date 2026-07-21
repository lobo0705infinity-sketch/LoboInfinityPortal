import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolvePlayerFactionIdentity } from '../src/services/playerFactionIdentity.ts'

type LivePlayer = {
  displayName?: string
  faction?: string
  favoriteArmy?: string
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
  ['Diabloknk', { normalizedFaction: 'Next Wave', portraitPath: '/faction-portraits/next-wave.png' }],
  ['Jqam1', { normalizedFaction: 'Next Wave', portraitPath: '/faction-portraits/next-wave.png' }],
  ['Erichagz', { normalizedFaction: 'Next Wave', portraitPath: '/faction-portraits/next-wave.png' }],
  ['King Butt', { normalizedFaction: 'PanOceania', portraitPath: '/faction-portraits/panoceania.png' }],
  ['krazyglue04', { normalizedFaction: '', portraitPath: '' }],
  [
    'Rattlernxt',
    {
      normalizedFaction: 'Shock Army of Acontecimento',
      portraitPath: '/faction-portraits/acontecimento.png',
    },
  ],
])

assertResolverRules()

const players = await getPlayers()
const profiles = new Map<string, LiveProfile>()

for (const player of players) {
  profiles.set(player.player, await getProfile(player.player))
}

const results = players.map((player) => {
  const profile = profiles.get(player.player)
  const cardIdentity = resolvePlayerFactionIdentity({
    favoriteFaction: profile?.favoriteFaction || '',
  })
  const profileIdentity = resolvePlayerFactionIdentity(profile || {})
  const badgeIdentity = profileIdentity

  return {
    badgeFactionKey: badgeIdentity.badgeFactionKey || '',
    cardNormalizedFaction: cardIdentity.normalizedFaction || '',
    cardPortraitPath: cardIdentity.portraitPath || '',
    player: player.player,
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
      result.cardNormalizedFaction !== result.badgeFactionKey,
  )

  if (mismatches.length > 0) {
    throw new Error(`Player/profile/badge faction identity mismatches: ${mismatches.length}`)
  }

  console.log(`PASS player portrait consistency checked ${players.length} players`)
} else if (mode === 'audit') {
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
    mismatchCount: results.filter(
      (result) =>
        result.cardNormalizedFaction !== result.profileNormalizedFaction ||
        result.cardNormalizedFaction !== result.badgeFactionKey,
    ).length,
    noPortrait: results
      .filter((result) => !result.profilePortraitPath)
      .map((result) => result.player),
    players: players.length,
  }, null, 2))
} else {
  throw new Error(`Unknown player portrait check mode: ${mode}`)
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
    shockArmyIdentity.normalizedFaction !== 'Shock Army of Acontecimento' ||
    shockArmyIdentity.badgeFactionKey !== 'Shock Army of Acontecimento' ||
    shockArmyIdentity.portraitPath !== '/faction-portraits/acontecimento.png'
  ) {
    throw new Error('Approved Shock Army portrait asset must not change the badge faction identity.')
  }
}
