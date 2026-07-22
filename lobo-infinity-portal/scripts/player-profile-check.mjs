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
      /games:\s*communityPlayer\.games \|\| 0/.test(playersApi) &&
      /wins:\s*communityPlayer\.wins \|\| 0/.test(playersApi) &&
      /losses:\s*communityPlayer\.losses \|\| 0/.test(playersApi) &&
      /careerSummary:\s*buildPlayerCareerSummary\(/.test(playersApi),
  },
  {
    label: 'Zero-game profile has empty-state availability and recent games',
    pass:
      playersApi.includes('function buildEmptyPlayerAvailability') &&
      playerProfile.includes('No recorded games yet.') &&
      playerProfile.includes('value={player.availability.status}') &&
      playerProfile.includes('value={currentTournament}'),
  },
  {
    label: 'Public profile uses saved Preferred Army before game-derived Favorite Faction',
    pass:
      playersApi.includes('const savedPreferredArmy =') &&
      playersApi.includes('const gameDerivedFavoriteFaction =') &&
      playersApi.includes('const resolvedPreferredArmy =') &&
      /resolvedPreferredArmy\s*=\s*savedPreferredArmy\s*\|\|\s*gameDerivedFavoriteFaction/.test(playersApi) &&
      /favoriteFaction:\s*resolvedPreferredArmy/.test(playersApi) &&
      /preferredArmy:\s*resolvedPreferredArmy/.test(playersApi),
  },
  {
    label: 'Arg saved USAriadna-style override and blank fallback remain supported',
    pass:
      playersApi.includes('function getSavedPreferredArmyForPlayer') &&
      playersApi.includes('gameDerivedFavoriteFaction:') &&
      /favoriteArmy\s*=\s*record\.favoriteFaction\s*\|\|\s*gameDerivedFavoriteFaction/.test(playersApi),
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
