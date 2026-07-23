import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const backend = read('backend/ArmyIntelligenceApi.gs')
const apiRouter = read('backend/API.gs')
const apiClient = read('src/services/api.ts')
const app = read('src/App.tsx')
const page = read('src/pages/ArmyIntelligence.tsx')
const commissioner = read('src/pages/CommissionerDashboard.tsx')
const refresh = read('scripts/refresh-army-intelligence.mjs')

assert.match(
  backend,
  /ARMY_INTELLIGENCE_SHEET_NAME = "Army List Intelligence"/,
  'Army Intelligence snapshots must use the disposable Army List Intelligence sheet.',
)
assert.match(
  backend,
  /"Snapshot Key"[\s\S]*"Decoded JSON"/,
  'Army Intelligence sheet must include source, hash, status, error, and decoded JSON columns.',
)
assert.match(
  backend,
  /function buildArmyIntelligenceSources/,
  'Backend must discover source army codes without modifying source records.',
)
assert.match(
  backend,
  /appendArmyIntelligenceRecentGameSources/,
  'Backend must include League and Casual recent-game army codes.',
)
assert.match(
  backend,
  /getAllRecentGameObjectsForEvent\("all", "casual"\)/,
  'Backend must explicitly include casual recent-game army codes.',
)
assert.match(
  backend,
  /decoded && decoded\.faction/,
  'Backend must not read decoded faction fields when decoded JSON is null.',
)
assert.match(
  backend,
  /appendArmyIntelligenceTeamTournamentSources/,
  'Backend must include Tournament army codes.',
)
assert.match(
  backend,
  /appendArmyIntelligenceLibrarySources/,
  'Backend must include approved Army List Library codes.',
)
assert.match(
  apiRouter,
  /case "armyIntelligence"[\s\S]*getArmyIntelligence/,
  'API router must expose Army Intelligence reads.',
)
assert.match(
  apiRouter,
  /case "refreshArmyIntelligence"[\s\S]*requireApiPermission\(e, "manageCache"/,
  'Refresh Army Intelligence must be Commissioner-only through manageCache permission.',
)
assert.match(
  apiClient,
  /export type ArmyIntelligenceData/,
  'API client must expose Army Intelligence data types.',
)
assert.match(
  apiClient,
  /export async function getArmyIntelligence/,
  'API client must expose getArmyIntelligence.',
)
assert.match(
  app,
  /\/army-intelligence/,
  'App must register the Army Intelligence route.',
)
assert.match(
  page,
  /getArmyIntelligence/,
  'Army Intelligence page must read decoded snapshot data.',
)
assert.match(
  page,
  /Select Sectorial[\s\S]*Choose a sectorial[\s\S]*Analyze/,
  'Army Intelligence page must require sectorial and analysis-result selectors.',
)
assert.match(
  page,
  /All Army Lists[\s\S]*Army Lists with a Winning Record[\s\S]*Army Lists with a Losing Record/,
  'Army Intelligence page must support all, winning, and losing record filters.',
)
assert.match(
  page,
  /Average Tactical Awareness[\s\S]*Average Lieutenant Orders/,
  'Army Intelligence page must show order averages including Tactical Awareness and Lieutenant orders.',
)
assert.match(
  page,
  /Model Usage[\s\S]*Lieutenant Choices[\s\S]*Hackers[\s\S]*Specialist Operatives[\s\S]*Doctors[\s\S]*Engineers[\s\S]*Forward Observers[\s\S]*Chain of Command/,
  'Army Intelligence page must show model and role usage breakdowns.',
)
assert.match(
  page,
  /countTacticalAwarenessOrders[\s\S]*orderTypes/,
  'Tactical Awareness must be derived from decoded entry orderTypes.',
)
assert.match(
  page,
  /listAppearances[\s\S]*percentage/,
  'Model usage must count per-list appearances separately from duplicate selections.',
)
assert.doesNotMatch(
  page,
  /Decode Issues|Pending or failed decodes|Decode failed/,
  'Pending and failed decode rows must not render on the public Army Intelligence page.',
)
assert.doesNotMatch(
  page,
  /Submitted Lists|DecodedListRow|army-intelligence-list-table|All Sectorials|Factions and Sectorials/,
  'Army Intelligence page must not render the old submitted-list archive or all-sectorial summaries.',
)
assert.match(
  page,
  /matchesResultFilter[\s\S]*result === 'win'[\s\S]*result === 'loss'/,
  'Result filtering must be based on submitted list win/loss result.',
)
assert.match(
  page,
  /filter\(isDecodedList\)/,
  'Sectorial statistics must use decoded snapshot data only.',
)

const operationsLists = [
  {
    decoded: {
      combatGroups: [
        {
          combatGroup: 1,
          entries: [
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'RUDRA FTO', specialist: false, unit: 'RUDRA FTO' },
            { doctor: false, engineer: true, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'ARTALIS', specialist: false, unit: 'ARTALIS' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'DIKPALA', specialist: false, unit: 'DIKPALA' },
            { doctor: false, engineer: false, hacker: true, lieutenant: true, orderTypes: ['regular', 'lieutenant', 'lieutenant'], profile: 'ASURA', specialist: false, unit: 'ASURA' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['irregular'], profile: 'SĀCHĀ', specialist: true, unit: 'SĀCHĀ' },
          ],
        },
        {
          combatGroup: 2,
          entries: [
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'SAMEKH Rebot', specialist: false, unit: 'SAMEKH Rebot' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'NETROD', specialist: false, unit: 'NETROD' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'NETROD', specialist: false, unit: 'NETROD' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['irregular'], profile: 'WARCOR', specialist: false, unit: 'WARCOR' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'RACERBOT Mk-III', specialist: false, unit: 'RACERBOT Mk-III' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'RACERBOT Mk-III', specialist: false, unit: 'RACERBOT Mk-III' },
            { doctor: false, engineer: false, hacker: true, lieutenant: false, orderTypes: ['regular'], profile: 'Pilot-X Team', specialist: false, unit: 'Pilot-X Team' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'MAXIMUS AGENT FTO', specialist: true, unit: 'MAXIMUS AGENT FTO' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'PROBOT', specialist: false, unit: 'PROBOT' },
            { doctor: true, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'CLAIRE LAZHARI FTO', specialist: false, unit: 'CLAIRE LAZHARI FTO' },
          ],
        },
      ],
      orderCounts: {
        impetuous: 0,
        irregular: 2,
        lieutenant: 2,
        regular: 13,
      },
      sectorial: 'Operations Subsection',
      totals: {
        combatGroups: 2,
        points: 300,
        swc: 3,
      },
    },
    result: 'Win',
    status: 'decoded',
  },
  {
    decoded: {
      combatGroups: [
        {
          entries: [
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'RUDRA FTO', specialist: false, unit: 'RUDRA FTO' },
            { doctor: true, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'CLAIRE LAZHARI FTO', specialist: false, unit: 'CLAIRE LAZHARI FTO' },
            { doctor: false, engineer: false, hacker: true, lieutenant: true, orderTypes: ['regular', 'lieutenant', 'lieutenant'], profile: 'ASURA', specialist: false, unit: 'ASURA' },
          ],
        },
      ],
      orderCounts: {
        impetuous: 0,
        irregular: 0,
        lieutenant: 2,
        regular: 3,
      },
      sectorial: 'Operations Subsection',
      totals: {
        combatGroups: 1,
        points: 290,
        swc: 2,
      },
    },
    result: 'Loss',
    status: 'decoded',
  },
]
const allAnalysis = buildFixtureAnalysis(operationsLists)
const winningAnalysis = buildFixtureAnalysis(operationsLists.filter((list) => list.result === 'Win'))
const losingAnalysis = buildFixtureAnalysis(operationsLists.filter((list) => list.result === 'Loss'))
const roleFixtureAnalysis = buildFixtureAnalysis([
  {
    decoded: {
      combatGroups: [
        {
          entries: [
            { forwardObserver: true, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'Forward Observer Profile', unit: 'Forward Observer Profile' },
            { chainOfCommand: true, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'Chain of Command Profile', unit: 'Chain of Command Profile' },
          ],
        },
      ],
      orderCounts: {
        regular: 2,
      },
      totals: {},
    },
    result: 'Win',
    status: 'decoded',
  },
])

