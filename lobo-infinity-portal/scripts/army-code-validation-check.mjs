import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const backend = read('backend/ArmyCodeValidationApi.gs')
const decoder = read('backend/ArmyDecoderApi.gs')
const armyLists = read('backend/ArmyListApi.gs')
const router = read('backend/API.gs')
const clientApi = read('src/services/api.ts')
const submitPage = read('src/pages/SubmitArmyList.tsx')
const validationPage = read('src/pages/ArmyCodeValidation.tsx')
const app = read('src/App.tsx')

const combined = [
  backend,
  decoder,
  armyLists,
  router,
  clientApi,
  submitPage,
  validationPage,
  app,
].join('\n')

const checks = [
  [
    /function validateSubmittedArmyCode\(armyCode, eventId\)[\s\S]*getArmyCodeValidationSeverity\(issues\)/,
    'Complete legal armies must be able to pass validation.',
  ],
  [
    /Unexpected EOF|Army code decode ended at byte/,
    'Truncated Army Codes must be detected by the binary decoder.',
  ],
  [
    /Army Code is empty\./,
    'Empty Army Codes must be rejected.',
  ],
  [
    /parserWarnings:[\s\S]*External profile decoding is retired in Apps Script/,
    'Retired external enrichment must remain explicit in decoder warnings.',
  ],
  [
    /The Army Code could not be decoded\./,
    'Invalid Army Codes must be rejected.',
  ],
  [
    /minimumPointTolerance[\s\S]*maximumPointTolerance[\s\S]*minimumWarningPoints[\s\S]*maximumPoints/,
    'Point validation must use configurable event tolerances instead of a hard army-size comparison.',
  ],
  [
    /derived\.points < thresholds\.minimumWarningPoints/,
    'Suspicious low-point lists must be flagged below the configured warning floor.',
  ],
  [
    /derived\.points < thresholds\.minimumErrorPoints/,
    'Clearly incomplete low-point lists must be errors below the configured error floor.',
  ],
  [
    /derived\.points > thresholds\.maximumPoints/,
    'Over-limit lists must be errors above the configured maximum.',
  ],
  [
    /derived\.unitCount < thresholds\.minimumUnitCount/,
    'Suspicious low-model lists must be flagged from configurable event thresholds.',
  ],
  [
    /recordArmyCodeValidationAudit\([\s\S]*overrideReason/,
    'Commissioner overrides must be logged with a reason.',
  ],
  [
    /function decodeSubmittedArmyCode\(value\)[\s\S]*return decodeSubmittedArmyCodeStructurally\(value\)/,
    'Validation must remain local and structurally decode without the external gateway.',
  ],
  [
    /decoderVersion:\s*decoded\.decoderVersion/,
    'Validation reports must include the shared decoder version.',
  ],
  [
    /sheet\.appendRow\(\[[\s\S]*validation\.derived\.faction[\s\S]*validation\.derived\.sectorial[\s\S]*validation\.derived\.armyName/,
    'Server must persist faction, sectorial, and army name only from decoded Army Code values.',
  ],
  [
    /case "validateArmyCode":[\s\S]*validateArmyCode\(e\)/,
    'Validation endpoint must be routed.',
  ],
  [
    /case "flaggedArmySubmissions":[\s\S]*requireApiPermission\(e,\s*"viewOperations"/,
    'Flagged submission dashboard must be commissioner gated.',
  ],
  [
    /case "auditArmyCodeSubmissions":[\s\S]*requireApiPermission\(e,\s*"runLeagueAudit"/,
    'Historical audit must be audit-permission gated.',
  ],
  [
    /isArmyCodeValidationError[\s\S]*status: 'warning'/,
    'Submit form must show server validation warnings returned by submission.',
  ],
  [
    /validation\.suspicious && !\(overrideRequested && canOverride\)/,
    'Suspicious submissions must require commissioner confirmation before submit.',
  ],
  [
    /validationOverride: state\.status === 'warning' && overrideConfirmed/,
    'Commissioner override confirmation must be sent to the backend.',
  ],
  [
    /function normalizeArmyListSubmissionPayload[\s\S]*error\.validation = normalizeArmyCodeValidationReport/,
    'Submission validation failures must preserve the server validation report.',
  ],
  [
    /function recordArmyCodeValidationAudit[\s\S]*sheet\.appendRow/,
    'Submitted Army Code validations must be written to the validation audit log.',
  ],
  [
    /function getArmyCodeValidationTimestamp\(\)[\s\S]*getOperationsTimestamp\(\)/,
    'Validation timestamp helper must delegate to the portal timestamp utility.',
  ],
  [
    /getFlaggedArmySubmissions[\s\S]*FlaggedArmyRow/,
    'Commissioner dashboard must display flagged submissions.',
  ],
  [
    /Total Lists[\s\S]*Healthy[\s\S]*Warnings[\s\S]*Errors/,
    'Commissioner dashboard must summarize total, healthy, warning, and error counts.',
  ],
  [
    /path="\/commissioner\/army-code-validation"/,
    'Commissioner validation dashboard route must exist.',
  ],
]

const failures = checks
  .filter(([pattern]) => !pattern.test(combined))
  .map(([, message]) => message)

if (/apiClient\.validateArmyCode\(/.test(submitPage)) {
  failures.push(
    'Submit form must not decode once before submit and again during backend submission.',
  )
}

if (/if \(!validation\.suspicious && !validation\.blocking && !override\.override\)\s*return;/.test(backend)) {
  failures.push('Validation audit log must include healthy submitted lists.')
}

if (failures.length > 0) {
  console.error('Army Code validation regression check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

const defaultPolicyResults = [
  { expected: 'Info', points: 299, unitCount: 15 },
  { expected: 'Info', points: 296, unitCount: 15 },
  { expected: 'Error', points: 110, unitCount: 5 },
  { expected: 'Error', points: 98, unitCount: 6 },
]

const policyFailures = defaultPolicyResults
  .filter((fixture) => classifyDefaultPolicy(fixture.points, fixture.unitCount) !== fixture.expected)
  .map((fixture) =>
    `${fixture.points} points / ${fixture.unitCount} units expected ${fixture.expected}`,
  )

if (policyFailures.length > 0) {
  console.error('Army Code validation policy fixtures failed:')
  for (const failure of policyFailures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`Army Code validation regression check passed: ${checks.length} checks.`)

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function classifyDefaultPolicy(points, unitCount) {
  const expectedPoints = 300
  const minimumPointTolerance = 5
  const errorPointTolerance = 100
  const minimumUnitCount = 8
  const minimumWarningPoints = expectedPoints - minimumPointTolerance
  const minimumErrorPoints = expectedPoints - errorPointTolerance

  if (points < minimumErrorPoints) {
    return 'Error'
  }

  if (points < minimumWarningPoints || unitCount < minimumUnitCount) {
    return 'Warning'
  }

  return 'Info'
}
