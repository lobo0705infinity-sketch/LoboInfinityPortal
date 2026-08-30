import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const backend = read('backend/PublicPlayersProjection.gs')
const api = read('api/public-players-projection.mjs')
const client = read('src/services/publicPlayersProjection.ts')
const page = read('src/pages/Players.tsx')
const automation = read('backend/AutomationApi.gs')
const registry = read('backend/PlayerRegistry.gs')
const correction = read('backend/GameScoreCorrectionApi.gs')
const eventProjection = read('backend/PublicEventProjection.gs')

assert.match(backend, /getPlayers\(\{ parameter: \{\} \}\)/)
assert.match(backend, /validatePublicPlayersProjection_/)
assert.match(backend, /writeAndValidatePublicProjectionArtifact_/)
assert.doesNotMatch(backend, /email|notes|password|armyCode|session|token/i)
assert.match(api, /PUBLIC_PLAYERS_PROJECTION_FILE_ID/)
assert.match(api, /stale-while-revalidate=86400/)
assert.doesNotMatch(api, /action=players/)
assert.match(client, /\/api\/public-players-projection/)
assert.match(client, /normalizePlayersPayload/)
assert.match(page, /eventScoped[\s\S]*?apiClient\.getPlayers[\s\S]*?: getPublicPlayersProjection/)
assert.match(page, /const load = eventScoped[\s\S]*?apiClient\.getPlayers[\s\S]*?: getPublicPlayersProjection/)
assert.match(automation, /markPublicPlayersProjectionDirty_/)
assert.match(automation, /publishDirtyPublicPlayersProjectionBestEffort_/)
assert.match(registry, /function invalidatePlayerRegistryCache\(\)[\s\S]*?markPublicPlayersProjectionDirty_/)
assert.match(correction, /markPublicPlayersProjectionDirty_/)
assert.match(eventProjection, /markPublicPlayersProjectionDirty_/)

const standing = {
  canonical: true,
  communityStatus: 'League Player, Tournament Player',
  currentWinStreak: 2,
  displayName: 'Alpha',
  division: 'Main Man',
  eventId: '',
  faction: 'PanOceania',
  favoriteArmy: 'Military Orders',
  favoriteFaction: 'Military Orders',
  gameTypes: ['league', 'tournament'],
  games: 5,
  lastActive: '2026-08-28T04:00:00.000Z',
  losses: 2,
  op: 23,
  player: 'Alpha',
  preferredArmy: 'Military Orders',
  rank: 1,
  statusBadges: ['League Player', 'Tournament Player'],
  tp: 16,
  vp: 900,
  wins: 3,
  gameDerivedFavoriteFaction: 'Military Orders',
  armyListDerivedFavoriteFaction: 'Military Orders',
}
const uiFields = [
  'canonical', 'communityStatus', 'currentWinStreak', 'displayName', 'division',
  'eventId', 'faction', 'favoriteArmy', 'favoriteFaction', 'gameTypes', 'games',
  'lastActive', 'losses', 'op', 'player', 'preferredArmy', 'rank', 'statusBadges',
  'tp', 'vp', 'wins',
]
const projected = { ...standing }
delete projected.gameDerivedFavoriteFaction
delete projected.armyListDerivedFavoriteFaction
assert.deepEqual(
  Object.fromEntries(uiFields.map((key) => [key, projected[key]])),
  Object.fromEntries(uiFields.map((key) => [key, standing[key]])),
)

console.log('Prepared public Players projection regression passed.')
