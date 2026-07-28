import {
  currentGitState,
  fail,
  fingerprint,
  loadViteEnv,
  pass,
  readManifest,
  validateReleaseManifest,
} from './release-utils.mjs'

const manifest = readManifest()
const state = currentGitState()
const env = loadViteEnv(process.env.MODE || 'production')
const result = validateReleaseManifest({ env, manifest, state })

if (result.failures.length) {
  fail('release manifest/API alignment failed', [
    ...result.diagnostics,
    'Remediation: set VITE_API_URL to release/production.json appsScriptUrl in your shell, Vercel project, or local .env.production.local/.env.local.',
    ...result.failures,
  ])
}

pass(`manifest matches Apps Script ${manifest.appsScriptDeploymentId} @${manifest.appsScriptVersion} apiFingerprint=${fingerprint(result.actualUrl)}`)
