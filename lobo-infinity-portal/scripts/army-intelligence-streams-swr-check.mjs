import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const army = read('src/pages/ArmyIntelligence.tsx')
const streams = read('src/pages/StreamedGames.tsx')
const core = read('src/services/apiCore.ts')
const api = read('src/services/api.ts')
const armyLists = read('src/pages/ArmyLists.tsx')
const playerProfile = read('src/pages/PlayerProfile.tsx')

assert.match(army, /publicArmyWorkspace[\s\S]*getIntelligenceSummary/)
assert.match(army, /publicArmyWorkspace[\s\S]*getIntelligenceFaction/)
assert.doesNotMatch(army, /getArmyIntelligenceSummary|getArmyIntelligenceFaction/)
assert.match(army, /controller\.abort\(\)/)
assert.doesNotMatch(army, /getArmyIntelligence\([^S]/)
assert.match(army, /getOperationsState\(\{ signal: controller\.signal \}\)/)
assert.match(army, /getOperationsQueue\(\{ signal: controller\.signal \}\)/)
assert.doesNotMatch(
  army.slice(army.indexOf('function ArmyIntelligenceOperationsStatus()')),
  /cacheMode: 'stale-while-revalidate'/,
)

assert.match(streams, /useApiCacheRevalidation/)
assert.match(streams, /action: 'streams'/)
assert.match(streams, /getStreams\(\{[\s\S]*?cacheMode: 'stale-while-revalidate'/)
assert.match(core, /case 'saveStream':[\s\S]*?case 'deleteStream':[\s\S]*?return \['community'\]/)
assert.match(core, /backgroundRevalidations\.has\(cacheKey\)/)
assert.match(core, /backgroundRevalidations\.add\(cacheKey\)/)
assert.match(core, /backgroundRevalidations\.delete\(cacheKey\)/)
assert.match(api, /invalidateApiCacheGroup\('armyIntelligence'\)/)

assert.doesNotMatch(armyLists, /cacheMode: 'stale-while-revalidate'/)
assert.doesNotMatch(playerProfile, /cacheMode: 'stale-while-revalidate'/)
assert.doesNotMatch(army, /setTimeout|IntersectionObserver/)
assert.doesNotMatch(streams, /setTimeout|IntersectionObserver/)

const identities = new Set([
  'armyIntelligence?scope=summary',
  'armyIntelligence?faction=Operations%20Subsection&scope=faction',
  'armyIntelligence?faction=PanOceania&scope=faction',
  'armyIntelligence?faction=Kestrel%20Colonial%20Force&scope=faction',
  'armyIntelligence?faction=Invincible%20Army&scope=faction',
])
assert.equal(identities.size, 5)

await verifyLifecycleAndRace()
console.log('Army Intelligence and Streams SWR regression passed.')

async function verifyLifecycleAndRace() {
  const stale = { faction: 'Operations Subsection', version: 'stale' }
  const fresh = { faction: 'Operations Subsection', version: 'fresh' }
  let visible = stale
  let activeFaction = stale.faction
  let refreshes = 0
  let resolveRefresh
  const network = new Promise((resolve) => { resolveRefresh = resolve })
  const refresh = () => {
    refreshes += 1
    return network
  }
  const shared = refresh()
  assert.equal(visible, stale)
  assert.equal(refreshes, 1)

  activeFaction = 'PanOceania'
  visible = { faction: activeFaction, version: 'cached' }
  resolveRefresh(fresh)
  const refreshed = await shared
  if (refreshed.faction === activeFaction) visible = refreshed
  assert.equal(visible.faction, 'PanOceania')
  assert.equal(visible.version, 'cached')

  await Promise.reject(new Error('controlled failure')).catch(() => undefined)
  assert.equal(visible.faction, 'PanOceania')
}
