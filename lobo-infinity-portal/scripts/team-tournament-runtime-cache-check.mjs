import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import vm from 'node:vm'

const regression = spawnSync(process.execPath, ['scripts/canonical-submission-adapter-check.mjs'], {
  cwd: process.cwd(),
  encoding: 'utf8',
})
assert.equal(regression.status, 0, `${regression.stdout}\n${regression.stderr}`)

const extractFunction = (source, name) => {
  const start = source.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `${name} must exist`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  assert.fail(`${name} must have a balanced body`)
}

const teamSource = fs.readFileSync('backend/TeamTournamentApi.gs', 'utf8')
const submissionSource = fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
const removedKeys = []
const invalidatedGroups = []
const context = vm.createContext({
  PORTAL_CACHE_PREFIX: 'portal:v2.0.8:',
  getPortalCacheVersion: () => 'version-1',
  getPortalStaleCacheKey: (key) => `${key}:stale`,
  CacheService: {
    getScriptCache: () => ({
      removeAll: (keys) => removedKeys.push(...keys),
    }),
  },
  invalidatePortalCacheGroup: (group) => invalidatedGroups.push(group),
  encodeURIComponent,
})

vm.runInContext(
  [
    extractFunction(teamSource, 'getTeamTournamentRuntimeCacheKey'),
    extractFunction(teamSource, 'invalidateTeamTournamentRuntimeCache'),
  ].join('\n'),
  context,
)

context.invalidateTeamTournamentRuntimeCache('event-team-1')

const runtimeKey = 'portal:v2.0.8:version-1:teamTournamentRuntime:event-team-1'
assert.deepEqual(removedKeys, [runtimeKey, `${runtimeKey}:stale`])
assert.deepEqual(invalidatedGroups, ['events'])

const googleSubmission = extractFunction(submissionSource, 'canonicalSubmitGoogleFormGame_')
const portalTeamSubmission = extractFunction(
  submissionSource,
  'canonicalSubmitPortalTeamTournamentGame_',
)
const portalGameSubmission = extractFunction(submissionSource, 'canonicalSubmitPortalGame_')

assert.match(
  googleSubmission,
  /coordinateCanonicalRebuild\s*\([\s\S]*?workflow\s*===\s*"team-tournament"[\s\S]*?invalidateTeamTournamentRuntimeCache\s*\(\s*submission\.eventId\s*\)/,
)
assert.match(
  portalTeamSubmission,
  /coordinateCanonicalRebuild\s*\([\s\S]*?invalidateTeamTournamentRuntimeCache\s*\(\s*validation\.value\.eventId\s*\)/,
)
assert.doesNotMatch(portalGameSubmission, /invalidateTeamTournamentRuntimeCache\s*\(/)

console.log('League cache behavior unchanged: PASS')
console.log('Casual cache behavior unchanged: PASS')
console.log('Team Tournament API response cache invalidation: PASS')
console.log('Team Tournament runtime cache invalidation: PASS')
console.log('Team Tournament post-rebuild invalidation order: PASS')
console.log('Historical canonical games refresh on next request: PASS')
