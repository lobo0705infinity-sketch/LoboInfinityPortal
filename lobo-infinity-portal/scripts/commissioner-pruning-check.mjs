import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

const navigation = read('src/components/sidebarNavigation.ts')
const dashboard = read('src/pages/CommissionerDashboard.tsx')
const events = read('src/pages/CommissionerEvents.tsx')
const games = read('src/pages/CommissionerGameCenter.tsx')
const players = read('src/pages/CommissionerPlayers.tsx')
const community = read('src/pages/CommunityManager.tsx')
const system = read('src/pages/CommissionerSystem.tsx')

const commissionerNavigation = navigation.slice(navigation.indexOf('export const commissionerItems'))

assert.deepEqual(
  Array.from(commissionerNavigation.matchAll(/label: '([^']+)'/g), (match) => match[1]),
  [
    'Command Center',
    'Events',
    'Games & Army Lists',
    'Players & Access',
    'Community',
    'System & Recovery',
  ],
  'Normal Commissioner navigation must expose exactly the six consolidated sections.',
)

assert.match(dashboard, /if \(!showLegacyTools\)[\s\S]*CompactCommandCenter/)
assert.match(dashboard, /requestedPanel === 'identity'[\s\S]*IdentityManagementPanel/)
assert.match(dashboard, /requestedPanel === 'operations'[\s\S]*OperationsEngineDashboard/)
assert.match(dashboard, /requestedPanel === 'scheduling'[\s\S]*CommissionerSchedulingPanel/)
assert.match(dashboard, /requestedPanel === 'settings'[\s\S]*SettingsPanel/)
assert.match(dashboard, /showLegacyFields \?/)

assert.doesNotMatch(events, /const eventWorkflows/)
assert.match(events, /<EventManagerPanel/)
assert.match(events, /Open Scheduling Monitor/)
assert.match(events, /Open Portal Settings/)

assert.doesNotMatch(players, /const playerWorkflows/)
assert.match(players, /Open Player Identity Tools/)
assert.match(players, /Edit Display Name/)
assert.match(players, /Delete Player/)

assert.match(games, /Historical Army List Links/)
assert.match(games, /Army Code Validation/)
assert.match(games, /Correct Score/)

assert.match(community, /showLegacyContent/)
assert.match(community, /<StreamsManager/)
assert.match(community, /Open Discord & Automation/)
assert.match(community, /showLegacyContent \? \([\s\S]*<NewsManager[\s\S]*<AlertsManager[\s\S]*<TimelineManager/)

assert.match(system, /if \(!showLegacyTools\)[\s\S]*System & Recovery/)
assert.match(system, /Operations Engine/)
assert.match(system, /Automation Queue/)
assert.match(system, /Refresh Army Intelligence/)

console.log('Commissioner pruning regression passed.')
