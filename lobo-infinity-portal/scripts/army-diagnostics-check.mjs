import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const backendApi = read('backend/ArmyListApi.gs')
const decoderApi = read('backend/ArmyDecoderApi.gs')
const router = read('backend/API.gs')
const clientApi = read('src/services/api.ts')
const armyListsPage = read('src/pages/ArmyLists.tsx')
const validationApi = read('backend/ArmyCodeValidationApi.gs')
const decoderGateway = read('backend/CanonicalDecoderGateway.gs')
const intelligenceApi = read('backend/ArmyIntelligenceApi.gs')
const scheduler = read('backend/ArmyIntelligenceScheduler.gs')
const snapshotFactory = read('backend/CanonicalSnapshotFactory.gs')
const standaloneDecoder = read('scripts/infinity-army-decode.mjs')
const worker = read('api/army-intelligence-refresh-worker.mjs')

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
    /decodeArmyListToFiles[\s\S]*decodeArmyCode[\s\S]*decoderVersion:[\s\S]*combatGroups:[\s\S]*totals,[\s\S]*warnings/,
    'standalone production decoder must produce versioned groups, totals, profiles, and warnings.',
  ],
  [
    /getPersistedArmyDiagnosticSharedDecode\(source\.list\)/,
    'Apps Script diagnostics must use local structure and persisted Army Intelligence.',
  ],
  [
    /decodeSubmittedArmyCode\(value\)[\s\S]*return decodeSubmittedArmyCodeStructurally\(value\)/,
    'Apps Script validation must remain zero-network.',
  ],
  [
    /validateStoredArmyCodeForDiagnostics[\s\S]*empty[\s\S]*truncated[\s\S]*invalidCharacters[\s\S]*whitespaceCorruption[\s\S]*clipboardTruncation[\s\S]*duplicateEncoding[\s\S]*missingFooter/,
    'stored Army Code validation must cover corruption and truncation modes.',
  ],
  [
    /canonicalDecoderGatewayBuildParserFailure_[\s\S]*badToken[\s\S]*location[\s\S]*unexpectedEof[\s\S]*unknownSkill[\s\S]*unknownTroop[\s\S]*unknownWeapon/,
    'canonical gateway parser failures must expose exact failure categories.',
  ],
  [
    /parserTrace\.push\(buildArmyDecoderTrace/,
    'decoder must emit per-unit parser trace entries.',
  ],
  [
    /createSourceRefreshSnapshot\(source, decoded, error, status\)[\s\S]*decoded:\s*decoded[\s\S]*decoderVersion:[\s\S]*decoded\.decoderVersion/,
    'canonical snapshots must retain the standalone decoder payload and version.',
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
  [
    /from '\.\.\/scripts\/infinity-army-decode\.mjs'[\s\S]*decodeArmyListToFiles\(\{[\s\S]*input: source\.armyCode/,
    'Vercel worker must own production decoding through the standalone decoder.',
  ],
  [
    /loadAuthoritativeSources[\s\S]*armyIntelligenceSources/,
    'Vercel worker must load protected authoritative Army Intelligence sources.',
  ],
  [
    /CanonicalSnapshotFactory\.createSourceRefreshSnapshot[\s\S]*postSnapshots/,
    'Vercel worker must construct canonical snapshots before persistence.',
  ],
  [
    /case "refreshArmyIntelligence"[\s\S]*requireArmyIntelligenceWorkerOrPermission/,
    'snapshot ingestion must remain worker-or-Commissioner protected.',
  ],
  [
    /validateArmyIntelligenceRefreshSnapshot[\s\S]*identity mismatch[\s\S]*decoder version mismatch[\s\S]*Army Code mismatch/,
    'snapshot persistence must validate identity, decoder version, and Army Code hash.',
  ],
  [
    /getArmyIntelligence\(e\)[\s\S]*readArmyIntelligenceReadModelPayload/,
    'Army Intelligence reads must consume the persisted read model.',
  ],
  [
    /ARMY_INTELLIGENCE_SCHEDULER_URL[\s\S]*army-intelligence-refresh-worker[\s\S]*runScheduledMaintenanceWorker_/,
    'Apps Script scheduler must invoke the protected Vercel worker.',
  ],
  [
    /Persisted Army Intelligence snapshot is missing/,
    'missing snapshots must remain explicit instead of synchronously decoding.',
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
  const text = `${backendApi}\n${decoderApi}\n${validationApi}\n${decoderGateway}\n${intelligenceApi}\n${scheduler}\n${snapshotFactory}\n${standaloneDecoder}\n${worker}\n${router}\n${clientApi}\n${armyListsPage}`
  pattern.lastIndex = 0
  return text
}
