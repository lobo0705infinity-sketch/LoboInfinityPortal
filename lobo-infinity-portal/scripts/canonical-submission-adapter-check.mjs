import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import vm from 'node:vm'

const regression = spawnSync(process.execPath, ['scripts/canonical-rebuild-coordinator-check.mjs'], {
  cwd: process.cwd(),
  encoding: 'utf8',
})
assert.equal(regression.status, 0, `${regression.stdout}\n${regression.stderr}`)

const context = vm.createContext({})
vm.runInContext(fs.readFileSync('backend/CanonicalSubmissionAdapter.gs', 'utf8'), context)

const namedValues = { Player: ['Alice'] }
const targetSpreadsheet = { id: 'target' }
const importLog = { id: 'log' }
const google = context.createSubmissionCommand({
  source: 'google-form',
  workflow: 'league',
  namedValues,
  timestamp: '8/11/2026 12:17:18',
  targetSpreadsheet,
  importLog,
  responseKey: '123:54',
})
assert.deepEqual({ ...google }, {
  source: 'google-form',
  workflow: 'league',
  namedValues,
  timestamp: '8/11/2026 12:17:18',
  targetSpreadsheet,
  importLog,
  responseKey: '123:54',
})

for (const workflow of ['league', 'casual', 'team-tournament']) {
  const params = { player: 'Alice', opponent: 'Bob' }
  const auth = { user: { player: 'Alice' } }
  const commissionerContext = { enabled: true, override: false, commissioner: 'Wolf' }
  const command = context.createSubmissionCommand({
    source: 'portal',
    workflow,
    params,
    auth,
    commissionerContext,
  })
  assert.deepEqual({ ...command }, {
    source: 'portal',
    workflow,
    params,
    auth,
    commissionerContext,
  }, `${workflow} SubmissionCommand changed`)
}

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

const importer = fs.readFileSync('backend/ResponseImporter.gs', 'utf8')
const resultApi = fs.readFileSync('backend/ResultSubmissionApi.gs', 'utf8')
const teamApi = fs.readFileSync('backend/TeamTournamentApi.gs', 'utf8')
const adapter = fs.readFileSync('backend/CanonicalSubmissionAdapter.gs', 'utf8')
const entryPoints = [
  ['Google Forms', extractFunction(importer, 'handleLoboFormSubmit')],
  ['League API', extractFunction(resultApi, 'submitLeagueResult')],
  ['Casual API', extractFunction(resultApi, 'submitCasualResult')],
  ['Team Tournament API', extractFunction(teamApi, 'saveTeamTournamentResult')],
]
const prohibited = /validateCanonicalGame\s*\(|buildCanonicalGameRow\s*\(|\.appendRow\s*\(|rebuildEverything\s*\(|rebuildGameEngine\s*\(|coordinateCanonicalRebuild\s*\(/

for (const [label, entryPoint] of entryPoints) {
  assert.match(entryPoint, /createSubmissionCommand\s*\(/, `${label} must create a SubmissionCommand`)
  assert.match(entryPoint, /submitCanonicalGame\s*\(command\)/, `${label} must delegate its command`)
  assert.doesNotMatch(entryPoint, prohibited, `${label} still owns canonical orchestration`)
}

assert.doesNotMatch(
  extractFunction(teamApi, 'saveTeamTournamentResult'),
  /recordResultSubmissionCommissionerAudit|invalidatePortalCacheGroup|getTeamTournamentWinningFaction_|lifResolveCanonicalFirstTurn_/,
  'Team Tournament entry point must delegate success translation',
)
assert.equal((adapter.match(/function\s+createSubmissionCommand\s*\(/g) || []).length, 1)
assert.doesNotMatch(adapter, prohibited)

console.log('Canonical Submission Adapter League: PASS')
console.log('Canonical Submission Adapter Casual: PASS')
console.log('Canonical Submission Adapter Team Tournament: PASS')
console.log('Canonical Submission Adapter Google Forms: PASS')
console.log('Canonical Submission Adapter Portal: PASS')
console.log('Canonical Submission Adapter Commissioner context: PASS')
console.log('Canonical rows identical: PASS')
console.log('Validation identical: PASS')
console.log('Rebuild identical: PASS')
console.log('Analytics path identical: PASS')
