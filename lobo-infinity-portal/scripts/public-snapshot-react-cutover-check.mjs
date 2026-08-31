import fs from 'node:fs'

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const client = read('src/services/publicSnapshot.ts')
const api = read('src/services/api.ts')
const eventProjection = read('src/services/publicEventProjection.ts')
const teamProjection = read('src/services/publicTeamTournamentProjection.ts')

const checks = [
  [client.includes('PUBLIC_SNAPSHOT_POINTER_URL') && client.includes('public-snapshots/current.json'), 'current snapshot pointer'],
  [client.includes('ecwefvuvauaqpary.public.blob.vercel-storage.com'), 'Blob base'],
  [client.includes("'army-intelligence-detail'"), '13-dataset allowlist'],
  [client.includes("cache: 'force-cache'"), 'immutable cache behavior'],
  [client.includes("cache: 'no-cache'"), 'mutable pointer cache behavior'],
  [!client.includes('API_URL') && !client.includes('/api/'), 'no Apps Script or endpoint fallback'],
  [api.includes('...publicSnapshotApi'), 'public API compatibility adapter'],
  [!eventProjection.includes('/api/public-event-projection'), 'event projection uses snapshot'],
  [!teamProjection.includes('/api/public-team-tournament-projection'), 'Team Tournament uses snapshot'],
  [eventProjection.includes('capabilities: Array.isArray(event.capabilities) ? event.capabilities : []'), 'EventHome capabilities compatibility'],
]

for (const [passed, label] of checks) {
  if (!passed) throw new Error(`Public snapshot React cutover check failed: ${label}`)
}

console.log(`Public snapshot React cutover regression passed (${checks.length} checks).`)
