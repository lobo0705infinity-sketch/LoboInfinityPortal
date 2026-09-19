import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateTeamTournamentRound, type TeamMatchDraft } from '../src/services/teamTournamentRoundManagement.ts'
import type { TeamTournamentTeam } from '../src/services/api.ts'

const team = (id: string, players: string): TeamTournamentTeam => ({ captain: '', createdAt: '', discordContact: '', eventId: 'event-test', factionRestrictions: '', logoUrl: '', players, status: 'Ready', teamId: id, teamName: `Team ${id}`, updatedAt: '' })
const teams = [team('a', 'A1,A2,A3,A4,A5'), team('b', 'B1,B2,B3,B4,B5'), team('c', 'C1,C2,C3,C4,C5'), team('d', 'D1,D2,D3,D4,D5')]
const valid: TeamMatchDraft[] = [{ teamAId: 'a', teamBId: 'b' }, { teamAId: 'c', teamBId: 'd' }]

assert.equal(validateTeamTournamentRound(teams, valid).valid, true, 'four teams validate without advance player assignments')
assert.equal(validateTeamTournamentRound(teams, [{ ...valid[0] }, { ...valid[1], teamAId: 'a' }]).valid, false, 'duplicate team rejected')
assert.equal(validateTeamTournamentRound(teams, [{ teamAId: 'a', teamBId: 'a' }, valid[1]]).valid, false, 'self matchup rejected')
assert.equal(validateTeamTournamentRound(teams, [valid[0]]).valid, false, 'omitted teams rejected')

const api = readFileSync('backend/TeamTournamentApi.gs', 'utf8')
const router = readFileSync('backend/API.gs', 'utf8')
const editor = readFileSync('src/components/TeamPairingEditor.tsx', 'utf8')
assert.match(router, /teamTournamentRoundManagement[\s\S]*saveTeamTournamentRoundManagement/)
assert.match(api, /requireApiPermission\(e, "runSeasonControl"/)
assert.match(api, /lock\.waitLock\(10000\)/)
assert.match(api, /existingRound && results\.length > 0/)
assert.match(api, /Every registered team must appear exactly once/)
assert.match(api, /existingRoundPairings[\s\S]*Editing cannot omit an existing team pairing/)
assert.match(api, /storedPairing \? storedPairing\.playerPairings : ""/, 'editing preserves historical individual pairing text exactly')
assert.match(api, /storedPairing \? storedPairing\.results : ""/, 'editing preserves historical pairing results exactly')
assert.match(api, /selectedOpponent[\s\S]*expectedOpponentTeam[\s\S]*opponentTeam/, 'later individual results associate players through team membership and the published matchup')
assert.match(api, /parseTeamTournamentPlayerPairings\(activePairings\[index\]\)/, 'legacy player assignments remain readable for historical compatibility')
assert.match(api, /upsertTeamTournamentCompositeRow[\s\S]*upsertEventEngineRow[\s\S]*updateEventManagerEventFields/, 'pairings and round persist before lifecycle advances')
assert.match(api, /publishPublicTeamTournamentProjection_\(\)/, 'successful publish refreshes the isolated public Team Tournament projection')
assert.match(editor, /Complete Preview/)
assert.match(editor, /Publish Round and Pairings/)
assert.doesNotMatch(editor, /PlayerSelect|Team A Player|Team B Player|updatePlayer|unpairedA|unpairedB/, 'round workflow has no individual player assignment controls')
assert.doesNotMatch(api.match(/function saveTeamTournamentRoundManagement[\s\S]*?\n}\n/)?.[0] ?? '', /teamAPlayer|teamBPlayer|Every registered player/, 'round mutation requires team matchups only')
assert.doesNotMatch(api.match(/function saveTeamTournamentRoundManagement[\s\S]*?\n}\n/)?.[0] ?? '', /round-.*-1|round-.*-2/, 'operation does not rewrite historical round IDs')

console.log('Team Tournament round management checks passed: team-only creation, duplicate/incomplete rejection, later result association, and historical compatibility.')
