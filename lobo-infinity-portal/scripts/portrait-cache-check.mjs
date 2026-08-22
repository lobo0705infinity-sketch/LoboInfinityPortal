import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))
const failures = []
const headers = config.headers ?? []
const immutable = 'public, max-age=31536000, immutable'
const bySource = new Map(headers.map((entry) => [entry.source, entry.headers]))

if (config.routes) failures.push('Legacy Vercel routes must not suppress the scoped cache headers.')
if (!config.rewrites?.some((rewrite) => rewrite.source === '/(.*)' && rewrite.destination === '/index.html')) {
  failures.push('SPA fallback rewrite must remain configured.')
}

for (const source of ['/assets/(.*)', '/faction-portraits/optimized/(.*)']) {
  const cacheControl = bySource.get(source)?.find((header) => header.key.toLowerCase() === 'cache-control')?.value
  if (cacheControl !== immutable) failures.push(`${source} must use immutable content-addressed caching.`)
}

for (const unsafe of ['/index.html', '/(.*)', '/faction-portraits/(.*)', '/api/(.*)']) {
  const cacheControl = bySource.get(unsafe)?.find((header) => header.key.toLowerCase() === 'cache-control')?.value
  if (cacheControl?.includes('immutable')) failures.push(`${unsafe} must not use immutable caching.`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('PASS hashed Vite and portrait derivatives are immutable')
console.log('PASS HTML, APIs, and stable original portrait URLs are not immutable')
