type BuildInfo = {
  apiUrl: string
  backendCommit: string
  backendDeploymentId: string
  buildTimestamp: string
  cacheVersion: string
  deploymentId: string
  frontendVersion: string
  gitCommit: string
  portalVersion: string
  schemaVersion: string
  vercelUrl: string
}

declare const __BACKEND_COMMIT__: string
declare const __BACKEND_DEPLOYMENT_ID__: string
declare const __BUILD_TIMESTAMP__: string
declare const __CACHE_VERSION__: string
declare const __DEPLOYMENT_ID__: string
declare const __FRONTEND_VERSION__: string
declare const __GIT_COMMIT__: string
declare const __PORTAL_VERSION__: string
declare const __SCHEMA_VERSION__: string
declare const __VERCEL_URL__: string

export const buildInfo: BuildInfo = {
  apiUrl: import.meta.env.VITE_API_URL,
  backendCommit: __BACKEND_COMMIT__,
  backendDeploymentId: __BACKEND_DEPLOYMENT_ID__,
  buildTimestamp: __BUILD_TIMESTAMP__,
  cacheVersion: __CACHE_VERSION__,
  deploymentId: __DEPLOYMENT_ID__,
  frontendVersion: __FRONTEND_VERSION__,
  gitCommit: __GIT_COMMIT__,
  portalVersion: __PORTAL_VERSION__,
  schemaVersion: __SCHEMA_VERSION__,
  vercelUrl: __VERCEL_URL__,
}
