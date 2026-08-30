import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const backend = read('backend/PublicDetailProjection.gs')
const endpoint = read('api/public-detail-projection.mjs')
const service = read('src/services/publicDetailProjection.ts')
const pages = [
  'src/pages/Rivalries.tsx',
  'src/pages/PlayerProfile.tsx',
  'src/pages/FactionProfile.tsx',
  'src/pages/MissionProfile.tsx',
  'src/pages/GameDetails.tsx',
  'src/pages/StreamedGames.tsx',
].map(read).join('\n')

assert.match(backend, /getRecentGames\([\s\S]*eventId: "all"[\s\S]*gameType: "all"/)
assert.match(backend, /getStreams\(\)/)
assert.match(backend, /getPlayer\(/)
assert.match(backend, /buildPublicDetailFactionProfiles_/)
assert.match(backend, /buildPublicDetailMissionProfiles_/)
assert.match(backend, /players:8/)
assert.doesNotMatch(backend, /CanonicalDecoderGateway|decode\(|getCanonicalGameSubmittedArmyListObjects/)
assert.match(endpoint, /stale-while-revalidate=86400/)
assert.match(service, /\/api\/public-detail-projection\?section=/)
assert.match(pages, /publicDetailProjection/)
assert.doesNotMatch(pages, /\.getHome\(/)
assert.doesNotMatch(pages, /apiClient\s*\.getStreams\(/)
assert.doesNotMatch(pages, /apiClient\s*\.getFaction\(/)
assert.doesNotMatch(pages, /apiClient\s*\.getMission\(/)

console.log('Prepared public detail/community projection regression passed.')
