import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)
  assert.notEqual(start, -1, `${name} must exist.`)

  let depth = 0
  let seenBody = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (char === '{') {
      depth += 1
      seenBody = true
    } else if (char === '}') {
      depth -= 1

      if (seenBody && depth === 0) {
        return source.slice(start, index + 1)
      }
    }
  }

  return source.slice(start)
}

const analyticsPage = read('src/pages/Analytics.tsx')
const api = read('src/services/api.ts')
const authApi = read('backend/AuthApi.gs')
const dashboardTypes = read('src/types/dashboard.ts')
const divisions = read('src/utils/divisions.ts')
const firestoreProvider = read('src/services/data/providers/FirestoreProviderImpl.ts')
const leagueData = read('backend/LeagueData.gs')
const playerProfile = read('src/pages/PlayerProfile.tsx')
const playersApi = read('backend/PlayersApi.gs')
const recentGames = read('backend/RecentGames.gs')
const resultSubmissionApi = read('backend/ResultSubmissionApi.gs')

const requireApiPermission = extractFunction(authApi, 'requireApiPermission')
const getDivisionKey = extractFunction(api, 'getDivisionKey')
const buildAnalyticsRequestParams = extractFunction(api, 'buildAnalyticsRequestParams')
const buildPlayerCareerSummary = extractFunction(playersApi, 'buildPlayerCareerSummary')
const buildPlayerCareerGame = extractFunction(playersApi, 'buildPlayerCareerGame')
const applyCommunityGameStatistics = extractFunction(playersApi, 'applyCommunityGameStatistics')
const filterRecentGamesByEvent = extractFunction(recentGames, 'filterRecentGamesByEvent')
const getRecentGameGameType = extractFunction(recentGames, 'getRecentGameGameType')
const resolveLeagueGameTypeScope = extractFunction(leagueData, 'resolveLeagueGameTypeScope')
const getDivisionIdentity = extractFunction(divisions, 'getDivisionIdentity')

assert.match(
  extractFunction(playersApi, 'buildPlayerProfileSupplement_'),
  /getPlayerRecentGameObjectsFromGameEngine\(\s*playerName,\s*playerName\s*\)/,
  'Public player profiles must embed the canonical all-game-type recent-games projection.',
)

assert.match(
  buildPlayerCareerSummary,
  /getLeagueDataForEvent\(\s*"all",\s*"all"\s*\)/,
  'Career summary must include all Game Engine game types.',
)

for (const gameType of ['league', 'tournament', 'casual']) {
  assert.match(
    buildPlayerCareerSummary,
    new RegExp(`buildPlayerCareerRecordByType\\(\\s*rows,\\s*"${gameType}"\\s*\\)`),
    `Career summary must maintain ${gameType} totals.`,
  )
}

assert.match(
  buildPlayerCareerSummary,
  /overall:\s*overall/,
  'Career summary must preserve overall totals.',
)

assert.match(
  buildPlayerCareerGame,
  /getGameEngineRowGameType\(row\)/,
  'Career summary row classification must use the Game Engine row helper.',
)

assert.match(
  applyCommunityGameStatistics,
  /getGameEngineRowGameType\(row\)/,
  'Community player statistics must use the Game Engine row helper.',
)

assert.doesNotMatch(
  playersApi,
  /getGameEngineGameType\(row\)/,
  'Players API must not pass Game Engine rows to the Form Responses game-type helper.',
)

assert.match(
  extractFunction(leagueData, 'getGameEngineRowGameType'),
  /CONFIG\.ENGINE\.GAME_TYPE/,
  'Game Engine row game-type helper must read the Game Engine schema.',
)

assert.match(
  getRecentGameGameType,
  /return "league";/,
  'Recent Games must remain league-only by default.',
)

assert.match(
  resolveLeagueGameTypeScope,
  /value === "all"[\s\S]*value === "tournament"[\s\S]*value === "casual"[\s\S]*return "league";/,
  'Recent Games scope resolver must accept all/casual/tournament and default to league.',
)