assert.equal(allAnalysis.listCount, 2, 'All Army Lists must include winning and losing decoded lists.')
assert.equal(winningAnalysis.listCount, 1, 'Winning Record must include only winning submitted lists.')
assert.equal(losingAnalysis.listCount, 1, 'Losing Record must include only losing submitted lists.')
assert.notEqual(
  winningAnalysis.averageRegularOrders,
  losingAnalysis.averageRegularOrders,
  'Changing result filters must change order averages when matching data differs.',
)
assert.notDeepEqual(
  winningAnalysis.modelUsage,
  losingAnalysis.modelUsage,
  'Changing result filters must change model usage counts when matching data differs.',
)
assert.deepEqual(
  allAnalysis.modelUsage.find((row) => row.name === 'NETROD'),
  {
    listCount: 1,
    name: 'NETROD',
    percentage: 50,
    totalSelections: 2,
  },
  'Duplicate models must count twice for selections but once for list appearance.',
)
assert.deepEqual(
  winningAnalysis.hackers.map((row) => row.name),
  ['ASURA', 'Pilot-X Team'],
  'Operations Subsection winning list hackers must include only explicit hacker profiles.',
)
assert.equal(
  winningAnalysis.hackers.some((row) => ['RACERBOT Mk-III', 'DIKPALA', 'RUDRA FTO'].includes(row.name)),
  false,
  'Repeater support profiles must not be classified as hackers.',
)
assert.equal(
  winningAnalysis.forwardObservers.length,
  0,
  'SACHA with Forward Deployment must not appear in Forward Observers.',
)
assert.equal(
  winningAnalysis.chainOfCommand.some((row) => row.name === 'MAXIMUS AGENT FTO'),
  false,
  'MAXIMUS AGENT FTO must not appear in Chain of Command without an explicit Chain of Command skill.',
)
assert.equal(
  roleFixtureAnalysis.forwardObservers.length,
  1,
  'Explicit Forward Observer profiles must appear in Forward Observers.',
)
assert.deepEqual(
  roleFixtureAnalysis.chainOfCommand.map((row) => row.name),
  ['Chain of Command Profile'],
  'Explicit Chain of Command profiles must appear in Chain of Command.',
)
assert.match(
  commissioner,
  /refreshArmyIntelligence/,
  'Commissioner dashboard must expose a Refresh Army Intelligence action.',
)
assert.match(
  refresh,
  /decodeArmyListToFiles/,
  'Refresh script must use the existing standalone decoder.',
)
assert.match(
  refresh,
  /getAction\(apiUrl, 'recentGames', \{ gameType: 'casual' \}\)/,
  'Refresh script must explicitly query casual recent-game army codes.',
)
assert.match(
  refresh,
  /matchesSourceFilters/,
  'Refresh script must support targeted source refreshes.',
)
assert.match(
  refresh,
  /status: 'failed'/,
  'Refresh script must preserve failed decodes as snapshot rows.',
)
assert.doesNotMatch(
  refresh,
  /submitLeagueResult|submitCasualResult|teamTournamentResult/,
  'Refresh script must not modify submission flows.',
)

