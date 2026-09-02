import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const publicApp = read('src/public/SnapshotPublicApp.tsx')
const styles = read('src/public/SnapshotPublicApp.css')

assert.match(publicApp, /path="\/league-operations" element=\{<LeagueOperations \/>\}/)
assert.match(publicApp, /function LeagueOperations\(\).*?data-page="league-operations"/s)
assert.match(publicApp, /Current League.*?Mission &amp; Map.*?Know the mission\. Know the battlefield\./s)
assert.match(publicApp, /source\?\.missions\.slice\(0,2\)/)
assert.match(publicApp, /formatLeagueOperationsWeek\(source\?\.weekNumber\|\|''\)/)
assert.match(publicApp, /formatLeagueOperationsUpdatedAt\(source\?\.updatedAt\|\|''\)/)
assert.match(publicApp, /snapshot-league-operations-mission/)
assert.match(publicApp, /function Schedule\(\).*?title="Schedule \/ Mission & Map"/s)
assert.match(publicApp, /function CurrentLeagueSchedule\(/)
assert.match(styles, /data-page="league-operations"\] > \.snapshot-league-operations-hero[\s\S]*aspect-ratio: 1536 \/ 740[\s\S]*background-position: center 36%[\s\S]*background-size: cover/)
assert.match(styles, /snapshot-league-operations-hero \{[\s\S]*?justify-content: flex-end/)
assert.match(styles, /snapshot-league-operations-hero-copy[\s\S]*?border-left: 3px solid #d93140/)
assert.match(styles, /snapshot-league-operations-missions[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
assert.match(styles, /@media \(max-width: 920px\)[\s\S]*snapshot-league-operations-hero[\s\S]*aspect-ratio: 4 \/ 3/)
assert.ok(existsSync(new URL('../src/assets/current-league-mission-map-hero.png', import.meta.url)))

console.log('Current League Mission & Map presentation regression passed.')
