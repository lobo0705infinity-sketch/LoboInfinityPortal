import {
  extractAppsScriptDeploymentId,
  normalizeApiUrl,
  parseEnvFile,
  validateReleaseManifest,
  validateReleaseSourceState,
} from './release-utils.mjs'

const failures = []

function expect(condition, message) {
  if (!condition) {
    failures.push(message)
  }
}

const envPairs = parseEnvFile(`
# comment
VITE_API_URL="https://script.google.com/macros/s/DEPLOY/exec/"
IGNORED
VITE_CACHE_VERSION=client-cache-v3
`)

expect(
  envPairs.some(([key, value]) => key === 'VITE_API_URL' && value.endsWith('/exec/')),
  'Release env parser must preserve quoted VITE_API_URL values.',
)

const manifest = {
  appsScriptDeploymentId: 'DEPLOY',
  appsScriptUrl: 'https://script.google.com/macros/s/DEPLOY/exec',
  appsScriptVersion: 1,
}
const state = {
  commit: 'abc123',
}
const matchingEnv = {
  get(name) {
    return {
      VITE_API_URL: 'https://script.google.com/macros/s/DEPLOY/exec/',
    }[name] ?? ''
  },
  source(name) {
    return name === 'VITE_API_URL' ? '.env.local' : ''
  },
}
const matchingManifest = validateReleaseManifest({
  env: matchingEnv,
  manifest,
  state,
})

expect(
  matchingManifest.failures.length === 0,
  'Manifest validation must accept matching Apps Script URLs after normalization.',
)
expect(
  extractAppsScriptDeploymentId(normalizeApiUrl(matchingManifest.actualUrl)) === 'DEPLOY',
  'Manifest validation must expose the resolved Apps Script deployment ID.',
)

const mismatchedManifest = validateReleaseManifest({
  env: {
    get(name) {
      return name === 'VITE_API_URL'
        ? 'https://script.google.com/macros/s/OTHER/exec'
        : ''
    },
    source() {
      return '.env.local'
    },
  },
  manifest,
  state,
})

expect(
  mismatchedManifest.failures.some((failure) => failure.includes('deployment mismatch')),
  'Manifest validation must fail on Apps Script deployment drift.',
)

const dirtyFeatureState = {
  behind: null,
  branch: 'feature/release-candidate',
  commit: 'abc123',
  detached: false,
  status: ' M file',
  upstream: '',
}
const productionSource = validateReleaseSourceState({
  expectedBranch: 'main',
  mode: 'production',
  state: dirtyFeatureState,
})
const candidateSource = validateReleaseSourceState({
  expectedBranch: 'main',
  mode: 'candidate',
  state: dirtyFeatureState,
})

expect(
  productionSource.failures.length >= 3,
  'Production source policy must reject dirty non-main branches without upstream.',
)
expect(
  candidateSource.failures.length === 0 && candidateSource.warnings.length >= 3,
  'Candidate source policy must report warnings without blocking local release-candidate checks.',
)

if (failures.length > 0) {
  console.error('Release tooling regression check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Release tooling regression check passed.')