assert.match(
  filterRecentGamesByEvent,
  /typeScope === "all"[\s\S]*getRecentGameString\(game\.gameType \|\| "league"\) === typeScope/,
  'Recent Games must return both league and casual rows only when gameType=all.',
)

assert.match(
  filterRecentGamesByEvent,
  /typeScope !== "all"[\s\S]*getRecentGameString\(game\.gameType \|\| "league"\) !== typeScope[\s\S]*return false;/,
  'Recent Games must filter casual and league requests by explicit game type.',
)

assert.match(
  analyticsPage,
  /type GameTypeFilter = 'league' \| 'tournament' \| 'casual' \| 'all'/,
  'Analytics page must keep Casual as a selectable game type.',
)

assert.match(
  analyticsPage,
  /<option value="casual">Casual<\/option>/,
  'Analytics page must render the Casual filter option.',
)

assert.match(
  analyticsPage,
  /const options = \{ eventId, gameType, signal: controller\.signal \}[\s\S]*apiClient\.getPlayers\(options\)/,
  'Analytics page must request casual player standings through the existing players API.',
)

assert.match(
  buildAnalyticsRequestParams,
  /options\.gameType \? \{ gameType: options\.gameType \} : \{\}/,
  'Analytics API requests must preserve the selected gameType.',
)

assert.match(
  dashboardTypes,
  /export type DivisionKey = 'main' \| 'pga' \| 'pgb' \| 'casual'/,
  'Frontend division type must accept the backend casual division key.',
)

for (const division of ['main', 'pga', 'pgb', 'casual']) {
  assert.match(
    getDivisionKey,
    new RegExp(`value === '${division}'`),
    `Division normalizer must accept ${division}.`,
  )
}

assert.match(
  getDivisionKey,
  /throw new Error\(`API response has an unknown division: \$\{value\}\.`\)/,
  'Division normalizer must continue rejecting unknown division values.',
)

assert.match(
  api,
  /leagueDivisionKeys\.map\(\(division\) => getStandings\(division, options\)\)/,
  'Bulk league standings fetches must remain league-division-only.',
)

assert.match(
  api,
  /const leagueDivisionKeys: DivisionKey\[\] = \['main', 'pga', 'pgb'\]/,
  'League standings iteration must not start requesting casual standings.',
)

assert.match(
  getDivisionIdentity,
  /division === 'casual' \|\| division === 'Casual'[\s\S]*return identities\.casual/,
  'Shared division display helper must render Casual explicitly.',
)

assert.match(
  firestoreProvider,
  /division === 'casual'[\s\S]*return 'Casual'/,
  'Firestore provider division labels must handle Casual if given a casual standings payload.',
)

assert.match(
  authApi,
  /canSubmitCasualGames:\s*USER_ROLES\.GUEST/,
  'Authenticated Guest users must be able to submit casual games.',
)

assert.match(
  authApi,
  /canSubmitArmyLists:\s*USER_ROLES\.GUEST/,
  'Authenticated Guest users must be able to submit army lists.',
)

assert.match(
  authApi,
  /canSubmitLeagueGames:\s*USER_ROLES\.MEMBER/,
  'League game submission must remain League Member protected.',
)

assert.match(
  authApi,
  /manageCache:\s*USER_ROLES\.COMMISSIONER/,
  'Commissioner operations must remain Commissioner protected.',
)

assert.match(
  resultSubmissionApi,
  /function submitCasualResult\(e\)[\s\S]*const auth = getRequestUser\(e\);/,
  'Casual result submission must allow anonymous Player selection.',
)

assert.match(
  resultSubmissionApi,
  /function submitLeagueResult\(e\)[\s\S]*const auth = getRequestUser\(e\);/,
  'League result submission must allow anonymous Player selection.',
)

assert.match(
  requireApiPermission,
  /if \(!auth\.authenticated\)[\s\S]*code:\s*"AUTH_REQUIRED"[\s\S]*error:\s*auth\.error \|\| "Authentication is required\."/,
  'Protected endpoints must reject anonymous callers through the shared authorization helper.',
)

console.log('casual community regression checks passed')
