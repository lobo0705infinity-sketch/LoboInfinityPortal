import { rename } from 'node:fs/promises'

// Keep the built Vite shell available to the public-page function without
// allowing the static filesystem to intercept / before its rewrite runs.
await rename(new URL('../dist/index.html', import.meta.url), new URL('../dist/app-shell.html', import.meta.url))
console.log('Prepared the Vite shell for public search pages.')
