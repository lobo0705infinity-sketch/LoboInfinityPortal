import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const leagueData = read('backend/LeagueData.gs')
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
    label: 'Zero-game profile retains its recent-games empty state without Operations Profile',
    pass:
      playersApi.includes('function buildEmptyPlayerAvailability') &&
      playerProfile.includes('No recorded games yet.') &&
      !playerProfile.includes('Notes & Media') &&
      !playerProfile.includes('Operations Profile') &&
      !playerProfile.includes('profile-v21-notes') &&
      !playerProfile.includes('<NotesMediaPanel'),
  },
  {
    label: 'Public profile does not render availability, Discord, or tournament fields in a notes panel',
    pass:
      !playerProfile.includes('label="Availability"') &&
      !playerProfile.includes('label="Preferred Days"') &&
      !playerProfile.includes('label="Preferred Time"') &&
      !playerProfile.includes('label="Discord"') &&
      !playerProfile.includes('label="Current Tournament"'),
  },
  {
    label: 'Player profile keeps hero, career, achievements, recent games, and Army Lists',
    pass:
      playerProfile.includes('<PlayerProfileDossier') &&
      playerProfile.includes('<PerformanceOverview') &&
      playerProfile.includes('<AchievementPreview') &&
      playerProfile.includes('<RecentGamesPanel') &&
      playerProfile.includes('<ArmyListsPanel'),
  },
  {
    label: 'Public profile exposes the shared automatic Primary Faction',
    pass:
      playersApi.includes('const gameDerivedFavoriteFaction =') &&
      playersApi.includes('const armyListDerivedFavoriteFaction =') &&
      playersApi.includes('const resolvedPreferredArmy =') &&
      /resolvedPreferredArmy\s*=\s*communityPlayer\.favoriteFaction\s*\|\|\s*communityPlayer\.favoriteArmy\s*\|\|\s*""/.test(playersApi) &&
      /favoriteFaction:\s*resolvedPreferredArmy/.test(playersApi) &&
      /preferredArmy:\s*resolvedPreferredArmy/.test(playersApi),
  },
  {
    label: 'Public profile renders play-history faction through PrimaryFactionCard',
    pass:
      playerProfile.includes("import PrimaryFactionCard from '../components/PrimaryFactionCard'") &&
      playerProfile.includes('<PrimaryFactionCard faction={player.favoriteFaction || player.armyListSummary.favoriteFaction} />') &&
      !playerProfile.includes('label="Favorite Faction"'),
  },
  {
    label: 'Primary Faction derives from Game Engine first and Army Lists second',
    pass:
      playersApi.includes('gameDerivedFavoriteFaction:') &&
      playersApi.includes('armyListDerivedFavoriteFaction:') &&
      playersApi.includes('function buildCommunityResolvedFavoriteArmyMaps') &&
      playersApi.includes('function getCommunityGameDerivedPreferredArmy') &&
      playersApi.includes('function buildCommunityPreferredFactionMap') &&
      !extractFunction(playersApi, 'getCommunityGameDerivedPreferredArmy').includes('FAVORITEFACTION') &&
      /favoriteArmy\s*=\s*gameDerivedFavoriteFaction\s*\|\|\s*armyListDerivedFavoriteFaction\s*\|\|\s*""/.test(playersApi) &&
      !/favoriteArmy\s*=\s*record\.favoriteFaction\s*\|\|\s*gameDerivedFavoriteFaction/.test(playersApi),
  },
  {
    label: 'Players list builds preferred-army fallback without per-player game scans',
    pass:
      extractFunction(playersApi, 'applyCommunityGameStatistics').includes('preferredFactionValuesByPlayerKey') &&
      extractFunction(playersApi, 'buildCommunityPreferredFactionMap').includes('MOSTCOMMON') &&
      !/FAVORITEFACTION|PLAYERFACTIONS|PLAYERGAMES/.test([
        extractFunction(playersApi, 'buildCommunityPlayerRegistryRows'),
        extractFunction(playersApi, 'applyCommunityGameStatistics'),
        extractFunction(playersApi, 'buildCommunityPreferredFactionMap'),
        extractFunction(playersApi, 'finalizeCommunityPlayerRecord'),
        extractFunction(playersApi, 'getCommunityGameDerivedPreferredArmy'),
      ].join('\n')),
  },
  {
    label: 'Player profile recent games request includes all game types',
    pass:
      playerProfile.includes("{ gameType: 'all', playerName }"),
  },
  {
    label: 'Career summaries classify Game Engine rows with Game Engine schema',
    pass:
      leagueData.includes('function getGameEngineRowGameType(row)') &&
      leagueData.includes('CONFIG.ENGINE.GAME_TYPE') &&
      playersApi.includes('getGameEngineRowGameType(row)') &&
      !playersApi.includes('getGameEngineGameType(row)'),
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

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)

  if (start === -1) {
    return ''
  }

  const next = source.indexOf('\nfunction ', start + 1)

  return next === -1 ? source.slice(start) : source.slice(start, next)
}
