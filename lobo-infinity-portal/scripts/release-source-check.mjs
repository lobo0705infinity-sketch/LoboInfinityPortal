import {
  currentGitState,
  fail,
  pass,
  readManifest,
  validateReleaseSourceState,
} from './release-utils.mjs'

const manifest = readManifest()
const state = currentGitState()
const expectedBranch = process.env.PRODUCTION_BRANCH || manifest.productionBranch || 'main'
const mode =
  process.argv.includes('--candidate') ||
  process.env.RELEASE_SOURCE_MODE === 'candidate'
    ? 'candidate'
    : 'production'
const result = validateReleaseSourceState({
  expectedBranch,
  mode,
  state,
})

if (result.failures.length) {
  fail('release source is not approved for production', [
    `branch=${state.branch || '(detached)'}`,
    `commit=${state.commit}`,
    `upstream=${state.upstream || '(none)'}`,
    'Policy: production releases must come from a clean checkout on the approved production branch with upstream configured.',
    'Use `npm run release:source -- --candidate` for a local release-candidate source check before commit/merge.',
    ...result.failures,
  ])
}

result.warnings.forEach((warning) => console.warn(`WARN: ${warning}`))

pass(
  mode === 'candidate'
    ? `release candidate source inspected ${state.branch || '(detached)'}@${state.commit}`
    : `release source is clean ${state.branch}@${state.commit}`,
)
