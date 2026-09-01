import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const navigation = read('src/components/sidebarNavigation.ts')
const sidebar = read('src/components/Sidebar.tsx')
const mobileMenu = read('src/pages/MobileMenu.tsx')
const app = read('src/App.tsx')
const leagueOperations = read('src/pages/LeagueOperations.tsx')
const eventNavigation = read('src/config/eventNavigation.ts')
const mobileBottomNavigation = read('src/components/MobileBottomNavigation.tsx')

const publicStart = navigation.indexOf('export const topLevelItems')
const authenticatedStart = navigation.indexOf('export const authenticatedTopLevelItems')
const communityStart = navigation.indexOf('export function getJoinCommunityNavigationItem')
const publicItems = navigation.slice(publicStart, authenticatedStart)
const authenticatedItems = navigation.slice(authenticatedStart, communityStart)

assert.match(publicItems, /label: 'Mission & Map'[\s\S]*?to: '\/league-operations'/)
assert.doesNotMatch(authenticatedItems, /Mission & Map|league-operations/)
assert.equal((navigation.match(/label: 'Mission & Map'/g) ?? []).length, 1)
assert.match(sidebar, /topLevelItems\.map/)
assert.match(mobileMenu, /\.\.\.topLevelItems/)
assert.match(app, /<Route path="\/league-operations"[\s\S]*?<LeagueOperations/)
assert.doesNotMatch(leagueOperations, /useAuth|requireApiPermission|saveLeagueOperations|updateLeagueOperations/)

const currentLeague = eventNavigation.slice(
  eventNavigation.indexOf('export const currentEventNavigation'),
  eventNavigation.indexOf('export const eventNavigation:'),
)
for (const capability of ['overview', 'registration', 'standings', 'schedule', 'rules']) {
  assert.match(currentLeague, new RegExp(`'${capability}'`))
}
assert.doesNotMatch(currentLeague, /'statistics'/)
assert.doesNotMatch(currentLeague, /league-operations|Mission & Map/)
assert.match(eventNavigation, /id: 'event-august-2026-team-tournament'/)
assert.match(mobileBottomNavigation, /mobilePrimaryItems/)

console.log('mission and map public navigation checks passed')
