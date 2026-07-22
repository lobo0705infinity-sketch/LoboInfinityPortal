import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const submitResult = read('src/pages/SubmitResult.tsx')
const app = read('src/App.tsx')
const api = read('src/services/api.ts')
const backendApi = read('backend/API.gs')
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
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1])
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

const frontendMissions = extractSingleQuotedArray(frontendMissionRegistry, 'CANONICAL_MISSIONS')
const backendMissions = extractDoubleQuotedConstArray(backendMissionRegistry, 'CANONICAL_MISSIONS')

assert.deepEqual(frontendMissions, backendMissions, 'Frontend and backend canonical mission registries must stay aligned.')
assertSingleMissionRegistryEntry(frontendMissions, 'Neutralization', 'Frontend mission registry')
assertSingleMissionRegistryEntry(backendMissions, 'Neutralization', 'Backend mission registry')
assert.match(frontendMissionRegistry, /getCanonicalMissionOptions\(\)[\s\S]*CANONICAL_MISSIONS\.map/, 'Submit Game mission options must come from the canonical mission registry.')
assert.match(frontendMissionRegistry, /getCanonicalMissionName\([\s\S]*canonicalMissionByKey\.get/, 'Frontend mission validation must resolve canonical registry entries.')
assert.match(backendMissionRegistry, /function getCanonicalMissionName\(value\)[\s\S]*CANONICAL_MISSIONS/, 'Backend mission validation must resolve canonical registry entries.')
assert.match(leagueOperationsApi, /missionOptions: getCanonicalMissionsForOperations\(\)/, 'Commissioner event mission options must come from the canonical mission registry.')
assert.match(leagueOperationsApi, /getCanonicalMissionName\(params\.mission1\)/, 'Commissioner mission 1 validation must use the canonical mission registry.')
assert.match(leagueOperationsApi, /getCanonicalMissionName\(params\.mission2\)/, 'Commissioner mission 2 validation must use the canonical mission registry.')

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
assert.match(resultSubmissionApi, /RESULT_SUBMISSION_ARMY_CODE_HEADERS[\s\S]*Player 1 Army Code[\s\S]*Player 2 Army Code/, 'League and Casual submissions must define army-code Form Responses headers.')
assert.match(resultSubmissionApi, /ensureResultSubmissionArmyCodeColumns\(sheet\)[\s\S]*params\.player1ArmyCode[\s\S]*params\.player2ArmyCode/, 'League and Casual submissions must store both player army codes by header name.')
assert.match(resultSubmissionApi, /function submitCasualResult\(e\)/, 'Casual backend handler must exist.')
assert.match(resultSubmissionApi, /row\[FORM\.EVENT_ID\] = "";[\s\S]*row\[FORM\.GAME_TYPE\] = "casual";/, 'Casual results must remain isolated from league event standings.')
assert.match(teamTournamentApi, /function saveTeamTournamentResult\(e\)/, 'Tournament backend handler must exist.')
assert.match(teamTournamentApi, /ensureTeamTournamentResultsSheet\(\)/, 'Tournament results must write to the tournament results datastore.')
assert.match(teamTournamentApi, /TEAM_TOURNAMENT_RESULT_HEADERS[\s\S]*Player 1 Army Code[\s\S]*Player 2 Army Code/, 'Tournament results must include both player army-code columns.')
assert.match(teamTournamentApi, /player1ArmyCode: getTeamTournamentString\(params\.player1ArmyCode\)[\s\S]*player2ArmyCode: getTeamTournamentString\(params\.player2ArmyCode\)/, 'Tournament results must associate submitted army codes with player and opponent.')
assert.match(api, /player1ArmyCode\?: string[\s\S]*player2ArmyCode\?: string/, 'Frontend result submission model must carry optional army-code fields before UI enforcement.')
assert.match(api, /player1ArmyCode: submission\.player1ArmyCode \?\? ''[\s\S]*player2ArmyCode: submission\.player2ArmyCode \?\? ''/, 'Casual result API payload must carry both army-code fields.')

assert.match(contract, /"submitGameModes"/, 'Production contract must include submit game mode markers.')

console.log('submit game mode checks passed')
