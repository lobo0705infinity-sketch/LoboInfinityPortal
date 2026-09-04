import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync('src/public/SnapshotPublicApp.tsx', 'utf8')
const css = fs.readFileSync('src/public/SnapshotPublicApp.css', 'utf8')
const navigation = fs.readFileSync('src/config/eventNavigation.ts', 'utf8')

const teamConfig = navigation.slice(
  navigation.indexOf("id: 'event-august-2026-team-tournament'", navigation.indexOf('export const eventNavigation')) - 240,
  navigation.indexOf("id: 'event-lobo-s-american-top-40'"),
)
const teamsComponent = app.slice(
  app.indexOf('function TeamTournamentTeams('),
  app.indexOf('function CurrentLeagueOverview('),
)

assert.match(app, /<TeamTournamentTeams teams=\{event\.teams\}\/>/)
assert.match(teamsComponent, /team\.teamName/)
assert.match(teamsComponent, /team\.captain/)
assert.match(teamsComponent, /team\.players/)
assert.match(teamsComponent, /team\.status/)
assert.match(teamsComponent, /team\.factionRestrictions/)
assert.doesNotMatch(teamsComponent, />Team ID<|>Created At<|>Logo URL<|>Updated At<|>Discord Contact</)
assert.match(teamsComponent, /meaningfulRestriction/)
assert.match(teamsComponent, /No teams are registered for this tournament yet/)

assert.doesNotMatch(teamConfig, /'teams'/)
assert.match(app, /items\.filter\(item=>!\(teamTournament&&item==='teams'\)\)/)
assert.match(app, /path="\/event\/:eventId\/teams" element=\{<TeamTournamentTeamsRedirect \/>\}/)
assert.match(app, /path="\/event\/:eventId\/tournament\/teams" element=\{<TeamTournamentTeamsRedirect \/>\}/)
assert.match(app, /function TeamTournamentTeamsRedirect\(\).*<Navigate replace to=\{`\/event\/\$\{eventId\}`\}/)
assert.ok(app.indexOf('path="/event/:eventId/teams"') < app.indexOf('path="/event/:eventId/:section"'))
assert.ok(app.indexOf('path="/event/:eventId/tournament/teams"') < app.indexOf('path="/event/:eventId/tournament/:section"'))

assert.match(css, /\.snapshot-team-tournament-team-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit/)
assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*?\.snapshot-team-tournament-team-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
assert.doesNotMatch(teamsComponent, /preferredArmy|favoriteFaction|fetch\(|apiClient/)

console.log('PASS: Team Tournament teams are integrated into Overview with compact cards and legacy-route redirects')