console.log('Army Intelligence Phase 1 checks passed.')

function read(path) {
  return readFileSync(path, 'utf8')
}

function buildFixtureAnalysis(lists) {
  const entriesByList = lists.map((list) =>
    list.decoded.combatGroups.flatMap((group) => group.entries),
  )

  return {
    averageRegularOrders: average(lists.map((list) => list.decoded.orderCounts.regular)),
    averageTacticalAwarenessOrders: average(
      entriesByList.map((entries) =>
        entries.reduce((total, entry) => total + countTacticalAwarenessOrders(entry), 0),
      ),
    ),
    listCount: lists.length,
    chainOfCommand: buildUsageRows(entriesByList, (entry) => entry.chainOfCommand),
    forwardObservers: buildUsageRows(entriesByList, (entry) => entry.forwardObserver),
    hackers: buildUsageRows(entriesByList, (entry) => entry.hacker),
    modelUsage: buildUsageRows(entriesByList),
  }
}

function buildUsageRows(entriesByList, predicate = () => true) {
  const totalSelections = new Map()
  const listAppearances = new Map()

  entriesByList.forEach((entries) => {
    const seenInList = new Set()

    entries.filter(predicate).forEach((entry) => {
      totalSelections.set(entry.unit, (totalSelections.get(entry.unit) ?? 0) + 1)
      seenInList.add(entry.unit)
    })

    seenInList.forEach((name) => {
      listAppearances.set(name, (listAppearances.get(name) ?? 0) + 1)
    })
  })

  return Array.from(totalSelections.entries())
    .map(([name, totalSelections]) => {
      const listCount = listAppearances.get(name) ?? 0

      return {
        listCount,
        name,
        percentage: entriesByList.length ? (listCount / entriesByList.length) * 100 : 0,
        totalSelections,
      }
    })
    .sort(
      (left, right) =>
        right.totalSelections - left.totalSelections ||
        right.listCount - left.listCount ||
        left.name.localeCompare(right.name),
    )
}

function countTacticalAwarenessOrders(entry) {
  return entry.orderTypes.filter((orderType) =>
    orderType.trim().toLowerCase().replace(/[^a-z]/g, '').includes('tacticalawareness'),
  ).length
}

function average(values) {
  if (values.length === 0) {
    return 0
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10
}
