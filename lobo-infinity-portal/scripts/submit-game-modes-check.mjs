import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const submitResult = read('src/pages/SubmitResult.tsx')
const submitArmyList = read('src/pages/SubmitArmyList.tsx')
const app = read('src/App.tsx')
const api = read('src/services/api.ts')
const backendApi = read('backend/API.gs')
const discordApi = read('backend/DiscordApi.gs')
const missionApi = read('backend/MissionApi.gs')
const missionAnalytics = read('backend/MissionAnalytics.gs')
const recentGamesApi = read('backend/RecentGames.gs')
const gameEngine = read('backend/GameEngine.gs')
const armyIntelligenceApi = read('backend/ArmyIntelligenceApi.gs')
const analyticsPage = read('src/pages/Analytics.tsx')
const streamedGamesPage = read('src/pages/StreamedGames.tsx')
const gameDetailsPage = read('src/pages/GameDetails.tsx')
const missionProfilePage = read('src/pages/MissionProfile.tsx')
const playerProfilePage = read('src/pages/PlayerProfile.tsx')
const playerHistoryPage = read('src/pages/MyProfile.tsx')
const playerComparisonPage = read('src/pages/PlayerComparison.tsx')
const factionProfilePage = read('src/pages/FactionProfile.tsx')
const eventManagerPanel = read('src/components/EventManagerPanel.tsx')
const searchApi = read('backend/SearchApi.gs')
const resultSubmissionApi = read('backend/ResultSubmissionApi.gs')
const teamTournamentApi = read('backend/TeamTournamentApi.gs')
const frontendMissionRegistry = read('src/config/missions.ts')
const backendMissionRegistry = read('backend/MissionRegistry.gs')
const leagueOperationsApi = read('backend/LeagueOperationsApi.gs')
const contract = read('release/production.json')

function extractSingleQuotedArray(source, exportName) {
  const pattern = new RegExp(`export const ${exportName} = \\[([\\s\\S]*?)\\] as const`)
  const match = source.match(pattern)
  assert.ok(match, `${exportName} must be exported as a readonly array.`)
  return [...match[1].matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)]
    .map((entry) => entry[2].replace(/\\'/g, "'").replace(/\\"/g, '"'))
}

function extractDoubleQuotedConstArray(source, constName) {
  const pattern = new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\];`)
  const match = source.match(pattern)
  assert.ok(match, `${constName} must be declared as an Apps Script array.`)
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1])
}

function assertSingleMissionRegistryEntry(registry, name, label) {
  const matches = registry.filter((mission) => mission === name)
  assert.equal(matches.length, 1, `${label} must contain exactly one ${name} mission.`)
}

function listProductionSourceFiles(dir) {
  const entries = readdirSync(new URL(`../${dir}`, import.meta.url))

  return entries.flatMap((entry) => {
    const path = join(dir, entry)
    const stats = statSync(new URL(`../${path}`, import.meta.url))

    if (stats.isDirectory()) {
      return listProductionSourceFiles(path)
    }

    return /\.(?:gs|tsx?|jsx?)$/.test(entry) ? [path.replaceAll('\\', '/')] : []
  })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assertNoProductionMissionNameLiterals(missions) {
  const allowed = new Set([
    'backend/MissionRegistry.gs',
    'src/config/missions.ts',
  ])
  const missionPattern = new RegExp(
    missions.map(escapeRegExp).join('|'),
    'g',
  )
  const offenders = listProductionSourceFiles('backend')
    .concat(listProductionSourceFiles('src'))
    .filter((path) => !allowed.has(path))
    .flatMap((path) => {
      const matches = [...read(path).matchAll(missionPattern)]

      return matches.map((match) => `${path}: ${match[0]}`)
    })

  assert.deepEqual(
    offenders,
    [],
    'Canonical mission names must not be hardcoded outside the mission registries.',
  )
}

function assertGameAnalyticsArmyCodesMaterialize() {
  const context = {
    EVENT_ENGINE_DEFAULT_EVENT_ID: 'event-current-league',
    canonicalizeArmyName: (value) => String(value || '').trim(),
  }

  vm.runInNewContext(
    `${gameEngine}
