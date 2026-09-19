import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const app = readFileSync(`${root}src/public/SnapshotPublicApp.tsx`, 'utf8')
const css = readFileSync(`${root}src/public/SnapshotPublicApp.css`, 'utf8')
const asset = readFileSync(`${root}public/assets/team-tournament/team-tournament-results-fc3f8021.png`)
const eventPage = app.match(/function EventPage\(\)[\s\S]*?function EventSection/)?.[0] ?? ''

assert.equal(createHash('sha256').update(asset).digest('hex'), 'fc3f80210638b497246cb9841164c2779c173ecd6691836a655ab1fc0ae692f7')
assert.match(eventPage, /const isTeamResults=isTeam&&section==='results'/)
assert.match(eventPage, /isTeamResults\?'team-tournament-results':undefined/)
assert.match(eventPage, /isTeamResults\?<TeamTournamentResultsHero\/>:<EventHero/)
assert.match(eventPage, /!isTeamStandings&&!isTeamResults\?/)
assert.match(app, /function TeamTournamentResultsHero\(\).*team-tournament-results-fc3f8021\.png/)
assert.equal((app.match(/team-tournament-results-fc3f8021\.png/g) ?? []).length, 1)
assert.match(css, /data-event="team-tournament-results"[^}]*\.snapshot-team-tournament-results-hero\s*\{[^}]*max-width:\s*1320px;[^}]*margin:\s*0 auto;/s)
assert.match(css, /data-event="team-tournament-results"[^}]*\.snapshot-team-tournament-results-hero img\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/s)
assert.match(app, /function TeamTournamentOverviewHero\(\)/)
assert.match(app, /function TeamTournamentStandingsHero\(\)/)
assert.match(app, /if\(section==='results'\)return <Panel title="Results"><GameTable games=\{games\}\/><\/Panel>/)

console.log('Team Tournament Results hero regression passed (scoped artwork, preserved results, content hash verified).')
