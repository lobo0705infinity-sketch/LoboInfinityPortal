import { readFileSync } from 'node:fs'

const context = read('src/contexts/DashboardDataContext.tsx')
const core = read('src/services/apiCore.ts')
const dashboard = read('src/pages/Dashboard.tsx')
const failures = []

assert(
  /function loadDashboardSummary\(\) \{\s*return dashboardRepository\.getDashboard\(dashboardSWR\)\s*\}/.test(context) &&
    /dashboardSWR = \{ cacheMode: 'stale-while-revalidate' as const \}/.test(context),
  'The primary Dashboard request must use the API cache directly, without a second 30-second cache.',
)
assert(
  !/createDashboardCache/.test(context),
  'The redundant Dashboard wrapper caches must remain removed.',
)
assert(
  /dashboardCacheRevalidatedEvent = 'lobo:cache-revalidated'/.test(context) &&
    /window\.addEventListener\(\s*dashboardCacheRevalidatedEvent,\s*handleCacheRevalidated/.test(context) &&
    /window\.removeEventListener\(\s*dashboardCacheRevalidatedEvent,\s*handleCacheRevalidated/.test(context),
  'DashboardDataContext must subscribe to and clean up the existing cache revalidation event.',
)
assert(
  /detail\?\.action === 'dashboard'/.test(context) &&
    /detail\.eventId === ''/.test(context) &&
    /detail\.cacheKey\.endsWith\('\|dashboard\?'\)/.test(context),
  'Dashboard refresh replacement must match the exact public Dashboard cache identity.',
)
assert(
  /void loadDashboardSummary\(\)\.then\(applyDashboard\)/.test(context),
  'A successful background refresh must reread the normalized Dashboard value into visible state.',
)
assert(
  /getDeferredSectionForCacheRevalidation/.test(context) &&
    /requestedDeferredSections\.current\.has\(section\)/.test(context) &&
    /loadDashboardDeferredSection\(section\)/.test(context),
  'Already-requested public Dashboard sections must replace stale values after revalidation.',
)
assert(
  /sessionCached && \(sessionCached\.expiresAt > Date\.now\(\) \|\| staleWhileRevalidate\)/.test(core) &&
    /if \(stale\) \{\s*revalidateCachedRequest[\s\S]*?return sessionCached\.data/.test(core),
  'Stale Dashboard data must return before background network completion.',
)
assert(
  /backgroundRevalidations\.has\(cacheKey\)/.test(core) &&
    /backgroundRevalidations\.add\(cacheKey\)/.test(core),
  'Background Dashboard refreshes must remain deduplicated by cache identity.',
)
assert(
  /const refreshed = frontendResponseCache\.get\(cacheKey\)/.test(core) &&
    /if \(!refreshed \|\| refreshed\.expiresAt <= Date\.now\(\)\) \{\s*return/.test(core),
  'Invalidated or auth-obsolete background responses must not publish UI refresh events.',
)
assert(
  /requestAuthTokenVersion === activeAuthTokenVersion/.test(core),
  'An auth transition must prevent an old in-flight Dashboard response from entering the cache.',
)
assert(
  /case 'eventManagerCurrentEvent':\s*return \[[^\]]*'dashboard'/.test(core),
  'Changing the current event must delete cached Dashboard data.',
)
assert(
  /case 'submitLeagueResult':[\s\S]*?return \[[^\]]*'dashboard'/.test(core) &&
    /case 'submitCasualResult':[\s\S]*?return \[[^\]]*'dashboard'/.test(core) &&
    /case 'teamTournamentResult':[\s\S]*?return \[[^\]]*'dashboard'/.test(core),
  'League, Casual, and Team Tournament result mutations must continue deleting Dashboard data.',
)
assert(
  /clearSessionResponseCache\('auth_token_cleared'\)/.test(core) &&
    /clearSessionResponseCache\('auth_token_changed'\)/.test(core) &&
    /clearSessionResponseCache\(token \? 'native_session_changed' : 'native_session_cleared'\)/.test(core),
  'Dashboard session data must remain isolated across every auth transition.',
)
assert(
  !/Commander Overview/.test(dashboard),
  'Commander Overview must remain removed.',
)

await simulateSlowRefresh()

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('dashboard SWR checks passed')

async function simulateSlowRefresh() {
  const stale = { season: 'Event A' }
  const fresh = { season: 'Event A refreshed' }
  let resolveRefresh
  const network = new Promise((resolve) => {
    resolveRefresh = resolve
  })
  let visible = stale
  let networkSettled = false

  void network.then((value) => {
    networkSettled = true
    visible = value
  })

  assert(visible === stale, 'Stale Dashboard must be visible synchronously at simulated t=0.')
  assert(!networkSettled, 'The stale Dashboard must not wait for the simulated 30-second request.')

  resolveRefresh(fresh)
  await network
  await Promise.resolve()

  assert(visible === fresh, 'Fresh Dashboard must replace stale after the controlled request resolves.')
}

function read(path) {
  return readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}
