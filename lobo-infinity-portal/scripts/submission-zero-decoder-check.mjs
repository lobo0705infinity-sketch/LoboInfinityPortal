import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const validationSource = readFileSync('backend/ArmyCodeValidationApi.gs', 'utf8')
const armyListSource = readFileSync('backend/ArmyListApi.gs', 'utf8')
const tournamentSource = readFileSync('backend/TeamTournamentApi.gs', 'utf8')
const canonicalSource = readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')

const selected = [
  extractFunction(validationSource, 'validateArmyCode'),
  extractFunction(validationSource, 'validateSubmittedArmyCodeWithoutExternalDecode'),
  extractFunction(validationSource, 'buildSubmittedArmyCodeValidationReport'),
  extractFunction(validationSource, 'buildPendingSubmittedArmyCodeValidation'),
  extractFunction(validationSource, 'buildArmyCodeValidationIssue'),
  extractFunction(validationSource, 'getArmyCodeValidationSeverity'),
  extractFunction(armyListSource, 'submitArmyList'),
  extractFunction(tournamentSource, 'getTeamTournamentArmyCodeFaction'),
].join('\n')

let decoderCalls = 0
let persisted = null
const appended = []
const structural = {
  decoder: 'local-structural', decoderVersion: 'army-decoder-v1', exceptions: [], valid: true,
  warnings: [], derived: {
    armyName: 'Local Army', combatGroups: 2, faction: 'ALEPH', points: 0,
    sectorial: 'OSS', swc: 0, unitCount: 10,
  },
}
const sandbox = {
  Array, Boolean, Date, JSON, Number, Object, String,
  getApiParameters: (event) => event,
  getApiParameter: (parameters, key) => String(parameters[key] ?? '').trim(),
  getRequestUser: () => ({ authenticated: true, user: { email: 'player@example.com' } }),
  getCanonicalPlayerFromUser: () => 'Lobo',
  getArmyListBooleanParameter: () => false,
  requireApiPermission: () => false,
  getArmyListSheet: () => ({ appendRow: (row) => appended.push(row) }),
  Utilities: { formatDate: () => '2026-09-03' },
  Session: { getScriptTimeZone: () => 'America/New_York' },
  recordArmyCodeValidationAudit: () => {},
  invalidatePortalCacheGroup: () => {},
  jsonOutput: (value) => value,
  getOperationsTimestamp: () => '2026-09-03T12:00:00.000Z',
  getArmyCodeValidationTimestamp: () => '2026-09-03T12:00:00.000Z',
  getArmyCodeValidationThresholds: () => ({
    minimumErrorPoints: 0, minimumWarningPoints: 0, maximumPoints: 0, minimumUnitCount: 0,
  }),
  getArmyCodeValidationString: (value) => String(value ?? '').trim(),
  buildCanonicalArmyCodeArmyListId: (code) => `id:${code}`,
  getPersistedArmyIntelligenceSnapshotLookup: () => ({}),
  getPersistedCanonicalArmyListDecode: () => persisted,
  decodeSubmittedArmyCodeStructurally: () => structural,
  getTeamTournamentString: (value) => String(value ?? '').trim(),
  canonicalizeArmyName: (value) => String(value ?? '').trim(),
  decodeSubmittedArmyCode() { decoderCalls += 1; throw new Error('legacy submitted decoder reached') },
  CanonicalDecoderGateway: { decode() { decoderCalls += 1; throw new Error('gateway reached') } },
  resolveArmyCodeProfiles() { decoderCalls += 1; throw new Error('profiles reached') },
  UrlFetchApp: { fetch() { decoderCalls += 1; throw new Error('UrlFetch reached') } },
}

vm.createContext(sandbox)
vm.runInContext(selected, sandbox)

const pendingValidation = sandbox.validateArmyCode({ armyCode: 'new-code', event: 'league' })
assert.equal(pendingValidation.validation.status, 'pending')
assert.equal(pendingValidation.validation.valid, true)
assert.equal(pendingValidation.validation.blocking, false)

const submitted = sandbox.submitArmyList({ armyCode: 'new-code', event: 'league', player: 'Lobo' })
assert.equal(submitted.success, true)
assert.equal(submitted.validation.status, 'pending')
assert.equal(appended.length, 1)

persisted = {
  valid: true, parserWarnings: [], derived: {
    armyName: 'Persisted OSS', combatGroups: 2, faction: 'ALEPH', points: 300,
    sectorial: 'OSS', swc: 6, unitCount: 10,
  },
}
const decodedValidation = sandbox.validateArmyCode({ armyCode: 'known-code', event: 'league' })
assert.equal(decodedValidation.validation.status, 'info')
assert.equal(decodedValidation.validation.derived.points, 300)
assert.equal(sandbox.getTeamTournamentArmyCodeFaction('known-code'), 'OSS')

persisted = null
assert.equal(sandbox.getTeamTournamentArmyCodeFaction('new-code'), 'OSS')
assert.equal(decoderCalls, 0)

const validateEndpoint = extractFunction(validationSource, 'validateArmyCode')
const submit = extractFunction(armyListSource, 'submitArmyList')
const teamFaction = extractFunction(tournamentSource, 'getTeamTournamentArmyCodeFaction')
assert.match(validateEndpoint, /validateSubmittedArmyCodeWithoutExternalDecode/)
assert.match(submit, /validateSubmittedArmyCodeWithoutExternalDecode/)
assert.doesNotMatch(validateEndpoint + submit + teamFaction, /decodeSubmittedArmyCode\s*\(|CanonicalDecoderGateway|resolveArmyCodeProfiles|UrlFetchApp/)
assert.match(
  extractFunction(canonicalSource, 'canonicalSubmitPortalTeamTournamentGame_'),
  /canonicalizeArmyName\(params\.playerFaction\)[\s\S]*getTeamTournamentArmyCodeFaction\(playerArmyCode\)/,
)

console.log('Normal submission zero-decoder regression passed.')
console.log('PASS - validation, Army List submission, and Team Tournament faction resolution made zero decoder fetches')

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `missing function ${name}`)
  const open = text.indexOf('{', start)
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = open; index < text.length; index += 1) {
    const character = text[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; continue }
    if (character === '{') depth += 1
    if (character === '}' && --depth === 0) return text.slice(start, index + 1)
  }
  throw new Error(`unterminated function ${name}`)
}
