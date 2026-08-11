import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import vm from 'node:vm'

const baselineCommit = '088a5430fa09b067b6e5c9519713487e34583ed7'
const baselineDecoder = execFileSync(
  'git',
  ['show', `${baselineCommit}:lobo-infinity-portal/backend/ArmyDecoderApi.gs`],
  { encoding: 'utf8' },
)
const currentDecoder = fs.readFileSync('backend/ArmyDecoderApi.gs', 'utf8')
const gateway = fs.readFileSync('backend/CanonicalDecoderGateway.gs', 'utf8')

const resolverHtml = [
  '<h2 class="card-header-title">Army List: Test Resolver</h2>',
  '<div class="army-group-title">Group: 1</div>',
  '<div class="army-list-row"><div>0 SWC 10 pts</div> Unit One </div>',
  '<div class="army-list-footer">',
].join('')

const successfulArmyCode = Buffer.from([
  1,
  4, ...Buffer.from('o-12'),
  4, ...Buffer.from('Test'),
  0x81, 0x2c,
  1,
  1, 1, 0, 1, 0,
  10, 1, 2, 0,
]).toString('base64')

const fixtures = [
  ['empty failure', ''],
  ['encoding failure', 'not*$base64'],
  ['parser failure', 'QQ=='],
  ['successful decode', successfulArmyCode],
]

for (const [label, armyCode] of fixtures) {
  const before = runDecoder({ source: baselineDecoder, expression: 'decodeArmyCode(armyCode)', armyCode })
  const after = runDecoder({
    source: `${currentDecoder}\n${gateway}`,
    expression: 'CanonicalDecoderGateway.decode(armyCode)',
    armyCode,
  })

  assert.deepEqual(after, before, `${label} output changed`)
}

const currentContext = createContext()
vm.runInContext(`${currentDecoder}\n${gateway}`, currentContext)
assert.equal(
  vm.runInContext('CanonicalDecoderGateway.getVersion()', currentContext),
  'army-decoder-v1',
  'decoder version changed',
)

const callers = [
  ['Army Code Validation', 'backend/ArmyCodeValidationApi.gs', 'decodeSubmittedArmyCode'],
  ['Army List diagnostics', 'backend/ArmyListApi.gs', 'diagnoseArmyList'],
  ['Game Engine deterministic snapshots', 'backend/ArmyListApi.gs', 'buildArmyIntelligenceForGameEngineRows'],
  ['Game-submitted Army List registration', 'backend/ArmyListApi.gs', 'appendCanonicalGameSubmittedArmyList'],
  ['Approved Army Intelligence snapshots', 'backend/ArmyIntelligenceApi.gs', 'buildApprovedArmyListIntelligenceRows'],
  ['Army Intelligence snapshot generation', 'backend/ArmyIntelligenceApi.gs', 'buildLegacyArmyIntelligenceSnapshot'],
  ['Team Tournament faction resolution', 'backend/TeamTournamentApi.gs', 'getTeamTournamentArmyCodeFaction'],
  ['Apps Script decoder test entry point', 'backend/ArmyDecoderApi.gs', 'testDecodeArmyCode'],
]

for (const [label, path, functionName] of callers) {
  const source = fs.readFileSync(path, 'utf8')
  const body = extractFunction(source, functionName)
  assert.match(
    body,
    /CanonicalDecoderGateway\.decode\s*\(/,
    `${label} does not delegate to CanonicalDecoderGateway`,
  )
}

const backendSources = fs.readdirSync('backend')
  .filter((file) => file.endsWith('.gs'))
  .map((file) => fs.readFileSync(`backend/${file}`, 'utf8'))
  .join('\n')

assert.doesNotMatch(
  backendSources,
  /\bfunction\s+decodeArmyCode\s*\(/,
  'a second Apps Script decoder interface still exists',
)
assert.equal(
  (backendSources.match(/\bconst\s+CanonicalDecoderGateway\s*=/g) || []).length,
  1,
  'CanonicalDecoderGateway must have exactly one definition',
)

console.log('PASS - Decoder output identical')
console.log('PASS - Decoder failures identical')
console.log('PASS - Decoder version unchanged')
console.log('PASS - Army Code Validation caller delegates')
console.log('PASS - Army List diagnostics caller delegates')
console.log('PASS - Game Engine deterministic snapshot caller delegates')
console.log('PASS - Army Intelligence snapshot caller delegates')
console.log('PASS - Team Tournament faction resolution caller delegates')

function runDecoder({ source, expression, armyCode }) {
  const context = createContext()
  context.armyCode = armyCode
  vm.runInContext(source, context)
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context))
}

function extractFunction(source, name) {
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

function createContext() {
  return vm.createContext({
    ARMY_CODE_VALIDATION_DEFAULTS: {
      resolverUrl: 'https://resolver.example.test/cards',
    },
    Logger: {
      log: () => {},
    },
    UrlFetchApp: {
      fetch: () => ({
        getContentText: () => resolverHtml,
        getResponseCode: () => 200,
      }),
    },
    Utilities: {
      base64Decode: (value) => Array.from(Buffer.from(padBase64(value), 'base64')),
      newBlob: (bytes) => ({
        getDataAsString: () => Buffer.from(
          Array.from(bytes, (value) => value < 0 ? value + 256 : value),
        ).toString('utf8'),
      }),
    },
    canonicalizeArmyParentFaction: (value) => value === 'O 12' ? 'O-12' : value,
  })
}

function padBase64(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  return normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
}
