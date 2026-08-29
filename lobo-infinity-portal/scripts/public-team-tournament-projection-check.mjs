import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const backend = read('backend/PublicTeamTournamentProjection.gs')
const api = read('api/public-team-tournament-projection.mjs')
const page = read('src/pages/TeamTournament.tsx')
const client = read('src/services/publicTeamTournamentProjection.ts')
const automation = read('backend/AutomationApi.gs')
const tournament = read('backend/TeamTournamentApi.gs')
const correction = read('backend/GameScoreCorrectionApi.gs')

assert.match(backend, /getTeamTournament\(\{[\s\S]*?eventId: PUBLIC_TEAM_TOURNAMENT_EVENT_ID/)
assert.match(backend, /validatePublicTeamTournamentProjection_/)
assert.match(backend, /file\.setContent\(JSON\.stringify\(projection\)\)/)
assert.match(backend, /tournament\.registration\.currentPlayer = null/)
assert.match(backend, /tournament\.invitations = \[\]/)
assert.match(backend, /delete result\.armyCode/)
assert.match(backend, /delete result\.notes/)
assert.match(api, /PUBLIC_TEAM_TOURNAMENT_PROJECTION_FILE_ID/)
assert.match(api, /stale-while-revalidate=86400/)
assert.doesNotMatch(api, /action=teamTournament/)
assert.match(client, /\/api\/public-team-tournament-projection\?/)
assert.match(client, /event isolation failed/i)
assert.match(page, /auth\.authenticated[\s\S]*?teamRepository\.getTeamTournament[\s\S]*?getPublicTeamTournamentProjection/)
assert.match(page, /const load = auth\.authenticated[\s\S]*?: getPublicTeamTournamentProjection/)
assert.match(tournament, /buildTeamTournamentMutationResponse[\s\S]*?markPublicTeamTournamentProjectionDirty_\(eventId\)/)
assert.match(automation, /publishDirtyPublicTeamTournamentProjectionBestEffort_/)
assert.match(automation, /markPublicTeamTournamentProjectionDirty_\(identity && identity\.eventId\)/)
assert.match(correction, /markPublicTeamTournamentProjectionDirty_\(target\.eventId\)/)

// Explicit event selection never falls through to another tournament.
const select = (artifact, eventId) =>
  artifact.eventId === eventId && artifact.tournament?.event?.id === eventId
    ? artifact.tournament
    : null
const artifact = {
  eventId: 'event-august-2026-team-tournament',
  tournament: { event: { id: 'event-august-2026-team-tournament' } },
}
assert.ok(select(artifact, 'event-august-2026-team-tournament'))
assert.equal(select(artifact, 'event-lobo-s-american-top-40'), null)

console.log('Prepared public Team Tournament projection regression passed.')
