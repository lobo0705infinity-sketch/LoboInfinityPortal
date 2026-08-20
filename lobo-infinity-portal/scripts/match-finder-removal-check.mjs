import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

const app = read('src/App.tsx')
const eventNavigation = read('src/config/eventNavigation.ts')
const eventCapabilities = read('src/config/eventCapabilities.ts')
const routePreload = read('src/services/routePreload.ts')
const schedule = read('src/pages/Schedule.tsx')
const playerProfile = read('src/pages/PlayerProfile.tsx')
const eventHome = read('src/pages/EventHome.tsx')
const commissionerPlayers = read('src/pages/CommissionerPlayers.tsx')
const commissionerEvents = read('src/pages/CommissionerEvents.tsx')
const commissionerDashboard = read('src/pages/CommissionerDashboard.tsx')
const apiRouter = read('backend/API.gs')
const schedulingApi = read('backend/SchedulingApi.gs')
const seasonCommand = read('backend/SeasonCommandCenterApi.gs')
const deletionApi = read('backend/PlayerDeletionApi.gs')

const currentLeagueCapabilities = eventNavigation.match(
  /currentEventNavigation[\s\S]*?capabilities:\s*\[([\s\S]*?)\]/,
)?.[1] ?? ''
const registrationIndex = currentLeagueCapabilities.indexOf("'registration'")
const standingsIndex = currentLeagueCapabilities.indexOf("'standings'")

const checks = [
  ['Match Finder page removed', !existsSync('src/pages/MatchFinder.tsx')],
  ['Match Finder lazy route removed', !app.includes("import('./pages/MatchFinder')")],
  ['Old Match Finder route redirects to League Overview', app.includes('<Route path="/match-finder" element={<Navigate replace to="/event/event-current-league" />} />')],
  ['Match Finder preload removed', !routePreload.includes("'/match-finder'")],
  ['Desktop/mobile event configuration excludes Match Finder', !currentLeagueCapabilities.includes('matchFinder') && !eventCapabilities.includes("'matchFinder'")],
  ['Registration proceeds directly to Standings', registrationIndex >= 0 && standingsIndex > registrationIndex && !currentLeagueCapabilities.slice(registrationIndex, standingsIndex).includes("'matchFinder'")],
  ['Schedule no longer exposes player Match Finder action', !schedule.includes('Open Match Finder') && !schedule.includes('/match-finder')],
  ['Player profile no longer exposes Schedule Match identity action', !playerProfile.includes('Schedule Match') && !playerProfile.includes('/match-finder')],
  ['Backend-provided Match Finder navigation is filtered', eventHome.includes('isMatchFinderReference') && eventHome.includes("text.includes('/match-finder')")],
  ['Commissioner Availability points to protected scheduling panel', commissionerPlayers.includes('/commissioner?section=scheduling')],
  ['Commissioner Event scheduling points to protected scheduling panel', commissionerEvents.includes('/commissioner?section=scheduling')],
  ['Commissioner scheduling panel supports direct navigation', commissionerDashboard.includes("section === 'scheduling'") && commissionerDashboard.includes("return 'scheduling'")],
  ['Shared Match Finder backend action retained', apiRouter.includes('case "matchFinder"') && schedulingApi.includes('function getMatchFinder')],
  ['Shared scheduling and availability actions retained', apiRouter.includes('case "schedulingCenter"') && apiRouter.includes('case "schedulingAvailability"') && apiRouter.includes('case "commissionerScheduling"')],
  ['Season scheduling dependency retained', seasonCommand.includes('getSeasonAvailabilityForPlayer')],
  ['Player deletion scheduling dependency retained', deletionApi.includes('CONFIG.SHEETS.SEASON_AVAILABILITY') && deletionApi.includes('CONFIG.SHEETS.SCHEDULING_REQUESTS')],
]

let failed = false
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}`)
  failed ||= !passed
}

if (failed) process.exitCode = 1
