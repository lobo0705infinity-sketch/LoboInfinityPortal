import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const dashboard = read('src/pages/Dashboard.tsx')
const dashboardContext = read('src/contexts/DashboardDataContext.tsx')
const dashboardBackend = read('backend/Dashboard.gs')
const backendCache = read('backend/CacheApi.gs')
const api = read('src/services/api.ts')
const apiCore = read('src/services/apiCore.ts')

assert.match(
  dashboardBackend,
  /buildLeagueOperationsPayload\(\s*getLeagueOperationsCurrentRow\(\)\s*\)\.missions\s*\.slice\(0, 2\)/,
  'Dashboard must reuse the canonical bounded League Operations current-row projection.',
)
assert.match(dashboardBackend, /currentOperationsMissions: currentOperationsMissions/)
assert.match(api, /currentOperationsMissions: getArray\(record, 'currentOperationsMissions'\)/)
assert.match(dashboard, /currentOperationsMissions=\{data\.currentOperationsMissions\}/)
assert.match(dashboard, /const \[alphaMission = '', bravoMission = ''\] = currentOperationsMissions/)
assert.match(dashboard, /intelligence\?\.missionTrends\.find\(/)
assert.match(dashboard, /getCanonicalMissionName\(trend\.mission\) === canonicalMission/)
assert.doesNotMatch(dashboard, /const missionTrend = intelligence\?\.missionTrends\[0\]/)
assert.doesNotMatch(dashboard, /const secondTrend = intelligence\?\.missionTrends\[1\]/)
assert.match(dashboard, /mission=\{alphaMission\}/)
assert.match(dashboard, /mission=\{bravoMission\}/)
assert.match(dashboard, /missionTrend\?\.story \|\| 'No games recorded yet\.'/)
assert.match(dashboard, /secondTrend\?\.story \|\| 'No games recorded yet\.'/)
assert.doesNotMatch(dashboardContext, /getLeagueOperations/)
assert.match(
  backendCache,
  /leagueOperations: \["leagueOperations", "home", "dashboard", "eventHome", "eventManager"\]/,
)
assert.match(apiCore, /case 'leagueOperationsSave':\s*return \['leagueOperations', 'dashboard'\]/)

const canonical = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
const resolve = (missions, trends) => missions.slice(0, 2).map((mission) => ({
  mission,
  trend: trends.find((trend) => canonical(trend.mission) === canonical(mission)) ?? null,
}))

const rankedTrends = [
  { mission: 'Area of Interest', story: 'analytics leader' },
  { mission: 'Hardlock', story: 'analytics runner-up' },
  { mission: 'Neutralization', story: 'matching Alpha analytics' },
  { mission: "Dead Man's Switch", story: 'matching Bravo analytics' },
]
assert.deepEqual(
  resolve(['Neutralization', "Dead Man's Switch"], rankedTrends),
  [
    { mission: 'Neutralization', trend: rankedTrends[2] },
    { mission: "Dead Man's Switch", trend: rankedTrends[3] },
  ],
)
assert.deepEqual(
  resolve(['Mission X', 'Mission Y'], rankedTrends).map(({ mission }) => mission),
  ['Mission X', 'Mission Y'],
)
assert.deepEqual(
  resolve(['Neutralization', "Dead Man's Switch"], [rankedTrends[2]]).map(({ mission, trend }) => [mission, trend?.mission ?? null]),
  [['Neutralization', 'Neutralization'], ["Dead Man's Switch", null]],
)
assert.deepEqual(
  resolve(['Neutralization', "Dead Man's Switch"], []).map(({ mission }) => mission),
  ['Neutralization', "Dead Man's Switch"],
)
assert.deepEqual(resolve([], rankedTrends), [])

console.log('dashboard Weekly Operations checks passed')
