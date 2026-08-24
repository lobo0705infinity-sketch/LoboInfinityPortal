import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const core = read('src/services/apiCore.ts')
const hook = read('src/hooks/useApiCacheRevalidation.ts')
const dashboard = read('src/contexts/DashboardDataContext.tsx')
const migratedPages = {
  missions: read('src/pages/Missions.tsx'),
  mission: read('src/pages/MissionProfile.tsx'),
  players: read('src/pages/Players.tsx'),
  factions: read('src/pages/Factions.tsx'),
  faction: read('src/pages/FactionProfile.tsx'),
  hallOfFame: read('src/pages/HallOfFame.tsx'),
}
const excludedPages = [
  'src/pages/PlayerProfile.tsx',
  'src/pages/ArmyIntelligence.tsx',
  'src/pages/SubmitResult.tsx',
  'src/pages/Schedule.tsx',
  'src/pages/CommissionerDashboard.tsx',
].map(read)

assert.match(core, /cacheMode\?: 'fresh-required' \| 'stale-while-revalidate'/)
assert.match(core, /const staleWhileRevalidate = options\.cacheMode === 'stale-while-revalidate'/)
assert.match(
  core,
  /sessionCached && \(sessionCached\.expiresAt > Date\.now\(\) \|\| staleWhileRevalidate\)/,
  'Stale session entries must be returned only for explicit SWR requests.',
)
assert.match(core, /backgroundRevalidations\.has\(cacheKey\)/)
assert.match(core, /backgroundRevalidations\.add\(cacheKey\)/)
assert.match(core, /backgroundRevalidations\.delete\(cacheKey\)/)
assert.match(core, /detail\.cacheKey === buildSessionCacheKey\(action, params\)/)
assert.match(core, /frontendResponseCache\.delete\(key\)/)
assert.match(core, /window\.sessionStorage\.removeItem/)

assert.match(hook, /isApiCacheRevalidation\(event, action, exactParams\)/)
assert.match(hook, /readRef\.current\(\)/)
assert.match(hook, /if \(active\)/)
assert.match(hook, /window\.removeEventListener/)

for (const [action, page] of Object.entries(migratedPages)) {
  assert.match(page, /cacheMode: 'stale-while-revalidate'/, `${action} must opt into SWR.`)
  assert.match(page, new RegExp(`action: '${action}'`), `${action} must subscribe to its exact refresh identity.`)
  assert.match(page, /useApiCacheRevalidation/, `${action} must reactively replace stale data.`)
  assert.doesNotMatch(page, /setTimeout\([\s\S]{0,120},\s*[1-9]\d{2,}\s*\)/, `${action} must not impose a material render timer.`)
}

assert.match(dashboard, /dashboardSWR = \{ cacheMode: 'stale-while-revalidate' as const \}/)
for (const page of excludedPages) {
  assert.doesNotMatch(page, /cacheMode: 'stale-while-revalidate'/)
}

await verifyControlledSWRLifecycle()

console.log('Public read opt-in SWR regression passed.')

async function verifyControlledSWRLifecycle() {
  const stale = { version: 'stale' }
  const fresh = { version: 'fresh' }
  let visible = stale
  let refreshes = 0
  let resolveRefresh
  const network = new Promise((resolve) => { resolveRefresh = resolve })

  const refresh = () => {
    refreshes += 1
    return network
  }
  const sharedRefresh = refresh()
  const secondConsumerRefresh = sharedRefresh

  assert.equal(visible, stale, 'Stale content must be available before the controlled network resolves.')
  assert.equal(refreshes, 1, 'Two consumers of one identity must share one refresh.')
  assert.equal(sharedRefresh, secondConsumerRefresh)

  resolveRefresh(fresh)
  visible = await sharedRefresh
  assert.equal(visible, fresh, 'Fresh content must replace stale after revalidation.')

  visible = stale
  await Promise.reject(new Error('controlled failure')).catch(() => undefined)
  assert.equal(visible, stale, 'A failed refresh must retain stale content.')
}
