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
const contract = read('release/production.json')

assert.match(app, /<Route path="\/submit-game"[\s\S]*<SubmitResult \/>/, '/submit-game must render SubmitResult.')
assert.match(app, /\/casual-result" element={<Navigate replace to="\/submit-game\?gameType=casual"/, 'Casual result route must continue to enter the casual submission flow.')
assert.match(app, /\/event\/:eventId\/submit-result/, 'Event-specific result route must continue to exist.')

assert.match(submitResult, /Unified Game Submission/, '/submit-game must expose the shared game-type chooser.')
assert.match(submitResult, /label="League"[\s\S]*to="\/submit-game\?eventId=event-current-league&gameType=event"/, 'League choice must enter the league event submission path.')
assert.match(submitResult, /label="Tournament"[\s\S]*to="\/submit-game\?eventId=event-august-2026-team-tournament&gameType=event"/, 'Tournament choice must enter the tournament event submission path.')
assert.match(submitResult, /label="Casual"[\s\S]*to="\/submit-game\?gameType=casual"/, 'Casual choice must enter the casual submission path.')
assert.match(submitResult, /const shouldShowGameTypeSelector = !selectedGameType/, 'The chooser must be shown whenever no game type is explicit or inferred.')
assert.doesNotMatch(submitResult, /shouldDefaultCommissionerToCurrentLeague/, 'Active League context or commissioner role must not hide Casual and Tournament choices.')

assert.match(submitResult, /apiClient\.submitLeagueResult\(buildCommissionerPayload\(leagueResult\)\)/, 'League selection must call the league result submission API.')
assert.match(submitResult, /apiClient\.submitCasualResult\(buildCommissionerPayload\(casualResult\)\)/, 'Casual selection must call the casual result submission API.')
assert.match(submitResult, /apiClient\.saveTeamTournamentResult\(/, 'Tournament selection must call the team tournament result API.')

assert.match(api, /postRequest\('submitLeagueResult'/, 'Frontend API must retain the submitLeagueResult action.')
assert.match(api, /postRequest\('submitCasualResult'/, 'Frontend API must retain the submitCasualResult action.')
assert.match(api, /postRequest\('teamTournamentResult'/, 'Frontend API must retain the teamTournamentResult action.')

assert.match(backendApi, /case "submitLeagueResult":[\s\S]*return submitLeagueResult\(e\);/, 'Apps Script router must expose submitLeagueResult.')
assert.match(backendApi, /case "submitCasualResult":[\s\S]*return submitCasualResult\(e\);/, 'Apps Script router must expose submitCasualResult.')
assert.match(backendApi, /case "teamTournamentResult":[\s\S]*return saveTeamTournamentResult\(e\);/, 'Apps Script router must expose teamTournamentResult.')

assert.match(resultSubmissionApi, /function submitLeagueResult\(e\)/, 'League backend handler must exist.')
assert.match(resultSubmissionApi, /row\[FORM\.EVENT_ID\] = eventId;[\s\S]*row\[FORM\.GAME_TYPE\] = "league";/, 'League results must write the selected event id and league game type.')
assert.match(resultSubmissionApi, /function submitCasualResult\(e\)/, 'Casual backend handler must exist.')
assert.match(resultSubmissionApi, /row\[FORM\.EVENT_ID\] = "";[\s\S]*row\[FORM\.GAME_TYPE\] = "casual";/, 'Casual results must remain isolated from league event standings.')
assert.match(teamTournamentApi, /function saveTeamTournamentResult\(e\)/, 'Tournament backend handler must exist.')
assert.match(teamTournamentApi, /ensureTeamTournamentResultsSheet\(\)/, 'Tournament results must write to the tournament results datastore.')

assert.match(contract, /"submitGameModes"/, 'Production contract must include submit game mode markers.')

console.log('submit game mode checks passed')
