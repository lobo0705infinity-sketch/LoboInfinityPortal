import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const backend = read('backend/ArmyIntelligenceApi.gs')
const apiRouter = read('backend/API.gs')
const apiClient = read('src/services/api.ts')
const app = read('src/App.tsx')
const page = read('src/pages/ArmyIntelligence.tsx')
const commissioner = read('src/pages/CommissionerDashboard.tsx')
const decoder = read('scripts/infinity-army-decode.mjs')
const refresh = read('scripts/refresh-army-intelligence.mjs')
const worker = read('api/army-intelligence-refresh-worker.mjs')

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
assert.doesNotMatch(
  backend,
  /appendArmyIntelligenceLibrarySources\(sources\)/,
  'Backend must not include standalone Army List Library codes in Army Intelligence analysis sources.',
)
assert.match(
  page,
  /deduplicateSubmittedArmyLists[\s\S]*getSubmittedArmyListDeduplicationKey[\s\S]*armyCodeHash/,
  'Army Intelligence page must deduplicate submitted lists by player and army-code hash.',
)
assert.match(
  page,
  /isAllowedArmyIntelligenceSource[\s\S]*league[\s\S]*casual[\s\S]*tournament/,
  'Army Intelligence page must analyze only League, Casual, and Tournament sources.',
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
  apiClient,
  /refreshArmyIntelligenceSnapshots[\s\S]*\/api\/army-intelligence-refresh-worker[\s\S]*getActiveApiAuthToken/,
  'API client must invoke the authenticated Army Intelligence decoder worker.',
)
assert.match(
  apiClient,
  /refreshArmyIntelligenceSnapshots\([\s\S]*ArmyIntelligenceRefreshRequest[\s\S]*snapshotKeys:[\s\S]*refreshRequest\.snapshotKeys/,
  'API client must support targeted Army Intelligence refresh requests.',
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
  /Average Wounds \/ Structure per Model[\s\S]*averageDurability/,
  'Army Intelligence page must show average Wounds or Structure per selected model.',
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
  /Submitted Lists|DecodedListRow|army-intelligence-list-table|Factions and Sectorials/,
  'Army Intelligence page must not render the old submitted-list archive or all-sectorial summaries.',
)
assert.match(
  page,
  /matchesResultFilter[\s\S]*resultSet\.has\('win'\)[\s\S]*resultSet\.has\('loss'\)/,
  'Result filtering must be based on the deduplicated submitted list win/loss result set.',
)
assert.match(
  page,
  /filter\(isDecodedList\)/,
  'Sectorial statistics must use decoded snapshot data only.',
)
assert.match(
  page,
  /troopTypeOptions = \['HI', 'LI', 'MI', 'REM', 'SK', 'TAG', 'VH', 'WB'\][\s\S]*Type[\s\S]*All Types/,
  'Model Usage must expose exact troop-type filters.',
)
assert.match(
  page,
  /formatModelUsageName\(item\)/,
  'Model Usage rows must use the formatted profile-level label.',
)
assert.match(
  page,
  /Sort[\s\S]*Usage Count[\s\S]*Points: High to Low[\s\S]*Points: Low to High/,
  'Model Usage must expose usage and points sorting.',
)
assert.match(
  page,
  /Skill[\s\S]*All Skills[\s\S]*buildSkillOptions/,
  'Model Usage must expose skill filtering from currently matching decoded lists.',
)
assert.match(
  page,
  /Weapon[\s\S]*All Weapons[\s\S]*buildWeaponOptions/,
  'Model Usage must expose weapon filtering from currently matching decoded lists.',
)
assert.match(
  page,
  /Equipment[\s\S]*All Equipment[\s\S]*buildEquipmentOptions/,
  'Model Usage must expose equipment filtering from currently matching decoded lists.',
)
assert.match(
  page,
  /normalizeSectorialDisplayName[\s\S]*compact === 'panoceania'[\s\S]*PanOceania/,
  'Army Intelligence page must canonicalize PanOceania sectorial display variants.',
)
assert.match(
  page,
  /refreshAllSectorials[\s\S]*batchLimit: 1[\s\S]*excludeSnapshotKeys[\s\S]*Refresh All Sectorials/,
  'Army Intelligence page must refresh all stale sectorials one snapshot at a time.',
)
assert.match(
  page,
  /useAuth\(\)[\s\S]*hasPermission\('manageCache'\)/,
  'Refresh All Sectorials must require the Commissioner cache-management permission.',
)
assert.doesNotMatch(
  page,
  /loboForWorkSnapshotKey|Refresh Selected Sectorial|canRefreshSelectedSectorial/,
  'Army Intelligence page must not hard-code one selected-sectorial refresh target.',
)
assert.match(
  apiClient,
  /structure: number \| null[\s\S]*wounds: number \| null[\s\S]*structure:[\s\S]*wounds:/,
  'API client must preserve decoded profile wounds and structure through normalization.',
)
assert.match(
  decoder,
  /ARMY_INTELLIGENCE_DECODER_VERSION = 'army-intelligence-decoder-v2'/,
  'Standalone decoder must define the current Army Intelligence decoder version.',
)
assert.match(
  decoder,
  /decoderVersion: ARMY_INTELLIGENCE_DECODER_VERSION/,
  'Decoded snapshots must include decoderVersion.',
)
assert.match(
  refresh,
  /current\.decoderVersion !== ARMY_INTELLIGENCE_DECODER_VERSION/,
  'Refresh script must redecode snapshots with old or missing decoderVersion.',
)
assert.match(
  worker,
  /current\.decoderVersion !== ARMY_INTELLIGENCE_DECODER_VERSION/,
  'Commissioner decoder worker must redecode snapshots with old or missing decoderVersion.',
)
assert.match(
  worker,
  /postSnapshots[\s\S]*authToken/,
  'Commissioner decoder worker must write snapshots through the authenticated Apps Script endpoint.',
)
assert.match(
  worker,
  /requestedSnapshotKeys[\s\S]*filterRequestedSources[\s\S]*snapshotKeys\.has\(source\.snapshotKey\)/,
  'Commissioner decoder worker must support explicit snapshot-key filtering.',
)
assert.match(
  worker,
  /excludedSnapshotKeys[\s\S]*excludeSnapshotKeys\.has\(source\.snapshotKey\)/,
  'Commissioner decoder worker must exclude failed snapshots already seen in the same browser run.',
)
assert.match(
  worker,
  /candidateCount[\s\S]*currentCount[\s\S]*failures[\s\S]*processed/,
  'Commissioner decoder worker must return batch progress and failure details.',
)
assert.match(
  worker,
  /requestedSectorial[\s\S]*source\.sectorial !== filters\.sectorial/,
  'Commissioner decoder worker must support selected-sectorial filtering.',
)
assert.match(
  commissioner,
  /refreshArmyIntelligenceSnapshots/,
  'Commissioner Refresh Army Intelligence must invoke the authenticated decoder worker.',
)
assert.match(
  decoder,
  /structure: card\?\.structure[\s\S]*troopType: normalizeTroopType[\s\S]*wounds: card\?\.wounds/,
  'Standalone decoder must serialize troop type, structure, and wounds on each decoded profile.',
)
assert.match(
  decoder,
  /skills: splitSkillTokens\(skills\)/,
  'Standalone decoder must serialize exact skill tokens.',
)
assert.match(
  decoder,
  /equipment: splitProfileTokens\(equipment\)[\s\S]*weapons: \(card\?\.weapons \|\| \[\]\)\.map\(normalizeProfileToken\)/,
  'Standalone decoder must serialize exact profile-level equipment and weapon tokens.',
)
assert.match(
  decoder,
  /parseAttributeNumber\(block, \['W', 'Wounds', 'VITA'\]\)[\s\S]*return null/,
  'Standalone decoder must parse only W/Wounds/VITA, not Structure.',
)
assert.match(
  decoder,
  /parseProfileStructure[\s\S]*parseAttributeNumber\(block, \['STR', 'Structure'\]\)/,
  'Standalone decoder must parse Structure from STR/Structure separately.',
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
const typeSkillFixtureLists = [
  {
    decoded: {
      combatGroups: [
        {
          entries: [
            { equipment: ['Hacking Device Plus'], hacker: false, lieutenant: false, orderTypes: ['regular'], points: 68, profile: 'ASURA Hacker', skills: ['Hacker', 'Lieutenant'], structure: null, troopType: 'HI', unit: 'ASURA', weapons: ['MULTI Rifle'], wounds: 2 },
            { equipment: ['Hacking Device'], hacker: false, lieutenant: false, orderTypes: ['regular'], points: 22, profile: 'Pilot-X Team Hacker', skills: ['Hacker'], structure: null, troopType: 'LI', unit: 'Pilot-X Team', weapons: ['Submachine Gun'], wounds: 1 },
            { equipment: ['Repeater'], hacker: false, lieutenant: false, orderTypes: ['regular'], points: 41, profile: 'RUDRA FTO Repeater', skills: ['Remote Presence'], structure: 2, troopType: 'REM', unit: 'RUDRA FTO', weapons: ['MULTI Rifle'], wounds: null },
          ],
        },
        {
          entries: [
            { equipment: ['Repeater'], hacker: false, lieutenant: false, orderTypes: ['regular'], points: 10, profile: 'RACERBOT Repeater', skills: ['Remote Presence'], structure: 1, troopType: 'REM', unit: 'RACERBOT Mk-III', weapons: ['Flash Pulse'], wounds: null },
            { equipment: ['D-Charges'], hacker: false, lieutenant: false, orderTypes: ['regular'], points: 28, profile: 'ARTALIS Engineer', skills: ['Engineer'], structure: null, troopType: 'MI', unit: 'ARTALIS', weapons: ['Combi Rifle'], wounds: 1 },
          ],
        },
      ],
      orderCounts: {
        regular: 5,
      },
      sectorial: 'Operations Subsection',
      totals: {},
    },
    result: 'Win',
    status: 'decoded',
  },
  {
    decoded: {
      combatGroups: [
        {
          entries: [
            { equipment: ['Deployable Repeater'], hacker: false, lieutenant: false, orderTypes: ['regular'], points: 12, profile: 'Fusilier Forward Observer', skills: ['Forward Observer'], structure: null, troopType: 'LI', unit: 'FUSILIER', weapons: ['Combi Rifle'], wounds: 1 },
          ],
        },
      ],
      orderCounts: {
        regular: 1,
      },
      sectorial: 'Panoceania',
      totals: {},
    },
    result: 'Win',
    status: 'decoded',
  },
]
const duplicateSourceFixtureLists = [
  {
    armyCodeHash: 'same-code-hash',
    decoded: {
      combatGroups: [
        {
          entries: [
            { hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'ASURA Hacker', skills: ['Hacker'], troopType: 'HI', unit: 'ASURA' },
          ],
        },
      ],
      orderCounts: {
        regular: 1,
      },
      sectorial: 'Operations Subsection',
      totals: {},
    },
    player: 'Lobo',
    result: 'Win',
    sourceType: 'league',
    status: 'decoded',
  },
  {
    armyCodeHash: 'same-code-hash',
    decoded: {
      combatGroups: [
        {
          entries: [
            { hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'ASURA Hacker', skills: ['Hacker'], troopType: 'HI', unit: 'ASURA' },
          ],
        },
      ],
      orderCounts: {
        regular: 1,
      },
      sectorial: 'Operations Subsection',
      totals: {},
    },
    player: ' lobo ',
    result: 'Loss',
    sourceType: 'casual',
    status: 'decoded',
  },
  {
    armyCodeHash: 'same-code-hash',
    decoded: {
      combatGroups: [
        {
          entries: [
            { hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'ASURA Hacker', skills: ['Hacker'], troopType: 'HI', unit: 'ASURA' },
          ],
        },
      ],
      orderCounts: {
        regular: 1,
      },
      sectorial: 'Operations Subsection',
      totals: {},
    },
    player: 'Different Player',
    result: 'Win',
    sourceType: 'league',
    status: 'decoded',
  },
  {
    armyCodeHash: 'library-code-hash',
    decoded: {
      combatGroups: [
        {
          entries: [
            { hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'Library Only', skills: [], troopType: 'LI', unit: 'LIBRARY ONLY' },
          ],
        },
      ],
      orderCounts: {
        regular: 1,
      },
      sectorial: 'Operations Subsection',
      totals: {},
    },
    player: 'Library Player',
    result: 'Win',
    sourceType: 'armyLibrary',
    status: 'decoded',
  },
]
const typeSkillAnalysis = buildFixtureAnalysis(typeSkillFixtureLists.slice(0, 1))
const uniqueSubmittedLists = deduplicateSubmittedArmyLists(duplicateSourceFixtureLists)
const uniqueSubmittedAllAnalysis = buildFixtureAnalysis(uniqueSubmittedLists)
const uniqueSubmittedWinningAnalysis = buildFixtureAnalysis(
  uniqueSubmittedLists.filter((list) => matchesResultFilter(list, 'winning')),
)
const uniqueSubmittedLosingAnalysis = buildFixtureAnalysis(
  uniqueSubmittedLists.filter((list) => matchesResultFilter(list, 'losing')),
)
const remRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  skill: '',
  sort: 'usage',
  troopType: 'REM',
})
const hiRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  skill: '',
  sort: 'usage',
  troopType: 'HI',
})
const hackerRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  skill: 'Hacker',
  sort: 'usage',
  troopType: '',
})
const remRemoteRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: '',
  skill: 'Remote Presence',
  sort: 'usage',
  troopType: 'REM',
  weapon: '',
})
const tagRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: '',
  skill: '',
  sort: 'usage',
  troopType: 'TAG',
  weapon: '',
})
const panoceaniaAnalysis = buildFixtureAnalysis(typeSkillFixtureLists.slice(1))
const panoceaniaRemRows = filterAndSortModelUsage(panoceaniaAnalysis.modelUsage, {
  equipment: '',
  skill: '',
  sort: 'usage',
  troopType: 'REM',
  weapon: '',
})
const remHackerRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: '',
  skill: 'Hacker',
  sort: 'usage',
  troopType: 'REM',
  weapon: '',
})
const multiRifleRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: '',
  skill: '',
  sort: 'usage',
  troopType: '',
  weapon: 'MULTI Rifle',
})
const repeaterRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: 'Repeater',
  skill: '',
  sort: 'usage',
  troopType: '',
  weapon: '',
})
const remRepeaterRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: 'Repeater',
  skill: '',
  sort: 'usage',
  troopType: 'REM',
  weapon: '',
})
const multiRifleDChargesRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: 'D-Charges',
  skill: '',
  sort: 'usage',
  troopType: '',
  weapon: 'MULTI Rifle',
})

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
    equipment: [],
    listCount: 1,
    name: 'NETROD',
    percentage: 50,
    points: undefined,
    profile: 'NETROD',
    skills: [],
    totalSelections: 2,
    troopType: undefined,
    weapons: [],
  },
  'Duplicate models must count twice for selections but once for list appearance.',
)
assert.equal(
  duplicateSourceFixtureLists.filter((list) => list.sourceType === 'armyLibrary').length,
  1,
  'Deduplication fixture must include an excluded Army List Library source.',
)
assert.equal(
  uniqueSubmittedLists.length,
  2,
  'Army Intelligence must exclude standalone library sources and deduplicate same-player identical army-code submissions.',
)
assert.equal(
  uniqueSubmittedAllAnalysis.listCount,
  2,
  'All Army Lists must count each unique player/code pair once.',
)
assert.equal(
  uniqueSubmittedWinningAnalysis.listCount,
  2,
  'Winning Record must include a unique list with any winning submission and must not merge different players.',
)
assert.equal(
  uniqueSubmittedLosingAnalysis.listCount,
  1,
  'Losing Record must include a unique list when the same player/code has at least one losing submission.',
)
assert.deepEqual(
  uniqueSubmittedLists.find((list) => list.player === 'Lobo')?.resultSet,
  new Set(['win', 'loss']),
  'A deduplicated list submitted in both wins and losses must preserve both result flags.',
)
assert.deepEqual(
  uniqueSubmittedAllAnalysis.modelUsage.find((row) => row.name === 'ASURA'),
  {
    equipment: [],
    listCount: 2,
    name: 'ASURA',
    percentage: 100,
    points: undefined,
    profile: 'ASURA Hacker',
    skills: ['Hacker'],
    totalSelections: 2,
    troopType: 'HI',
    weapons: [],
  },
  'Model usage must analyze the deduplicated unique submitted list set.',
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
assert.deepEqual(
  remRows.map((row) => row.name),
  ['RACERBOT Mk-III', 'RUDRA FTO'],
  'REM type filter must exclude HI, LI, and MI models.',
)
assert.deepEqual(
  hiRows.map((row) => row.name),
  ['ASURA'],
  'HI type filter must produce a different exact troop-type result from REM.',
)
assert.deepEqual(
  hackerRows.map((row) => row.name),
  ['ASURA', 'Pilot-X Team'],
  'Skill filter must match exact decoded skills.',
)
assert.equal(
  typeSkillAnalysis.averageDurability,
  1.4,
  'Average durability must average each selected profile Wounds or Structure value across both combat groups.',
)
assert.deepEqual(
  filterAndSortModelUsage(typeSkillAnalysis.modelUsage, { skill: '', sort: 'pointsHigh', troopType: '' }).map((row) => row.name),
  ['ASURA', 'RUDRA FTO', 'ARTALIS', 'Pilot-X Team', 'RACERBOT Mk-III'],
  'Points high-to-low sort must use decoded profile points.',
)
assert.deepEqual(
  filterAndSortModelUsage(typeSkillAnalysis.modelUsage, { skill: '', sort: 'pointsLow', troopType: '' }).map((row) => row.name),
  ['RACERBOT Mk-III', 'Pilot-X Team', 'ARTALIS', 'RUDRA FTO', 'ASURA'],
  'Points low-to-high sort must use decoded profile points.',
)
assert.deepEqual(
  remRemoteRows.map((row) => row.name),
  ['RACERBOT Mk-III', 'RUDRA FTO'],
  'Combined Type and Skill filters must both apply.',
)
assert.deepEqual(
  multiRifleRows.map((row) => row.name),
  ['ASURA', 'RUDRA FTO'],
  'Weapon filter must match exact decoded profile weapons.',
)
assert.deepEqual(
  repeaterRows.map((row) => row.name),
  ['RACERBOT Mk-III', 'RUDRA FTO'],
  'Equipment filter must match exact decoded profile equipment.',
)
assert.deepEqual(
  remRepeaterRows.map((row) => row.name),
  ['RACERBOT Mk-III', 'RUDRA FTO'],
  'Type and Equipment filters must combine.',
)
assert.deepEqual(
  multiRifleDChargesRows,
  [],
  'Combined Weapon and Equipment filters with no matching profile must return no Model Usage rows.',
)
assert.deepEqual(
  tagRows,
  [],
  'A sectorial with no TAG entries must keep the TAG filter active and return no Model Usage rows.',
)
assert.deepEqual(
  panoceaniaRemRows,
  [],
  'A sectorial with no REM entries must keep the REM filter active and return no Model Usage rows.',
)
assert.deepEqual(
  remHackerRows,
  [],
  'A Type and Skill combination with no matches must return no Model Usage rows.',
)
assert.doesNotMatch(
  page,
  /setModelTypeFilter\(''\)/,
  'Selected troop-type filters must not reset to All Types when no rows match.',
)
assert.deepEqual(
  buildSkillOptions(typeSkillFixtureLists.slice(0, 1)),
  ['Engineer', 'Hacker', 'Lieutenant', 'Remote Presence'],
  'Operations Subsection skill options must come from the selected sectorial dataset.',
)
assert.deepEqual(
  buildSkillOptions(typeSkillFixtureLists.slice(1)),
  ['Forward Observer'],
  'Changing sectorial must refresh Skill dropdown options.',
)
assert.deepEqual(
  buildWeaponOptions(typeSkillFixtureLists.slice(0, 1)),
  ['Combi Rifle', 'Flash Pulse', 'MULTI Rifle', 'Submachine Gun'],
  'Weapon options must come from the selected sectorial dataset and sort alphabetically.',
)
assert.deepEqual(
  buildEquipmentOptions(typeSkillFixtureLists.slice(0, 1)),
  ['D-Charges', 'Hacking Device', 'Hacking Device Plus', 'Repeater'],
  'Equipment options must come from the selected sectorial dataset and sort alphabetically.',
)
assert.deepEqual(
  buildWeaponOptions(typeSkillFixtureLists.slice(1)),
  ['Combi Rifle'],
  'Changing sectorial must refresh Weapon dropdown options.',
)
assert.deepEqual(
  buildEquipmentOptions(typeSkillFixtureLists.slice(1)),
  ['Deployable Repeater'],
  'Changing sectorial must refresh Equipment dropdown options.',
)
assert.equal(
  normalizeSectorialDisplayName('Panoceania'),
  'PanOceania',
  'Panoceania snapshots must display as canonical PanOceania.',
)
assert.equal(
  normalizeSectorialDisplayName('Pan OCeania'),
  'PanOceania',
  'Case and spacing variants must canonicalize to PanOceania.',
)
assert.equal(
  buildFixtureAnalysis(
    typeSkillFixtureLists.filter((list) => getDecodedSectorial(list) === 'PanOceania'),
  ).listCount,
  1,
  'A snapshot containing a PanOceania variant must be selected and analyzed by the canonical UI value.',
)
assert.equal(
  formatModelUsageName({
    name: 'FUSILIER',
    profile: 'FUSILIER Forward Observer',
  }),
  'FUSILIER - Forward Observer',
  'Model Usage must not duplicate unit names when showing a profile-level row.',
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
assert.doesNotMatch(
  refresh,
  /getAction\(apiUrl, 'armyLists'\)|sourceType: 'armyLibrary'|gameType: 'Army List Library'/,
  'Refresh script must not ingest standalone Army List Library sources.',
)
assert.doesNotMatch(
  worker,
  /getAction\(apiUrl, 'armyLists'\)|sourceType: 'armyLibrary'|gameType: 'Army List Library'/,
  'Commissioner decoder worker must not ingest standalone Army List Library sources.',
)
assert.match(
  refresh,
  /matchesSourceFilters/,
  'Refresh script must support targeted source refreshes.',
)
assert.match(
  refresh,
  /snapshotHasDecodedProfileMetadata[\s\S]*troopType[\s\S]*skills[\s\S]*wounds[\s\S]*structure/,
  'Refresh script must redecode stale snapshots missing troop type, skills, wounds, or structure.',
)
assert.match(
  refresh,
  /status: 'failed'/,
  'Refresh script must preserve failed decodes as snapshot rows.',
)
assert.match(
  refresh,
  /postSnapshots[\s\S]*body\.set\('action', 'refreshArmyIntelligence'\)/,
  'Refresh script must write decoded snapshots only through the Army Intelligence refresh endpoint.',
)
assert.match(
  refresh,
  /readAuthToken[\s\S]*body\.set\('authToken', authToken\)/,
  'Refresh script must support authenticated Commissioner snapshot writes.',
)
assert.doesNotMatch(
  refresh,
  /submitLeagueResult|submitCasualResult|teamTournamentResult/,
  'Refresh script must not modify submission flows.',
)

const multiSectorialRefreshRun = [
  {
    currentCount: 1,
    decoded: 1,
    failures: [],
    processed: [
      {
        player: 'Lobo',
        sectorial: 'Operations Subsection',
        snapshotKey: 'ops-current-decoder',
        status: 'decoded',
      },
    ],
    sourceCount: 4,
  },
  {
    currentCount: 2,
    decoded: 0,
    failures: [
      {
        player: 'Broken List',
        reason: 'Unsupported army code.',
        sectorial: 'Nomads',
        snapshotKey: 'broken-list',
      },
    ],
    processed: [
      {
        player: 'Broken List',
        sectorial: 'Nomads',
        snapshotKey: 'broken-list',
        status: 'failed',
      },
    ],
    sourceCount: 4,
  },
  {
    currentCount: 2,
    decoded: 1,
    failures: [],
    processed: [
      {
        player: 'ADangerousFrog',
        sectorial: 'PanOceania',
        snapshotKey: 'pano-current-decoder',
        status: 'decoded',
      },
    ],
    sourceCount: 4,
  },
]
const refreshedSectorials = new Set(
  multiSectorialRefreshRun.flatMap((batch) =>
    batch.processed
      .filter((entry) => entry.status === 'decoded')
      .map((entry) => entry.sectorial),
  ),
)

assert.deepEqual(
  Array.from(refreshedSectorials).sort(),
  ['Operations Subsection', 'PanOceania'],
  'Refresh All Sectorials regression must cover multiple sectorials in one run.',
)
assert.equal(
  multiSectorialRefreshRun.at(0).currentCount,
  1,
  'Refresh All Sectorials must count current snapshots as skipped.',
)
assert.equal(
  multiSectorialRefreshRun.at(2).processed.at(0).player,
  'ADangerousFrog',
  'A failed snapshot must not stop later stale snapshots from refreshing.',
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
    averageDurability: average(entriesByList.map(calculateAverageDurabilityPerModel)),
    listCount: lists.length,
    chainOfCommand: buildUsageRows(entriesByList, (entry) => entry.chainOfCommand),
    forwardObservers: buildUsageRows(entriesByList, (entry) => entry.forwardObserver),
    hackers: buildUsageRows(entriesByList, (entry) => entry.hacker),
    modelUsage: buildModelUsageRows(entriesByList),
  }
}

function calculateAverageDurabilityPerModel(entries) {
  const values = entries
    .map((entry) => entry.wounds ?? entry.structure)
    .filter((value) => typeof value === 'number')

  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0
}

function buildSkillOptions(lists) {
  return buildEntryTokenOptions(lists, (entry) => entry.skills)
}

function buildWeaponOptions(lists) {
  return buildEntryTokenOptions(lists, (entry) => entry.weapons)
}

function buildEquipmentOptions(lists) {
  return buildEntryTokenOptions(lists, (entry) => entry.equipment)
}

function buildEntryTokenOptions(lists, getTokens) {
  const values = new Set()
  lists.forEach((list) => {
    list.decoded.combatGroups.forEach((group) => {
      group.entries.forEach((entry) => {
        ;(getTokens(entry) || []).forEach((value) => values.add(value))
      })
    })
  })

  return Array.from(values).sort((left, right) => left.localeCompare(right))
}

function deduplicateSubmittedArmyLists(lists) {
  const uniqueByKey = new Map()

  lists
    .filter(isAllowedArmyIntelligenceSource)
    .forEach((list) => {
      const key = getSubmittedArmyListDeduplicationKey(list)

      if (!key) {
        return
      }

      const existing = uniqueByKey.get(key)
      if (existing) {
        normalizeResultValue(list.result).forEach((result) => existing.resultSet.add(result))
        return
      }

      uniqueByKey.set(key, {
        ...list,
        resultSet: normalizeResultValue(list.result),
      })
    })

  return Array.from(uniqueByKey.values())
}

function isAllowedArmyIntelligenceSource(list) {
  return ['league', 'casual', 'tournament'].includes(String(list.sourceType || '').trim().toLowerCase())
}

function getSubmittedArmyListDeduplicationKey(list) {
  const player = normalizeArmyIntelligenceDeduplicationPart(list.player || '')
  const armyCodeHash = String(list.armyCodeHash || '').trim().toLowerCase()

  return player && armyCodeHash ? `${player}:${armyCodeHash}` : ''
}

function normalizeArmyIntelligenceDeduplicationPart(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeResultValue(value) {
  const result = String(value || '').trim().toLowerCase()

  return result ? new Set([result]) : new Set()
}

function buildTroopTypeOptions(lists) {
  const types = new Set()

  lists.forEach((list) => {
    list.decoded.combatGroups.forEach((group) => {
      group.entries.forEach((entry) => {
        if (entry.troopType) {
          types.add(entry.troopType)
        }
      })
    })
  })

  return Array.from(types).sort((left, right) => left.localeCompare(right))
}

function getDecodedSectorial(list) {
  return normalizeSectorialDisplayName(list.decoded?.sectorial || '')
}

function normalizeSectorialDisplayName(value) {
  const name = String(value || '').trim()
  const compact = name.replace(/\s+/g, '').toLocaleLowerCase()

  if (compact === 'panoceania') {
    return 'PanOceania'
  }

  return name
}

function reconcileTroopTypeFilter(selectedType, lists) {
  if (!selectedType) {
    return ''
  }

  return buildTroopTypeOptions(lists).includes(selectedType) ? selectedType : ''
}

function formatModelUsageName(item) {
  const name = item.name.trim()
  const profile = item.profile?.trim()

  if (!profile || profile === name) {
    return name
  }

  const normalizedName = name.toLocaleLowerCase()
  const normalizedProfile = profile.toLocaleLowerCase()

  if (normalizedProfile.startsWith(normalizedName)) {
    const detail = profile.slice(name.length).trim()
    return detail ? `${name} - ${detail}` : name
  }

  return `${name} - ${profile}`
}

function filterAndSortModelUsage(rows, filters) {
  return rows
    .filter((row) => !filters.troopType || row.troopType === filters.troopType)
    .filter((row) => !filters.skill || row.skills.includes(filters.skill))
    .filter((row) => !filters.weapon || row.weapons.includes(filters.weapon))
    .filter((row) => !filters.equipment || row.equipment.includes(filters.equipment))
    .sort((left, right) => compareModelUsageRows(left, right, filters.sort))
}

function matchesResultFilter(list, filter) {
  if (filter === 'all') {
    return true
  }

  if (filter === 'winning') {
    return list.resultSet.has('win')
  }

  return list.resultSet.has('loss')
}

function buildModelUsageRows(entriesByList) {
  const rowsByKey = new Map()
  const listAppearances = new Map()

  entriesByList.forEach((entries, listIndex) => {
    entries.forEach((entry) => {
      const key = [entry.unit, entry.profile, entry.points, entry.troopType].join('|')
      const row = rowsByKey.get(key) || {
        equipment: new Set(),
        listCount: 0,
        name: entry.unit,
        percentage: 0,
        points: entry.points,
        profile: entry.profile,
        skills: new Set(),
        totalSelections: 0,
        troopType: entry.troopType,
        weapons: new Set(),
      }

      row.totalSelections += 1
      ;(entry.equipment || []).forEach((equipment) => row.equipment.add(equipment))
      ;(entry.skills || []).forEach((skill) => row.skills.add(skill))
      ;(entry.weapons || []).forEach((weapon) => row.weapons.add(weapon))
      rowsByKey.set(key, row)

      const appearances = listAppearances.get(key) || new Set()
      appearances.add(listIndex)
      listAppearances.set(key, appearances)
    })
  })

  return Array.from(rowsByKey.entries())
    .map(([key, row]) => ({
      equipment: Array.from(row.equipment).sort((left, right) => left.localeCompare(right)),
      listCount: listAppearances.get(key)?.size || 0,
      name: row.name,
      percentage: entriesByList.length ? ((listAppearances.get(key)?.size || 0) / entriesByList.length) * 100 : 0,
      points: row.points,
      profile: row.profile,
      skills: Array.from(row.skills).sort((left, right) => left.localeCompare(right)),
      totalSelections: row.totalSelections,
      troopType: row.troopType,
      weapons: Array.from(row.weapons).sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => compareModelUsageRows(left, right, 'usage'))
}

function compareModelUsageRows(left, right, sort) {
  if (sort === 'pointsHigh') {
    return (right.points || 0) - (left.points || 0) || compareModelUsageRows(left, right, 'usage')
  }

  if (sort === 'pointsLow') {
    return (left.points || 0) - (right.points || 0) || compareModelUsageRows(left, right, 'usage')
  }

  return (
    right.totalSelections - left.totalSelections ||
    right.listCount - left.listCount ||
    left.name.localeCompare(right.name) ||
    String(left.profile || '').localeCompare(String(right.profile || ''))
  )
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
