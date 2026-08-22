import { readFileSync } from 'node:fs'

const source = readFileSync('src/services/data/index.ts', 'utf8')
const failures = []

for (const implementation of [
  '../../firebase/firebaseConfig',
  './providers/FirestoreBootstrap',
  './providers/FirestoreMigrationService',
  './providers/FirestoreMigrationVerification',
]) {
  const escaped = implementation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assert(
    !new RegExp(`^import (?!type\\b)\\{[^;]*from ['\"]${escaped}['\"]`, 'ms').test(source),
    `${implementation} must not be statically imported by the Google provider entry point.`,
  )
  assert(
    source.includes(`import('${implementation}')`) ||
      source.includes(`import(\n    '${implementation}'`),
    `${implementation} must retain an explicit lazy import.`,
  )
}

assert(
  /import \{ googleSheetsProvider \} from '\.\/providers\/GoogleSheetsProvider'/.test(source),
  'The Google Sheets provider must remain a synchronous static dependency.',
)
assert(
  /export const dataProvider = selectDataProvider\(configuredProvider\)/.test(source),
  'Provider selection must remain synchronous.',
)
assert(
  /import\('\.\/providers\/DualCompareProvider'\)/.test(source),
  'Dual-provider diagnostics must be loaded lazily.',
)
assert(
  !/^import (?!type\b).*['"]\.\/providers\/(?:DualCompareProvider|FirestoreProvider)['"]/m.test(
    source,
  ),
  'Alternate provider implementations must not be static dependencies.',
)
assert(
  /export async function runDataMigrationToFirestore\(\)[\s\S]*import\([\s\S]*FirestoreMigrationService/.test(source),
  'Migration execution must retain its lazy entry point.',
)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('lazy data-provider checks passed')

function assert(condition, message) {
  if (!condition) failures.push(message)
}
