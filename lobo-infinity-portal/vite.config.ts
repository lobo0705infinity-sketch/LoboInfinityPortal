import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import productionRelease from './release/production.json' with { type: 'json' }

const apiUrl = process.env.VITE_API_URL ?? ''
const appsScriptDeploymentId =
  apiUrl.match(/\/macros\/s\/([^/]+)\/exec\/?$/)?.[1] ??
  productionRelease.appsScriptDeploymentId
const apiUrlFingerprint = apiUrl
  ? 'sha256:' +
    createHash('sha256')
      .update(apiUrl)
      .digest('hex')
      .slice(0, 16)
  : ''

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/firebase/auth') ||
            id.includes('node_modules/@firebase/auth')
          ) {
            return 'firebase-auth'
          }

          if (
            id.includes('node_modules/firebase/app') ||
            id.includes('node_modules/@firebase/app') ||
            id.includes('node_modules/@firebase/component') ||
            id.includes('node_modules/@firebase/logger') ||
            id.includes('node_modules/@firebase/util')
          ) {
            return 'firebase-core'
          }

          if (
            id.includes('node_modules/firebase/firestore') ||
            id.includes('node_modules/@firebase/firestore') ||
            id.includes('node_modules/@grpc') ||
            id.includes('node_modules/protobufjs')
          ) {
            return 'firebase-firestore'
          }

          if (id.includes('node_modules')) {
            return 'vendor'
          }

          return undefined
        },
      },
    },
  },
  define: {
    __BACKEND_COMMIT__: JSON.stringify(
      process.env.VITE_BACKEND_COMMIT ??
        process.env.VITE_BUILD_GIT_COMMIT ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        'not-provided',
    ),
    __BACKEND_DEPLOYMENT_ID__: JSON.stringify(
      process.env.VITE_BACKEND_DEPLOYMENT_ID ??
        appsScriptDeploymentId ??
        'not-provided',
    ),
    __BUILD_GIT_BRANCH__: JSON.stringify(
      process.env.VITE_BUILD_GIT_BRANCH ??
        process.env.VERCEL_GIT_COMMIT_REF ??
        'not-provided',
    ),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    __CACHE_VERSION__: JSON.stringify(process.env.VITE_CACHE_VERSION ?? 'client-cache-v2'),
    __DEPLOYMENT_ID__: JSON.stringify(
      process.env.VITE_BUILD_DEPLOYMENT_ID ??
        process.env.VERCEL_DEPLOYMENT_ID ??
        process.env.VERCEL_DEPLOYMENT_URL ??
        'not-provided',
    ),
    __FRONTEND_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __GIT_COMMIT__: JSON.stringify(
      process.env.VITE_BUILD_GIT_COMMIT ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        'not-provided',
    ),
    __APPS_SCRIPT_VERSION__: JSON.stringify(
      process.env.VITE_APPS_SCRIPT_VERSION ??
        String(productionRelease.appsScriptVersion),
    ),
    __API_URL_FINGERPRINT__: JSON.stringify(apiUrlFingerprint),
    __RELEASE_MANIFEST_VERSION__: JSON.stringify(String(productionRelease.schemaVersion)),
    __PORTAL_VERSION__: JSON.stringify(process.env.VITE_PORTAL_VERSION ?? 'Version 5.0'),
    __SCHEMA_VERSION__: JSON.stringify(process.env.VITE_SCHEMA_VERSION ?? '1'),
    __VERCEL_URL__: JSON.stringify(
      process.env.VITE_BUILD_VERCEL_URL ?? process.env.VERCEL_URL ?? '',
    ),
  },
  plugins: [react()],
})