globalThis.__buildAnalyticsRow = buildAnalyticsRow;
globalThis.__FORM = FORM;
globalThis.__gameAnalyticsHeaders = getGameAnalyticsHeaders()[0];`,
    context,
  )

  const FORM = context.__FORM
  const row = []
  row[FORM.DATE] = '2026-08-01'
  row[FORM.DIVISION] = 'Main Man'
  row[FORM.MISSION] = 'Panic Room'
  row[FORM.PLAYER1] = 'Player One'
  row[FORM.PLAYER2] = 'Player Two'
  row[FORM.P1TP] = 1
  row[FORM.P2TP] = 5
  row[FORM.P1OP] = 3
  row[FORM.P2OP] = 8
  row[FORM.P1VP] = 100
  row[FORM.P2VP] = 200
  row[FORM.FIRSTTURN] = 'Player 2'
  row[FORM.WINNINGFACTION] = 'Faction Two'
  row[FORM.LOSINGFACTION] = 'Faction One'
  row[FORM.GAME_TYPE] = 'league'
  row[FORM.GAME_RESULT] = 'Player 2 Victory'
  row[27] = 'PLAYER-ONE-CODE'
  row[28] = 'PLAYER-TWO-CODE'
  row.__formHeaders = []
  row.__formHeaders[27] = ' Player 1 Army Code '
  row.__formHeaders[28] = ' Player 2 Army Code '

  const analyticsRow = context.__buildAnalyticsRow(row, 2)
  const headers = context.__gameAnalyticsHeaders

  assert.equal(
    analyticsRow[headers.indexOf('Winner Army Code')],
    'PLAYER-TWO-CODE',
    'Game Analytics must materialize Winner Army Code from the winning player Army Code.',
  )
  assert.equal(
    analyticsRow[headers.indexOf('Loser Army Code')],
    'PLAYER-ONE-CODE',
    'Game Analytics must materialize Loser Army Code from the losing player Army Code.',
  )
}

const frontendMissions = extractSingleQuotedArray(frontendMissionRegistry, 'CANONICAL_MISSIONS')
const backendMissions = extractDoubleQuotedConstArray(backendMissionRegistry, 'CANONICAL_MISSIONS')

assert.deepEqual(frontendMissions, backendMissions, 'Frontend and backend canonical mission registries must stay aligned.')
assertSingleMissionRegistryEntry(frontendMissions, 'Neutralization', 'Frontend mission registry')
assertSingleMissionRegistryEntry(backendMissions, 'Neutralization', 'Backend mission registry')
assertSingleMissionRegistryEntry(frontendMissions, 'Panic Room', 'Frontend mission registry')
assertSingleMissionRegistryEntry(backendMissions, 'Panic Room', 'Backend mission registry')
assertSingleMissionRegistryEntry(frontendMissions, "Dead Man's Switch", 'Frontend mission registry')
assertSingleMissionRegistryEntry(backendMissions, "Dead Man's Switch", 'Backend mission registry')
assert.ok(frontendMissions.includes('Area of Interest'), 'Historical official mission Area of Interest must remain in the frontend registry.')
assert.ok(backendMissions.includes('Area of Interest'), 'Historical official mission Area of Interest must remain in the backend registry.')
assertNoProductionMissionNameLiterals(frontendMissions)
assert.match(frontendMissionRegistry, /getCanonicalMissionOptions\(\)[\s\S]*CANONICAL_MISSIONS\.map/, 'Submit Game mission options must come from the canonical mission registry.')
assert.match(frontendMissionRegistry, /getCanonicalMissionName\([\s\S]*canonicalMissionByKey\.get/, 'Frontend mission validation must resolve canonical registry entries.')
assert.match(backendMissionRegistry, /function getCanonicalMissionName\(value\)[\s\S]*CANONICAL_MISSIONS/, 'Backend mission validation must resolve canonical registry entries.')
assert.match(leagueOperationsApi, /missionOptions: getCanonicalMissionsForOperations\(\)/, 'Commissioner event mission options must come from the canonical mission registry.')
assert.match(leagueOperationsApi, /getCanonicalMissionName\(params\.mission1\)/, 'Commissioner mission 1 validation must use the canonical mission registry.')
assert.match(leagueOperationsApi, /getCanonicalMissionName\(params\.mission2\)/, 'Commissioner mission 2 validation must use the canonical mission registry.')
assert.match(eventManagerPanel, /options=\{data\.leagueOperations\.missionOptions\}/, 'Commissioner event configuration must render backend canonical mission options.')
assert.match(missionApi, /buildMissionRegistry\(\)[\s\S]*updateMissionRegistry\(/, 'Mission API summaries must continue to use the shared mission registry and game data.')
assert.match(missionAnalytics, /function updateMissionRegistry\(registry, scopedGames\)[\s\S]*const mission =[\s\S]*game\[CONFIG\.ENGINE\.MISSION\]/, 'Mission analytics must group games by stored mission name.')
assert.match(recentGamesApi, /mission:[\s\S]*row\[columns\.mission\]/, 'Recent games API must serialize the stored mission name.')
assert.match(armyIntelligenceApi, /mission: game\.mission/, 'Army Intelligence sources must carry the stored game mission name.')
assertGameAnalyticsArmyCodesMaterialize()
assert.match(discordApi, /buildDiscordMissionPayload\(\)[\s\S]*buildMissionApiSummaries\(\)[\s\S]*title: mission\.mission/, 'Discord mission payloads must use mission API names without overrides.')
assert.match(discordApi, /buildDiscordGamePayload\(game\)[\s\S]*Mission: "[\s\S]*result\.mission/, 'Discord game announcements must display the submitted game mission.')
assert.match(searchApi, /missions: buildMissionApiSummaries\("all", "all"\)/, 'Search APIs must return mission names from the mission API summaries.')
assert.match(analyticsPage, /filterCanonicalMissionRecords\(missions\)/, 'Mission analytics page must filter API mission records through the canonical registry.')
assert.match(streamedGamesPage, /filterCanonicalMissionNames\(Array\.from\(missions\)\)/, 'Streamed game mission filters must normalize against the canonical registry.')
assert.match(gameDetailsPage, /getCanonicalMissionName\(game\.mission\)/, 'Game Details must display canonical mission names from stored game data.')
assert.match(missionProfilePage, /getCanonicalMissionName\(decodedMissionName\)/, 'Mission Profile route names must resolve through the canonical mission registry.')
assert.match(playerProfilePage, /getCanonicalMissionName\(value\) \|\| value/, 'Player Profile mission displays must preserve historical names while normalizing canonical names.')
assert.match(playerHistoryPage, /getCanonicalMissionName\(context\.game\.mission\)/, 'Player History mission displays must normalize stored game mission names.')
assert.match(playerComparisonPage, /getCanonicalMissionName\(value\) \|\| value/, 'Player comparison mission displays must preserve historical names while normalizing canonical names.')
assert.match(factionProfilePage, /getCanonicalMissionName\(game\.mission\)/, 'Faction profile mission displays must normalize stored game mission names.')

assert.match(app, /<Route path="\/submit-game"[\s\S]*<SubmitResult \/>/, '/submit-game must render SubmitResult.')
assert.match(app, /\/casual-result" element={<Navigate replace to="\/submit-game\?gameType=casual"/, 'Casual result route must continue to enter the casual submission flow.')
assert.match(app, /\/event\/:eventId\/submit-result/, 'Event-specific result route must continue to exist.')

assert.match(submitResult, /Unified Game Submission/, '/submit-game must expose the shared game-type chooser.')
assert.match(submitResult, /label="League"[\s\S]*to="\/submit-game\?eventId=event-current-league&gameType=event"/, 'League choice must enter the league event submission path.')
assert.match(submitResult, /label="Tournament"[\s\S]*to="\/submit-game\?eventId=event-august-2026-team-tournament&gameType=event"/, 'Tournament choice must enter the tournament event submission path.')
assert.match(submitResult, /label="Casual"[\s\S]*to="\/submit-game\?gameType=casual"/, 'Casual choice must enter the casual submission path.')
assert.match(submitResult, /const shouldShowGameTypeSelector = !selectedGameType/, 'The chooser must be shown whenever no game type is explicit or inferred.')
assert.doesNotMatch(submitResult, /shouldDefaultCommissionerToCurrentLeague/, 'Active League context or commissioner role must not hide Casual and Tournament choices.')

assert.match(submitResult, /apiClient\.submitLeagueResult\(buildCommissionerPayload\(submission\)\)/, 'League selection must call the league result submission API.')
assert.match(submitResult, /apiClient\.submitCasualResult\(buildCommissionerPayload\(submission\)\)/, 'Casual selection must call the casual result submission API.')
assert.match(submitResult, /apiClient\.saveTeamTournamentResult\(/, 'Tournament selection must call the team tournament result API.')
assert.ok(frontendMissions.includes("Dead Man's Switch"), "Dead Man's Switch must be selectable in casual, league, and tournament submission mission dropdowns.")
assert.match(submitArmyList, /options=\{CANONICAL_MISSIONS\}/, 'Submit Army List mission selection must use the canonical mission registry.')
assert.match(submitResult, /label="Player 1 Army Code"[\s\S]*updateField\('player1ArmyCode'/, 'League submission must require Player 1 Army Code.')
assert.match(submitResult, /label="Player 2 Army Code"[\s\S]*updateField\('player2ArmyCode'/, 'League submission must require Player 2 Army Code.')
assert.match(submitResult, /label="Player 1 Army Code"[\s\S]*updateCasualField\('player1ArmyCode'/, 'Casual submission must require Player 1 Army Code.')
assert.match(submitResult, /label="Player 2 Army Code"[\s\S]*updateCasualField\('player2ArmyCode'/, 'Casual submission must require Player 2 Army Code.')
assert.match(submitResult, /label="Player 1 Army Code" name="player1ArmyCode" required/, 'Tournament submission must send Player 1 Army Code as player1ArmyCode.')
assert.match(submitResult, /label="Player 2 Army Code" name="player2ArmyCode" required/, 'Tournament submission must send Player 2 Army Code as player2ArmyCode.')
assert.match(submitResult, /Player 1 Army Code and Player 2 Army Code are required\./, 'Submit Game validation must require both army codes.')

assert.match(api, /postRequest\('submitLeagueResult'/, 'Frontend API must retain the submitLeagueResult action.')
assert.match(api, /postRequest\('submitCasualResult'/, 'Frontend API must retain the submitCasualResult action.')
assert.match(api, /postRequest\('teamTournamentResult'/, 'Frontend API must retain the teamTournamentResult action.')

assert.match(backendApi, /case "submitLeagueResult":[\s\S]*return submitLeagueResult\(e\);/, 'Apps Script router must expose submitLeagueResult.')
assert.match(backendApi, /case "submitCasualResult":[\s\S]*return submitCasualResult\(e\);/, 'Apps Script router must expose submitCasualResult.')
assert.match(backendApi, /case "teamTournamentResult":[\s\S]*return saveTeamTournamentResult\(e\);/, 'Apps Script router must expose teamTournamentResult.')

assert.match(resultSubmissionApi, /function submitLeagueResult\(e\)/, 'League backend handler must exist.')
assert.match(resultSubmissionApi, /row\[FORM\.EVENT_ID\] = eventId;[\s\S]*row\[FORM\.GAME_TYPE\] = "league";/, 'League results must write the selected event id and league game type.')
assert.match(resultSubmissionApi, /row\[FORM\.MISSION\] = getResultSubmissionString\(params\.mission\);/, 'League and casual submissions must persist the selected mission name.')
assert.match(resultSubmissionApi, /RESULT_SUBMISSION_ARMY_CODE_HEADERS[\s\S]*Player 1 Army Code[\s\S]*Player 2 Army Code/, 'League and Casual submissions must define army-code Form Responses headers.')
assert.match(resultSubmissionApi, /ensureResultSubmissionArmyCodeColumns\(sheet\)[\s\S]*params\.player1ArmyCode[\s\S]*params\.player2ArmyCode/, 'League and Casual submissions must store both player army codes by header name.')
assert.match(resultSubmissionApi, /function submitCasualResult\(e\)/, 'Casual backend handler must exist.')
assert.match(resultSubmissionApi, /row\[FORM\.EVENT_ID\] = "";[\s\S]*row\[FORM\.GAME_TYPE\] = "casual";/, 'Casual results must remain isolated from league event standings.')
assert.match(teamTournamentApi, /function saveTeamTournamentResult\(e\)/, 'Tournament backend handler must exist.')
assert.match(teamTournamentApi, /ensureTeamTournamentResultsSheet\(\)/, 'Tournament results must write to the tournament results datastore.')
assert.match(teamTournamentApi, /TEAM_TOURNAMENT_RESULT_HEADERS[\s\S]*Player 1 Army Code[\s\S]*Player 2 Army Code/, 'Tournament results must include both player army-code columns.')
assert.match(teamTournamentApi, /player1ArmyCode: getTeamTournamentString\(params\.player1ArmyCode\)[\s\S]*player2ArmyCode: getTeamTournamentString\(params\.player2ArmyCode\)/, 'Tournament results must associate submitted army codes with player and opponent.')
assert.match(teamTournamentApi, /const mission =[\s\S]*getTeamTournamentString\(params\.mission\)/, 'Tournament submissions must persist the selected mission name.')
assert.match(api, /player1ArmyCode\?: string[\s\S]*player2ArmyCode\?: string/, 'Frontend result submission model must carry optional army-code fields before UI enforcement.')
assert.match(api, /player1ArmyCode: submission\.player1ArmyCode \?\? ''[\s\S]*player2ArmyCode: submission\.player2ArmyCode \?\? ''/, 'Casual result API payload must carry both army-code fields.')

assert.match(contract, /"submitGameModes"/, 'Production contract must include submit game mode markers.')

console.log('submit game mode checks passed')
