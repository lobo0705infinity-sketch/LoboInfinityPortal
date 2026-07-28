import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const backendApi = read('backend/ArmyListApi.gs')
const decoderApi = read('backend/ArmyDecoderApi.gs')
const router = read('backend/API.gs')
const clientApi = read('src/services/api.ts')
const armyListsPage = read('src/pages/ArmyLists.tsx')
const validationApi = read('backend/ArmyCodeValidationApi.gs')

const checks = [
  [
    /function diagnoseArmyList\(e\)/,
    'diagnoseArmyList backend endpoint must exist.',
  ],
  [
    /case "diagnoseArmyList":[\s\S]*requireApiPermission\(e,\s*"viewOperations"/,
    'diagnoseArmyList must be commissioner/operations gated.',
  ],
  [
    /function decodeArmyCode\(value\)[\s\S]*decoderVersion[\s\S]*parserWarnings[\s\S]*parserTrace[\s\S]*roster/,
    'shared production decoder must produce roster, warnings, traces, and version metadata.',
  ],
  [
    /decodeArmyCode\(source\.list\.armyCode\)/,
    'diagnostics must use the shared production decoder.',
  ],
  [
    /decodeSubmittedArmyCode\(value\)[\s\S]*return decodeArmyCode\(value\)/,
    'validation must use the shared production decoder.',
  ],
  [
    /validateStoredArmyCodeForDiagnostics[\s\S]*empty[\s\S]*truncated[\s\S]*invalidCharacters[\s\S]*whitespaceCorruption[\s\S]*clipboardTruncation[\s\S]*duplicateEncoding[\s\S]*missingFooter/,
    'stored Army Code validation must cover corruption and truncation modes.',
  ],
  [
    /buildArmyDecoderParserFailure[\s\S]*badToken[\s\S]*location[\s\S]*unexpectedEof[\s\S]*unknownSkill[\s\S]*unknownTroop[\s\S]*unknownWeapon/,
    'parser failures must expose exact failure categories.',
  ],
  [
    /parserTrace\.push\(buildArmyDecoderTrace/,
    'decoder must emit per-unit parser trace entries.',
  ],
  [
    /unitCount:\s*decoded\.unitCount[\s\S]*points:\s*decoded\.points[\s\S]*swc:\s*decoded\.swc/,
    'snapshot unit count and points must come from the shared decoder.',
  ],
  [
    /decoderVersion:\s*decoded\.decoderVersion/,
    'diagnostic snapshots must persist decoderVersion.',
  ],
  [
    /compareArmyDiagnosticDecodeToDisplay[\s\S]*missingUnits[\s\S]*unexpectedUnits[\s\S]*missingPoints[\s\S]*missingSwc/,
    'diagnostic comparison must report missing and unexpected units, points, and SWC.',
  ],
  [
    /invalidatePortalCacheGroup\("armyLists"\)/,
    'self-healing must invalidate only the armyLists cache group.',
  ],
  [
    /diagnoseArmyList\([^)]*displayedUnits[\s\S]*postRequest\('diagnoseArmyList'/,
    'frontend API must send displayed units to the diagnostic endpoint.',
  ],
  [
    /normalizeArmyDiagnosticPayload[\s\S]*profiles:[\s\S]*trace:[\s\S]*parserFailure:/,
    'frontend must normalize decoder profiles, trace, and parser failures.',
  ],
  [
    /Decoder/,
    'frontend diagnostic report must display decoder version metadata.',
  ],
  [
    /Diagnose Army/,
    'Commissioner Diagnose Army button/report must render on the Army Lists page.',
  ],
  [
    /<DiagnosticList title="Missing" values=\{report\.comparison\.missingUnits\}/,
    'frontend report must display every missing unit returned by the API.',
  ],
  [
    /getDisplayedArmyUnits\(list\)/,
    'diagnostic request must be tied to the currently displayed army row.',
  ],
]

const failures = checks
  .filter(([pattern]) => !pattern.test(sourceFor(pattern)))
  .map(([, message]) => message)

const forbiddenDuplicatePatterns = [
  [/function decodeArmyCodeForDiagnostics\(/, 'diagnostics-specific Army Code decoder must not exist.'],
  [/function decodeArmyDiagnosticJsonPayload\(/, 'diagnostics-specific JSON parser must not exist.'],
  [/function decodeArmyDiagnosticPlainPayload\(/, 'diagnostics-specific plain-text parser must not exist.'],
  [/function resolveArmyCodeValidationProfiles\(/, 'validation-specific Infinity Data resolver must not exist.'],
  [/function parseArmyCodeValidationCost\(/, 'validation-specific cost parser must not exist.'],
]

for (const [pattern, message] of forbiddenDuplicatePatterns) {
  if (pattern.test(sourceFor(pattern))) {
    failures.push(message)
  }
}

const backendSources = `${backendApi}\n${decoderApi}\n${validationApi}`
const parserImplementations = (backendSources.match(/function parseArmyCodeBinary\(/g) || []).length
const resolverImplementations = (backendSources.match(/function resolveArmyCodeProfiles\(/g) || []).length

if (parserImplementations !== 1) {
  failures.push(`Expected exactly one Army Code binary parser, found ${parserImplementations}.`)
}

if (resolverImplementations !== 1) {
  failures.push(`Expected exactly one Infinity Data resolver, found ${resolverImplementations}.`)
}

if (failures.length > 0) {
  console.error('Army diagnostics regression check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`Army diagnostics regression check passed: ${checks.length} checks.`)

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function sourceFor(pattern) {
  const text = `${backendApi}\n${decoderApi}\n${validationApi}\n${router}\n${clientApi}\n${armyListsPage}`
  pattern.lastIndex = 0
  return text
}
