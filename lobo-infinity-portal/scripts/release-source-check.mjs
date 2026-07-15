import { currentGitState, fail, pass, readManifest } from './release-utils.mjs'

const manifest = readManifest()
const state = currentGitState()
const expectedBranch = process.env.PRODUCTION_BRANCH || manifest.productionBranch || 'main'
const allowNoUpstream = process.env.RELEASE_ALLOW_NO_UPSTREAM === '1'

const failures = []

if (state.detached) {
  failures.push('Current checkout is detached.')
}

if (state.branch !== expectedBranch) {
  failures.push(`Current branch is "${state.branch || '(detached)'}"; expected "${expectedBranch}".`)
}

if (state.status) {
  failures.push('Worktree is dirty. git status --porcelain must be empty.')
}

if (!state.upstream && !allowNoUpstream) {
  failures.push('Current branch has no upstream; cannot prove it is current with remote production branch.')
}

if (state.behind !== null && state.behind > 0) {
  failures.push(`Current branch is behind ${state.upstream} by ${state.behind} commit(s).`)
}

if (failures.length) {
  fail('release source is not approved for production', [
    `branch=${state.branch || '(detached)'}`,
    `commit=${state.commit}`,
    `upstream=${state.upstream || '(none)'}`,
    ...failures,
  ])
}

pass(`release source is clean ${state.branch}@${state.commit}`)
