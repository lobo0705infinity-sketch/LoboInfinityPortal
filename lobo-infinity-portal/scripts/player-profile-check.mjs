import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const playersApi = read('backend/PlayersApi.gs')
const playerProfile = read('src/pages/PlayerProfile.tsx')

const checks = [
  {
    label: 'Player profile falls back to Community Player Registry',
    pass:
      playersApi.includes('function getCommunityPlayerProfile') &&
      playersApi.includes('findCommunityPlayerProfileRecord') &&
      playersApi.includes('buildCommunityPlayerRegistryRows()'),
  },
  {
    label: 'Unknown players still return Player not found',
    pass:
      playersApi.includes('if (!communityPlayer)') &&
      playersApi.includes('error: "Player not found."'),
  },
  {
    label: 'Zero-game community profile returns normal zero statistics',
    pass:
      playersApi.includes('games:\n        communityPlayer.games || 0') &&
      playersApi.includes('wins:\n        communityPlayer.wins || 0') &&
      playersApi.includes('losses:\n        communityPlayer.losses || 0') &&
      playersApi.includes('careerSummary:\n        buildPlayerCareerSummary('),
  },
  {
    label: 'Zero-game profile has empty-state availability and recent games',
    pass:
      playersApi.includes('function buildEmptyPlayerAvailability') &&
      playerProfile.includes('No recorded games yet.') &&
      playerProfile.includes('Achievements coming soon.'),
  },
]

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
