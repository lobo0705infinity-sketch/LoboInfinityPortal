import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const app = read('src/public/SnapshotPublicApp.tsx')
const exporter = read('backend/PublicSnapshotExporter.gs')

assert.match(exporter, /readPublicSnapshotTeamTournamentProjection_\(\)/)
assert.match(exporter, /projection\.eventId !== eventId/)
assert.match(exporter, /event\.standings = JSON\.parse\([\s\S]*?teamTournamentProjection\.tournament\.standings/)
assert.match(app, /\['Players', '\/players'\], \['Standings', '\/standings\?eventId=event-current-league'\]/)
assert.match(app, /if\(isLeague&&section==='standings'\)return <CurrentLeagueStandings divisions=\{currentLeagueDivisions\}\/>/)
assert.match(app, /teamTournament&&item==='standings'\?`\/event\/\$\{eventId\}\/tournament\/standings`/)
assert.match(app, /if\(section==='standings'&&\/team tournament\/i\.test\(event\.type\)\)return <TeamTournamentStandings standings=\{event\.standings\?\?\[\]\}\/>/)
assert.match(app, /function TeamTournamentStandings\(\{standings\}:\{standings:PublicTeamTournamentStanding\[\]\}\)/)
assert.match(app, /import teamTournamentStandingsHero from '\.\.\/assets\/team-tournament-standings-hero\.png'/)
assert.match(app, /const isTeamStandings=isTeam&&section==='standings'/)
assert.match(app, /isTeamStandings\?<TeamTournamentStandingsHero\/>:<EventHero event=\{event\}\/>/)
assert.match(app, /!isLeagueRegistration&&!isLeagueSchedule&&!isTeamStandings\?<MetricGrid/)
assert.match(app, /<th>Rank<\/th><th>Team<\/th><th>Wins<\/th><th>Losses<\/th><th>Draws<\/th><th>TP<\/th><th>OP<\/th><th>VP<\/th>/)
assert.doesNotMatch(app, /if\(section==='standings'\)return <>\{standings\.map/)

console.log('Standings context routing regression passed.')
