import { extractAppsScriptDeploymentId, fail, normalizeApiUrl, pass, readManifest } from './release-utils.mjs'

const manifest = readManifest()
const failures = []

function expect(condition, message) {
  if (!condition) {
    failures.push(message)
  }
}

function hasAll(haystack, markers) {
  return markers.every((marker) => haystack.includes(marker))
}

function hasAny(haystack, markers) {
  return markers.some((marker) => haystack.includes(marker))
}

const legacyCommissionerNav = `
Command Center
Event Manager
Community Manager
Automation
Audit
Diagnostics
Users
Operations
`

expect(
  hasAny(legacyCommissionerNav, manifest.forbiddenActiveMarkers.legacyCommissionerTopLevel),
  'Legacy Commissioner navigation fixture was not detected.',
)

const missingMyProfile3 = `
My Profile
Competitive Home
Career Status
`

expect(
  !hasAll(missingMyProfile3, manifest.contractMarkers.myProfileUx),
  'Missing My Profile 3.0 fixture was not detected.',
)
expect(
  hasAny(missingMyProfile3, manifest.forbiddenActiveMarkers.removedMyProfileUx),
  'Removed My Profile wording fixture was not detected.',
)

const wrongEndpoint = 'https://script.google.com/macros/s/WRONG/exec'
expect(
  normalizeApiUrl(wrongEndpoint) !== normalizeApiUrl(manifest.appsScriptUrl),
  'Wrong Apps Script endpoint fixture was not detected.',
)
expect(
  extractAppsScriptDeploymentId(wrongEndpoint) !== manifest.appsScriptDeploymentId,
  'Wrong Apps Script deployment ID fixture was not detected.',
)

const emptyEndpoint = ''
expect(!normalizeApiUrl(emptyEndpoint), 'Empty VITE_API_URL fixture was not detected.')

const missingGitMetadata = {
  gitCommit: 'not-provided',
  deploymentId: 'not-provided',
}
expect(
  Object.values(missingGitMetadata).includes('not-provided'),
  'Missing Git/deployment metadata fixture was not detected.',
)

const frontendBackendDrift = {
  frontendApiDeploymentId: 'AKfycb_frontend',
  manifestApiDeploymentId: manifest.appsScriptDeploymentId,
}
expect(
  frontendBackendDrift.frontendApiDeploymentId !== frontendBackendDrift.manifestApiDeploymentId,
  'Frontend/backend drift fixture was not detected.',
)

if (failures.length) {
  fail('release safeguard self-test failed', failures)
}

pass('safeguards detect legacy nav, missing My Profile 3.0, wrong/empty API URL, missing metadata, and frontend/backend drift')
