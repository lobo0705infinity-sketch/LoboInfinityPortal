type BuildInfo = {
  apiUrl: string
  apiUrlFingerprint: string
  appsScriptVersion: string
  backendCommit: string
  backendDeploymentId: string
  buildGitBranch: string
  buildTimestamp: string
  cacheVersion: string
  deploymentId: string
  frontendVersion: string
  gitCommit: string
  portalVersion: string
  releaseManifestVersion: string
  schemaVersion: string
  vercelUrl: string
}

declare const __API_URL_FINGERPRINT__: string
declare const __APPS_SCRIPT_VERSION__: string
declare const __BACKEND_COMMIT__: string
declare const __BACKEND_DEPLOYMENT_ID__: string
declare const __BUILD_GIT_BRANCH__: string
declare const __BUILD_TIMESTAMP__: string
declare const __CACHE_VERSION__: string
declare const __DEPLOYMENT_ID__: string
declare const __FRONTEND_VERSION__: string
declare const __GIT_COMMIT__: string
declare const __PORTAL_VERSION__: string
declare const __RELEASE_MANIFEST_VERSION__: string
declare const __SCHEMA_VERSION__: string
declare const __VERCEL_URL__: string

export const buildInfo: BuildInfo = {
  apiUrl: import.meta.env.VITE_API_URL,
  apiUrlFingerprint: __API_URL_FINGERPRINT__,
  appsScriptVersion: __APPS_SCRIPT_VERSION__,
  backendCommit: __BACKEND_COMMIT__,
  backendDeploymentId: __BACKEND_DEPLOYMENT_ID__,
  buildGitBranch: __BUILD_GIT_BRANCH__,
  buildTimestamp: __BUILD_TIMESTAMP__,
  cacheVersion: __CACHE_VERSION__,
  deploymentId: __DEPLOYMENT_ID__,
  frontendVersion: __FRONTEND_VERSION__,
  gitCommit: __GIT_COMMIT__,
  portalVersion: __PORTAL_VERSION__,
  releaseManifestVersion: __RELEASE_MANIFEST_VERSION__,
  schemaVersion: __SCHEMA_VERSION__,
  vercelUrl: __VERCEL_URL__,
}
