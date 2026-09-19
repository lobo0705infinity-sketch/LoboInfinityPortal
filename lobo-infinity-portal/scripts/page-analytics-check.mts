import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { normalizePageAnalyticsPath } from '../src/services/pageAnalytics.ts'

const root = process.cwd()
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const routeCases: Array<[string, string | null]> = [
  ['/', 'dashboard'],
  ['/dashboard', 'dashboard'],
  ['/players', 'players'],
  ['/community', 'players'],
  ['/players/Lobo', 'player-profile'],
  ['/player/AnotherPlayer', 'player-profile'],
  ['/missions/Neutralization', 'mission-profile'],
  ['/games/62', 'game-details'],
  ['/event/event-july-2026', 'event-overview'],
  ['/event/private-id/registration', 'event-registration'],
  ['/event/private-id/tournament/standings', 'team-tournament-standings'],
  ['/event/private-id/tournament/pairings', 'team-tournament-pairings'],
  ['/event/private-id/tournament/teams', 'team-tournament-teams'],
  ['/event/private-id/tournament/results', 'team-tournament-results'],
  ['/commissioner', null],
  ['/commissioner/system', null],
  ['/diagnostics', null],
  ['/integrity', null],
  ['/automation', null],
  ['/intelligence', null],
  ['/news/story-id', null],
  ['/stream/stream-id', null],
  ['/unknown/private-value', null],
]

routeCases.forEach(([route, expected]) => {
  assert.equal(normalizePageAnalyticsPath(route), expected, route)
})

const tracker = read('src/components/UserActivityTracker.tsx')
assert.match(tracker, /auth\.status === 'loading'/)
assert.match(tracker, /auth\.authenticated && auth\.user\.role === 'Commissioner'/)
assert.match(tracker, /location\.key/)
assert.match(tracker, /lastHandledNavigation/)
assert.match(tracker, /recordPageView\(pageKey\)/)
assert.match(tracker, /heartbeat\(/)

const lightApi = read('src/services/lightApi.ts')
const sender = lightApi.slice(lightApi.indexOf('export function recordPageView'), lightApi.indexOf('export async function getPageAnalytics'))
assert.match(sender, /new URLSearchParams\(\{ pageKey \}\)/)
assert.doesNotMatch(sender, /authToken|sessionToken|localStorage|sessionStorage/)
assert.match(sender, /\.catch\(\(\) => undefined\)/)

const backend = read('backend/PageAnalyticsApi.gs')
assert.match(backend, /\["Timestamp", "Page Key"\]/)
assert.match(backend, /appendRow\(\[new Date\(\), pageKey\]\)/)
assert.match(backend, /hasOwnProperty\.call\(PAGE_ANALYTICS_PAGES, pageKey\)/)
assert.doesNotMatch(backend, /email|sessionToken|authToken|referrer|userAgent|playerName|eventId/i)
assert.match(backend, /7 \* 24 \* 60 \* 60 \* 1000/)
assert.match(backend, /30 \* 24 \* 60 \* 60 \* 1000/)
assert.match(backend, /b\.allTime - a\.allTime/)

const now = Date.now()
const sheetRows: unknown[][] = [
  ['Timestamp', 'Page Key'],
  [new Date(now - 24 * 60 * 60 * 1000), 'dashboard'],
  [new Date(now - 10 * 24 * 60 * 60 * 1000), 'dashboard'],
  [new Date(now - 40 * 24 * 60 * 60 * 1000), 'players'],
]
const sheet = {
  appendRow(row: unknown[]) { sheetRows.push(row) },
  getLastRow() { return sheetRows.length },
  getRange(row: number, column: number, rowCount: number, columnCount: number) {
    return {
      getValues() {
        return sheetRows
          .slice(row - 1, row - 1 + rowCount)
          .map((entry) => entry.slice(column - 1, column - 1 + columnCount))
      },
      setValues(values: unknown[][]) {
        values.forEach((entry, index) => { sheetRows[row - 1 + index] = entry })
      },
    }
  },
}
const spreadsheet = {
  getSheetByName() { return sheet },
  insertSheet() { return sheet },
}
const context = vm.createContext({
  CONFIG: { SHEETS: { PAGE_ANALYTICS: 'Page Analytics' } },
  Date,
  Number,
  Object,
  jsonOutput: (value: unknown) => value,
  lifGetTargetSpreadsheet_: () => spreadsheet,
})
vm.runInContext(backend, context)
const report = vm.runInContext('getPageAnalytics()', context) as {
  pages: Array<{ allTime: number; last30Days: number; last7Days: number; pageKey: string }>
}
const dashboard = report.pages.find((page) => page.pageKey === 'dashboard')
const players = report.pages.find((page) => page.pageKey === 'players')
assert.deepEqual(
  { allTime: dashboard?.allTime, last30Days: dashboard?.last30Days, last7Days: dashboard?.last7Days },
  { allTime: 2, last30Days: 2, last7Days: 1 },
)
assert.deepEqual(
  { allTime: players?.allTime, last30Days: players?.last30Days, last7Days: players?.last7Days },
  { allTime: 1, last30Days: 0, last7Days: 0 },
)
assert.equal(report.pages[0]?.pageKey, 'dashboard')

const rowsBeforeInvalidWrite = sheetRows.length
const invalid = vm.runInContext(
  'recordPageView({ parameter: { pageKey: "=IMPORTXML(\\"https://invalid\\")" } })',
  context,
) as { code: string; success: boolean }
assert.equal(invalid.success, false)
assert.equal(invalid.code, 'INVALID_PAGE_KEY')
assert.equal(sheetRows.length, rowsBeforeInvalidWrite)

const valid = vm.runInContext(
  'recordPageView({ parameter: { pageKey: "missions" } })',
  context,
) as { success: boolean }
assert.equal(valid.success, true)
assert.equal(sheetRows.length, rowsBeforeInvalidWrite + 1)
assert.equal(sheetRows.at(-1)?.length, 2)
assert.ok(sheetRows.at(-1)?.[0] instanceof Date)
assert.equal(sheetRows.at(-1)?.[1], 'missions')

const router = read('backend/API.gs')
assert.match(router, /case "pageAnalytics":[\s\S]*?requireApiPermission\(e, "manageSettings"/)
assert.match(router, /case "recordPageView":\s*return recordPageView\(e\)/)

const system = read('src/pages/CommissionerSystem.tsx')
assert.match(system, /auth\.hasPermission\('manageSettings'\)/)
assert.match(system, />7 Days</)
assert.match(system, />30 Days</)
assert.match(system, />All Time</)

console.log('Page analytics regression checks passed.')
