import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
      process.env.VITE_BACKEND_DEPLOYMENT_ID ?? 'not-provided',
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
    __PORTAL_VERSION__: JSON.stringify(process.env.VITE_PORTAL_VERSION ?? 'Version 5.0'),
    __SCHEMA_VERSION__: JSON.stringify(process.env.VITE_SCHEMA_VERSION ?? '1'),
    __VERCEL_URL__: JSON.stringify(
      process.env.VITE_BUILD_VERCEL_URL ?? process.env.VERCEL_URL ?? '',
    ),
  },
  plugins: [react()],
})
