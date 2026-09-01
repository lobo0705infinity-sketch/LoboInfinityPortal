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
assert.doesNotMatch(app, /if\(section==='standings'\)return <>\{standings\.map/)

console.log('Standings context routing regression passed.')
