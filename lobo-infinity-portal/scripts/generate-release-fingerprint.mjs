import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  currentGitState,
  extractAppsScriptDeploymentId,
  fingerprint,
  loadViteEnv,
  normalizeApiUrl,
  pass,
  readManifest,
  repoRoot,
} from './release-utils.mjs'

const manifest = readManifest()
const state = (() => {
  try {
    return currentGitState()
  } catch {
    return {
      branch: 'not-provided',
      commit: 'not-provided',
    }
  }
})()
const env = loadViteEnv(process.env.MODE || 'production')
const apiUrl = normalizeApiUrl(env.get('VITE_API_URL') || manifest.appsScriptUrl)
const frontendCommit =
  env.get('VITE_BUILD_GIT_COMMIT') ||
  env.get('VERCEL_GIT_COMMIT_SHA') ||
  state.commit
const gitBranch =
  env.get('VITE_BUILD_GIT_BRANCH') ||
  env.get('VERCEL_GIT_COMMIT_REF') ||
  state.branch

if (!frontendCommit || frontendCommit === 'not-provided') {
  throw new Error('release fingerprint requires VITE_BUILD_GIT_COMMIT, VERCEL_GIT_COMMIT_SHA, or a readable Git checkout')
}

const payload = {
  schemaVersion: 1,
  frontendVersion: process.env.npm_package_version || manifest.frontendVersion,
  frontendCommit,
  gitBranch,
  buildTimestamp: new Date().toISOString(),
  vercelDeploymentId:
    env.get('VITE_BUILD_DEPLOYMENT_ID') ||
    env.get('VERCEL_DEPLOYMENT_ID') ||
    env.get('VERCEL_DEPLOYMENT_URL') ||
    'not-provided',
  vercelProject: manifest.vercelProject,
  appsScriptDeploymentId: extractAppsScriptDeploymentId(apiUrl),
  appsScriptVersion: manifest.appsScriptVersion,
  apiUrlFingerprint: fingerprint(apiUrl),
  cacheVersion: env.get('VITE_CACHE_VERSION') || 'client-cache-v2',
}

const publicDir = resolve(repoRoot, 'public')
mkdirSync(publicDir, { recursive: true })
writeFileSync(
  resolve(publicDir, 'release-fingerprint.json'),
  `${JSON.stringify(payload, null, 2)}\n`,
)

pass(`wrote public/release-fingerprint.json for ${payload.frontendCommit}`)
