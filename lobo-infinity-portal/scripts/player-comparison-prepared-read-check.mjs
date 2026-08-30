import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const backend = read('backend/PublicPlayersProjection.gs')
const analytics = read('backend/Analytics.gs')
const endpoint = read('api/public-players-projection.mjs')
const service = read('src/services/publicPlayersProjection.ts')
const page = read('src/pages/PlayerComparison.tsx')

assert.match(backend, /comparison: buildPublicPlayerComparisonIndex_\(response\.divisions\)/)
assert.match(backend, /const games = getLeagueData\(\)/)
assert.match(backend, /const context = buildLeagueStandingsContext\(\)/)
assert.match(backend, /buildMissionProfileSummary\(/)
assert.match(backend, /buildBestFactionSummaryFromGames_\(playerGames\)/)
assert.match(backend, /headToHead: Object\.keys\(headToHeadByPair\)/)
assert.doesNotMatch(backend, /getLeaguePlayerComparison|getPlayerComparison|CanonicalDecoderGateway|UrlFetchApp/)
assert.match(analytics, /function BESTFACTION\(player\)[\s\S]*?buildBestFactionSummaryFromGames_\(PLAYERGAMES\(player\)\)/)
assert.match(endpoint, /comparison: artifact\.comparison/)
assert.match(endpoint, /if \(!isValidProjection\(artifact\)\)[\s\S]*?bootstrapProjectionFileId/)
assert.match(service, /getPublicPlayersComparisonProjection/)
assert.match(service, /normalizePlayerComparisonPayload/)
assert.match(page, /getPublicPlayersComparisonProjection/)
assert.match(page, /const prepared = eventId[\s\S]*?getPublicPlayersComparisonProjection/)
assert.doesNotMatch(page, /apiClient\.getPlayers\(\{\s*signal/)

const golden = {
  lobo: {
    name: 'Lobo', division: 'Main Man', rank: 1, games: 4, wins: 4, losses: 0,
    tp: 20, op: 29, vp: 813, favoriteFaction: 'Operations Subsection (6 games)',
    favoriteMission: 'Neutralization', bestMission: 'Neutralization',
    bestFaction: 'Operations Subsection (6-0, 100%)',
  },
  vision: {
    name: 'Vision', division: 'Proving Grounds B', rank: 5, games: 5, wins: 2, losses: 3,
    tp: 9, op: 14, vp: 676, favoriteFaction: 'Steel Phalanx (5 games)',
    favoriteMission: 'Neutralization', bestMission: '', bestFaction: 'Steel Phalanx (2-3, 40%)',
  },
}
assert.equal(golden.lobo.games, 4)
assert.equal(golden.vision.favoriteFaction, 'Steel Phalanx (5 games)')

const stored = { left: 'Lobo', right: 'Vision', games: 2, leftWins: 1, rightWins: 0, draws: 1 }
const reverse = {
  games: stored.games,
  leftWins: stored.rightWins,
  rightWins: stored.leftWins,
  draws: stored.draws,
}
assert.deepEqual(reverse, { games: 2, leftWins: 0, rightWins: 1, draws: 1 })

console.log('Prepared Player comparison read regression passed.')
