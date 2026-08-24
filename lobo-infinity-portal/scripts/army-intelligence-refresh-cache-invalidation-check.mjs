import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const api = read('src/services/api.ts')
const core = read('src/services/apiCore.ts')
const armyIntelligence = read('src/pages/ArmyIntelligence.tsx')
const streams = read('src/pages/StreamedGames.tsx')
const armyLists = read('src/pages/ArmyLists.tsx')

assert.match(
  core,
  /export function invalidateApiCacheGroup\(group: string\) \{\s*invalidateCacheGroups\(\[group\], '', `manual:\$\{group\}`\)\s*\}/,
  'The manual refresh must reuse the existing cache-group deletion boundary.',
)
assert.match(core, /frontendResponseCache\.delete\(key\)/)
assert.match(core, /clearSessionResponseCacheByPredicate\(/)
assert.match(core, /groups\.includes\(entry\.group\)/)

const refreshStart = api.indexOf('export async function refreshArmyIntelligenceSnapshots')
const refreshEnd = api.indexOf('\nfunction normalizeArmyIntelligenceRefreshFailure', refreshStart)
const refresh = api.slice(refreshStart, refreshEnd)
const successCheck = refresh.indexOf("if (!response.ok || payload.success === false)")
const invalidation = refresh.indexOf("invalidateApiCacheGroup('armyIntelligence')")

assert(successCheck >= 0, 'The existing HTTP/application success contract must remain present.')
assert(
  invalidation > successCheck,
  'Army Intelligence cache invalidation must happen only after confirmed worker success.',
)
assert.equal(
  (refresh.match(/invalidateApiCacheGroup\('armyIntelligence'\)/g) ?? []).length,
  1,
  'A successful refresh must perform one local group invalidation.',
)
assert.doesNotMatch(
  refresh.slice(0, successCheck),
  /invalidateApiCacheGroup/,
  'Network and HTTP/application failures must preserve existing cache entries.',
)

const memory = new Map([
  ['summary', { group: 'armyIntelligence' }],
  ['oss', { group: 'armyIntelligence' }],
  ['pano', { group: 'armyIntelligence' }],
  ['legacy', { group: 'armyIntelligence' }],
  ['players', { group: 'players' }],
  ['streams', { group: 'community' }],
])
const session = new Map(memory)

for (const cache of [memory, session]) {
  for (const [key, entry] of cache) {
    if (entry.group === 'armyIntelligence') cache.delete(key)
  }
}

for (const cache of [memory, session]) {
  assert.equal(cache.has('summary'), false)
  assert.equal(cache.has('oss'), false)
  assert.equal(cache.has('pano'), false)
  assert.equal(cache.has('legacy'), false)
  assert.equal(cache.has('players'), true)
  assert.equal(cache.has('streams'), true)
}

assert.doesNotMatch(armyIntelligence, /cacheMode: 'stale-while-revalidate'/)
assert.doesNotMatch(streams, /cacheMode: 'stale-while-revalidate'/)
assert.doesNotMatch(armyLists, /cacheMode: 'stale-while-revalidate'/)

console.log('Army Intelligence refresh cache invalidation regression passed.')
