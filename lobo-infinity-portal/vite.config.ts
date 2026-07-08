import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/firebase') ||
            id.includes('node_modules/@firebase') ||
            id.includes('node_modules/@grpc') ||
            id.includes('node_modules/protobufjs')
          ) {
            return 'firebase'
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
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
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
    __VERCEL_URL__: JSON.stringify(
      process.env.VITE_BUILD_VERCEL_URL ?? process.env.VERCEL_URL ?? '',
    ),
  },
  plugins: [react()],
})
