import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateTeamTournamentRound, type TeamMatchDraft } from '../src/services/teamTournamentRoundManagement.ts'
import type { TeamTournamentTeam } from '../src/services/api.ts'

const team = (id: string, players: string): TeamTournamentTeam => ({ captain: '', createdAt: '', discordContact: '', eventId: 'event-test', factionRestrictions: '', logoUrl: '', players, status: 'Ready', teamId: id, teamName: `Team ${id}`, updatedAt: '' })
const teams = [team('a', 'A1,A2,A3,A4,A5'), team('b', 'B1,B2,B3,B4,B5'), team('c', 'C1,C2,C3,C4,C5'), team('d', 'D1,D2,D3,D4,D5')]
const matches = (left: string, right: string) => Array.from({ length: 5 }, (_, index) => ({ teamAPlayer: `${left}${index + 1}`, teamBPlayer: `${right}${index + 1}` }))
const valid: TeamMatchDraft[] = [{ teamAId: 'a', teamBId: 'b', matches: matches('A', 'B') }, { teamAId: 'c', teamBId: 'd', matches: matches('C', 'D') }]

assert.equal(validateTeamTournamentRound(teams, valid).valid, true, 'four complete teams validate')
assert.equal(validateTeamTournamentRound(teams, [{ ...valid[0] }, { ...valid[1], teamAId: 'a' }]).valid, false, 'duplicate team rejected')
assert.equal(validateTeamTournamentRound(teams, [{ ...valid[0], matches: valid[0].matches.map((row, index) => index === 1 ? { ...row, teamAPlayer: 'A1' } : row) }, valid[1]]).valid, false, 'duplicate player rejected')
assert.equal(validateTeamTournamentRound(teams, [{ ...valid[0], matches: valid[0].matches.slice(0, 4) }, valid[1]]).valid, false, 'incomplete pairing rejected')
assert.equal(validateTeamTournamentRound(teams, [{ ...valid[0], matches: valid[0].matches.map((row, index) => index === 0 ? { ...row, teamAPlayer: 'C1' } : row) }, valid[1]]).valid, false, 'outside-roster player rejected')
const unequalTeams = [team('a', 'A1,A2,A3,A4,A5'), team('b', 'B1,B2,B3,B4')]
assert.equal(validateTeamTournamentRound(unequalTeams, [{ teamAId: 'a', teamBId: 'b', matches: matches('A', 'B').slice(0, 4) }]).valid, true, 'smaller roster is fully paired and larger-team substitute remains explicit')

const api = readFileSync('backend/TeamTournamentApi.gs', 'utf8')
const router = readFileSync('backend/API.gs', 'utf8')
const editor = readFileSync('src/components/TeamPairingEditor.tsx', 'utf8')
assert.match(router, /teamTournamentRoundManagement[\s\S]*saveTeamTournamentRoundManagement/)
assert.match(api, /requireApiPermission\(e, "runSeasonControl"/)
assert.match(api, /lock\.waitLock\(10000\)/)
assert.match(api, /existingRound && results\.length > 0/)
assert.match(api, /Every registered team must appear exactly once/)
assert.match(api, /Every registered player must be matched or explicitly marked unpaired\/substitute/)
assert.match(api, /existingRoundPairings[\s\S]*Editing cannot omit an existing team pairing/)
assert.match(api, /upsertTeamTournamentCompositeRow[\s\S]*upsertEventEngineRow[\s\S]*updateEventManagerEventFields/, 'pairings and round persist before lifecycle advances')
assert.match(api, /publishPublicTeamTournamentProjection_\(\)/, 'successful publish refreshes the isolated public Team Tournament projection')
assert.match(editor, /Complete Preview/)
assert.match(editor, /Substitute\/unpaired/)
assert.match(editor, /Publish Round and Pairings/)
assert.doesNotMatch(api.match(/function saveTeamTournamentRoundManagement[\s\S]*?\n}\n/)?.[0] ?? '', /round-.*-1|round-.*-2/, 'operation does not rewrite historical round IDs')

console.log('Team Tournament round management checks passed: four teams, complete player assignment, duplicate/incomplete rejection, safe editing, and historical preservation.')
