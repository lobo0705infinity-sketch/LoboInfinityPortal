import fs from 'node:fs'

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const app = read('src/App.tsx')
const publicApp = read('src/public/SnapshotPublicApp.tsx')
const armyIntelligence = read('src/public/SnapshotArmyIntelligence.tsx')
const client = read('src/services/publicSnapshot.ts')
const lightApi = read('src/services/lightApi.ts')
const quickAccessSource = publicApp.match(/const quickAccess = \[([\s\S]*?)\]\s+as const/)?.[1] ?? ''
const quickAccessEntries = [...quickAccessSource.matchAll(/\['([^']+)', '([^']+)'\]/g)].map((match) => `${match[1]}:${match[2]}`)
const expectedQuickAccess = ['Players:/players', 'Standings:/standings?eventId=event-current-league', 'Games:/games', 'Factions:/factions', 'Missions:/missions', 'Schedule:/event/event-current-league/schedule', 'Streams:/streams', 'Submit Game:/submit-game']

const requiredRoutes = ['/', '/players', '/players/:playerName', '/games/:id', '/standings', '/factions', '/missions', '/compare', '/rivalries', '/analytics', '/hall-of-fame', '/army-lists', '/army-intelligence', '/schedule', '/community', '/events', '/event/:eventId', '/submit-game', '/army-lists/submit']
const checks = [
  [app.includes('!commissionerRoute ? <SnapshotPublicApp />'), 'public/Commissioner route separation'],
  [!publicApp.includes("../services/api") && !publicApp.includes('apiClient'), 'no legacy public API controller'],
  [!publicApp.includes('CommissionerEventWorkflow'), 'no Commissioner workflow in public events'],
  [!publicApp.includes('publicEventProjection') && !publicApp.includes('publicTeamTournamentProjection'), 'no event projection dependency'],
  [!publicApp.includes('capabilities'), 'no Event Engine capabilities dependency'],
  [client.includes('PUBLIC_SNAPSHOT_POINTER_URL') && client.includes('pointerPromise'), 'session-pinned current snapshot'],
  [!client.includes('/api/'), 'no snapshot fallback'],
  [!lightApi.includes("request('searchIndex'"), 'local snapshot search'],
  [!lightApi.includes("request('notifications'"), 'snapshot community notifications'],
  [publicApp.includes('<SnapshotArmyIntelligence />') && armyIntelligence.includes("'army-intelligence-detail'"), 'lazy Army Intelligence detail'],
  [JSON.stringify(quickAccessEntries) === JSON.stringify(expectedQuickAccess), 'Dashboard Quick Access has exactly the approved eight destinations'],
  [!quickAccessEntries.some((entry) => entry.startsWith('Community:') || entry.startsWith('Events:')), 'Dashboard Quick Access excludes Community and Events'],
  ...requiredRoutes.map((route) => [publicApp.includes(`path=\"${route}\"`), `route ${route}`]),
]

for (const [passed, label] of checks) if (!passed) throw new Error(`Snapshot-native public app check failed: ${label}`)
console.log(`Snapshot-native public app regression passed (${checks.length} checks).`)
