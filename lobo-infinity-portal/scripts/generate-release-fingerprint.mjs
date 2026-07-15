import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  currentGitState,
  extractAppsScriptDeploymentId,
  fingerprint,
  normalizeApiUrl,
  pass,
  readManifest,
  repoRoot,
} from './release-utils.mjs'

const manifest = readManifest()
const state = currentGitState()
const apiUrl = normalizeApiUrl(process.env.VITE_API_URL || manifest.appsScriptUrl)
const payload = {
  schemaVersion: 1,
  frontendVersion: process.env.npm_package_version || manifest.frontendVersion,
  frontendCommit: process.env.VITE_BUILD_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || state.commit,
  gitBranch: process.env.VITE_BUILD_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || state.branch,
  buildTimestamp: new Date().toISOString(),
  vercelDeploymentId:
    process.env.VITE_BUILD_DEPLOYMENT_ID ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_DEPLOYMENT_URL ||
    'not-provided',
  vercelProject: manifest.vercelProject,
  appsScriptDeploymentId: extractAppsScriptDeploymentId(apiUrl),
  appsScriptVersion: manifest.appsScriptVersion,
  apiUrlFingerprint: fingerprint(apiUrl),
  cacheVersion: process.env.VITE_CACHE_VERSION || 'client-cache-v2',
}

const publicDir = resolve(repoRoot, 'public')
mkdirSync(publicDir, { recursive: true })
writeFileSync(
  resolve(publicDir, 'release-fingerprint.json'),
  `${JSON.stringify(payload, null, 2)}\n`,
)

pass(`wrote public/release-fingerprint.json for ${payload.frontendCommit}`)
