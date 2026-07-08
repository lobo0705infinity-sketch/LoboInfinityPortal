type BuildInfo = {
  buildTimestamp: string
  deploymentId: string
  frontendVersion: string
  gitCommit: string
  vercelUrl: string
}

declare const __BUILD_TIMESTAMP__: string
declare const __DEPLOYMENT_ID__: string
declare const __FRONTEND_VERSION__: string
declare const __GIT_COMMIT__: string
declare const __VERCEL_URL__: string

export const buildInfo: BuildInfo = {
  buildTimestamp: __BUILD_TIMESTAMP__,
  deploymentId: __DEPLOYMENT_ID__,
  frontendVersion: __FRONTEND_VERSION__,
  gitCommit: __GIT_COMMIT__,
  vercelUrl: __VERCEL_URL__,
}
