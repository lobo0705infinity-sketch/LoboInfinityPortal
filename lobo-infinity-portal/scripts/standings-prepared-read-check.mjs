import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync('src/pages/Standings.tsx', 'utf8')
const service = fs.readFileSync('src/services/publicLeagueWorkspaceProjection.ts', 'utf8')
const backend = fs.readFileSync('backend/PublicLeagueWorkspaceProjection.gs', 'utf8')

assert.match(page, /activeEventId === 'event-current-league'/)
assert.match(page, /publicLeagueWorkspace\.getStandings\(activeDivision, controller\.signal\)/)
assert.match(page, /standingsRepository\.getStandings\(activeDivision/)
assert.match(service, /const dashboard = await readSection\('dashboard', signal\)/)
assert.match(service, /normalizePlayersPayload/)
assert.match(service, /item\.division === division/)
assert.match(backend, /divisionStandings: divisions/)
assert.match(backend, /\["main", "pga", "pgb"\]\.map/)
assert.doesNotMatch(page, /apiClient\.getStandings/)

console.log('Standings prepared League read regression passed.')
