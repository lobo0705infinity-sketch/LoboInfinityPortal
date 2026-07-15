import {
  currentGitState,
  extractAppsScriptDeploymentId,
  fail,
  fingerprint,
  normalizeApiUrl,
  pass,
  readManifest,
} from './release-utils.mjs'

const manifest = readManifest()
const state = currentGitState()
const expectedUrl = normalizeApiUrl(manifest.appsScriptUrl)
const actualUrl = normalizeApiUrl(process.env.VITE_API_URL)
const actualDeploymentId = extractAppsScriptDeploymentId(actualUrl)
const failures = []

if (!actualUrl) {
  failures.push('VITE_API_URL is missing or empty.')
}

if (actualUrl && actualUrl !== expectedUrl) {
  failures.push(`VITE_API_URL does not match release/production.json. expected=${expectedUrl} actual=${actualUrl}`)
}

if (actualDeploymentId !== manifest.appsScriptDeploymentId) {
  failures.push(`Apps Script deployment mismatch. expected=${manifest.appsScriptDeploymentId} actual=${actualDeploymentId || '(none)'}`)
}

if (!Number.isInteger(manifest.appsScriptVersion) || manifest.appsScriptVersion <= 0) {
  failures.push('appsScriptVersion must be a positive versioned deployment number.')
}

const commitMetadata =
  process.env.VITE_BUILD_GIT_COMMIT ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  state.commit

if (!commitMetadata || commitMetadata === 'not-provided') {
  failures.push('Git commit metadata is missing.')
}

const deploymentMetadata =
  process.env.VITE_BUILD_DEPLOYMENT_ID ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_DEPLOYMENT_URL ||
  ''

if (process.env.RELEASE_REQUIRE_DEPLOYMENT_ID === '1' && (!deploymentMetadata || deploymentMetadata === 'not-provided')) {
  failures.push('Deployment metadata is missing.')
}

if (failures.length) {
  fail('release manifest/API alignment failed', failures)
}

pass(`manifest matches Apps Script ${manifest.appsScriptDeploymentId} @${manifest.appsScriptVersion} apiFingerprint=${fingerprint(actualUrl)}`)
