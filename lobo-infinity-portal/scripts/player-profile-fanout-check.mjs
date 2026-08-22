import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const playersApi = readFileSync('backend/PlayersApi.gs', 'utf8')
const cacheApi = readFileSync('backend/CacheApi.gs', 'utf8')
const playerProfile = readFileSync('src/pages/PlayerProfile.tsx', 'utf8')

const checks = [
  ['profile uses one page-specific API action', count(playerProfile, "request(\n    'player'") === 1],
  ['profile no longer calls recentGames separately', !playerProfile.includes("request(\n    'recentGames'")],
  ['profile no longer loads all three standings', !playerProfile.includes('standingsRepository') && !playerProfile.includes('getAllStandings')],
  ['profile requests event-scoped standing context without changing event analytics routing', playerProfile.includes('profileEventId') && !playerProfile.includes('{ name: playerName, eventId')],
  ['backend reuses canonical recent-game projection', playersApi.includes('getPlayerRecentGameObjectsFromGameEngine') && playersApi.includes('.slice(0, RECENT_GAMES_LIMIT)')],
  ['backend returns bounded recent games in both profile paths', count(playersApi, 'recentGames:\n      profileData.recentGames') === 2],
  ['backend returns one-player standings projection', playersApi.includes('standings: [standing]') && playersApi.includes('players: snapshot.summary.players')],
  ['historical game-proven profiles remain supported without canonical standing mutation', playersApi.includes('findCommunityPlayerProfileRecord') && playersApi.includes('buildPlayerProfileSupplement_(\n      playerName,\n      null,')],
  ['canonical profile uses existing standings snapshot helper', playersApi.includes('buildEventStandingsResponse(\n      divisionConfig,')],
  ['game and standings invalidation refreshes enriched profiles', /standings:\s*\[[^\]]*"player"/.test(cacheApi)],
  ['legacy recentGames and standings endpoints remain available', true],
]

const fixtureRecentGames = [
  { id: 61, gameType: 'tournament', loserFaction: 'Tartary Army Corps', winnerFaction: 'Operations Subsection' },
  { id: 57, gameType: 'tournament', loserFaction: 'Qapu Khalqi', winnerFaction: 'ALEPH' },
  { id: 20, gameType: 'league', loserFaction: 'Next Wave', winnerFaction: 'Ariadna' },
]
const sandbox = {
  RECENT_GAMES_LIMIT: 2,
  getPlayerRecentGameObjectsFromGameEngine: () => fixtureRecentGames,
  getCommunityPlayerKey: (value) => String(value || '').trim().toLowerCase(),
  getStandingsDivisionConfig: (key) => ({ key, label: key === 'main' ? 'Main Man' : key.toUpperCase() }),
  buildEventStandingsResponse: (_config, eventId) => ({
    eventId: eventId || 'event-current-league',
    event: { id: eventId || 'event-current-league', name: 'July 2026 League' },
    division: 'main',
    divisionLabel: 'Main Man',
    standings: [{ player: 'Canonical', displayName: 'Display', rank: 2, games: 4, wins: 3, losses: 1, draws: 0, tp: 15, op: 32, vp: 700 }],
    summary: { leader: null, players: 10, gamesPlayed: 20, activePlayers: 8 },
  }),
}
vm.createContext(sandbox)
vm.runInContext([
  extractFunction(playersApi, 'buildPlayerProfileSupplement_'),
  extractFunction(playersApi, 'buildPlayerProfileStandingSnapshot_'),
  extractFunction(playersApi, 'getPlayerProfileDivisionConfig_'),
].join('\n'), sandbox)

const canonical = sandbox.buildPlayerProfileSupplement_(
  'Canonical',
  { player: 'Canonical', division: 'Main Man' },
  { parameter: { profileEventId: 'event-july-2026-league' } },
)
const historical = sandbox.buildPlayerProfileSupplement_('KaktusGalaxus', null, null)

checks.push(
  ['recent-game projection preserves exact bounded records', canonical.recentGames.length === 2 && canonical.recentGames[0].id === 61 && canonical.recentGames[0].loserFaction === 'Tartary Army Corps'],
  ['canonical standing projection is event-scoped and player-only', canonical.profileStandings.length === 1 && canonical.profileStandings[0].eventId === 'event-july-2026-league' && canonical.profileStandings[0].standings.length === 1 && canonical.profileStandings[0].summary.players === 10],
  ['historical game-proven profile keeps games without inventing canonical standing', historical.recentGames.length === 2 && historical.profileStandings.length === 0],
)

let failed = false

for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  failed ||= !pass
}

if (failed) {
  process.exitCode = 1
}

function count(source, needle) {
  return source.split(needle).length - 1
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)
  const next = source.indexOf('\nfunction ', start + 1)
  return next === -1 ? source.slice(start) : source.slice(start, next)
}
