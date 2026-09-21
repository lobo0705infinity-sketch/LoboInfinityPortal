import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const backend = read('backend/PublicDetailProjection.gs')
const endpoint = read('api/public-detail-projection.mjs')
const service = read('src/services/publicDetailProjection.ts')
const gameDetails = read('src/pages/GameDetails.tsx')
const pages = [
  'src/pages/Rivalries.tsx',
  'src/pages/PlayerProfile.tsx',
  'src/pages/FactionProfile.tsx',
  'src/pages/MissionProfile.tsx',
  'src/pages/GameDetails.tsx',
  'src/pages/StreamedGames.tsx',
].map(read).join('\n')

assert.match(backend, /artifact\.rivalryGames = JSON\.parse\(getRecentGames/)
assert.match(backend, /artifact\.games = getAllRecentGameObjectsFromCanonicalResponses\(\)/)
assert.match(backend, /getStreams\(\)/)
assert.match(backend, /getPlayer\(/)
assert.match(backend, /buildPublicDetailFactionProfiles_/)
assert.match(backend, /buildPublicDetailMissionProfiles_/)
assert.match(backend, /players:8/)
assert.doesNotMatch(backend, /CanonicalDecoderGateway|decode\(|getCanonicalGameSubmittedArmyListObjects/)
assert.match(endpoint, /stale-while-revalidate=86400/)
assert.match(service, /getPublicSnapshotDataset<PublicSubmittedArmyList\[]>\('army-lists', signal\)/)
assert.match(service, /return \{[\s\S]*armyLists,[\s\S]*games,[\s\S]*rivalryGames: games/)
assert.match(pages, /publicDetailProjection/)
assert.doesNotMatch(pages, /\.getHome\(/)
assert.doesNotMatch(pages, /apiClient\s*\.getStreams\(/)
assert.doesNotMatch(pages, /apiClient\s*\.getFaction\(/)
assert.doesNotMatch(pages, /apiClient\s*\.getMission\(/)
assert.match(gameDetails, /getGameArmyLists\(game, data\.armyLists\)/)
assert.match(gameDetails, /list\.gameId === game\.id \|\| linkedIdSet\.has\(String\(list\.id\)\)/)
assert.match(gameDetails, /game\.winnerArmyListId, game\.loserArmyListId/)
assert.match(gameDetails, /<GameReview armyLists=\{armyLists\} game=\{game\} \/>/)
assert.match(gameDetails, /What the result says/)
assert.match(gameDetails, /Submitted turning point/)
assert.match(gameDetails, /Submitted forces/)
assert.match(gameDetails, /Generated from the official result, submitted lists, and player note\. It does not reconstruct unreported orders or table state\./)
assert.match(gameDetails, /\.split\(\/\[-–—\]\//)
assert.doesNotMatch(gameDetails, /at the death/i)

console.log('Snapshot-backed public detail/community and Game Review regression passed.')
