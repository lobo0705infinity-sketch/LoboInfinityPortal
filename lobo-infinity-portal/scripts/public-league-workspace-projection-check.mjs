import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const backend = read('backend/PublicLeagueWorkspaceProjection.gs')
const api = read('api/public-league-workspace-projection.mjs')
const service = read('src/services/publicLeagueWorkspaceProjection.ts')
const dashboard = read('src/contexts/DashboardDataContext.tsx')
const factions = read('src/pages/Factions.tsx')
const missions = read('src/pages/Missions.tsx')
const hall = read('src/pages/HallOfFame.tsx')
const operations = read('src/pages/LeagueOperations.tsx')

assert.match(backend, /buildPublicLeagueDashboardProjection_/)
assert.match(backend, /buildLeagueStandingsContext\(eventId\)/)
assert.match(backend, /buildLeagueDivisionStandingsFromContext/)
assert.match(backend, /divisionStandings: divisions/)
assert.match(backend, /projection\.dashboard\.divisionStandings\.length !== 3/)
assert.match(backend, /\["main", "pga", "pgb"\]/)
assert.match(backend, /topFaction: getPublicLeagueDashboardTopFaction_\(\)/)
assert.match(backend, /getSheetByName\(CONFIG\.SHEETS\.FACTION_ANALYTICS\)/)
assert.match(backend, /favoriteArmy: leader\.favoriteArmy \|\| leader\.faction \|\| ""/)
assert.match(backend, /publishPublicLeagueWorkspaceProjectionSection_/)
assert.match(backend, /remaining: dirty\.length/)
assert.doesNotMatch(backend, /dashboard: parse\(getDashboard\(\)\)/)
assert.match(backend, /getFactions\(\{ parameter: \{\} \}\)/)
assert.match(backend, /getLeagueOperations\(\)/)
for (const scope of ['current-league', 'tournament', 'casual', 'all']) {
  assert.match(backend, new RegExp(`\\["${scope}"`))
}
assert.match(api, /stale-while-revalidate=86400/)
assert.match(api, /PUBLIC_LEAGUE_WORKSPACE_PROJECTION_FILE_ID/)
assert.doesNotMatch(api, /script\.google\.com/)
assert.match(service, /\/api\/public-league-workspace-projection\?section=/)
assert.match(service, /getStandings/)
assert.match(dashboard, /publicLeagueWorkspace\.getDashboard/)
assert.match(factions, /publicLeagueWorkspace\.getFactions/)
assert.match(missions, /publicLeagueWorkspace\.getMissions/)
assert.match(hall, /apiClient\.getHallOfFame/)
assert.doesNotMatch(backend, /getHallOfFame/)
assert.match(backend, /delete projection\.hallOfFame/)
assert.match(backend, /delete projection\.records/)
assert.doesNotMatch(backend, /CanonicalDecoderGateway|decode\(/)
assert.match(operations, /publicLeagueWorkspace\s*\.getLeagueOperations/)
assert.match(read('src/pages/Standings.tsx'), /publicLeagueWorkspace\.getStandings/)
assert.doesNotMatch(operations, /eventRepository\s*\.\s*getLeagueOperations/)

for (const source of [backend, api]) {
  for (const forbidden of ['password', 'Army Code', 'sessionToken', 'commissionerEmails']) {
    assert.ok(!source.includes(forbidden), `Public League projection contains forbidden marker: ${forbidden}`)
  }
}

console.log('Public League workspace projection check passed.')
