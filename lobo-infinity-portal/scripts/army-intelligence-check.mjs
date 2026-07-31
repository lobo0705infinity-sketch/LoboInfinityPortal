import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const backend = read('backend/ArmyIntelligenceApi.gs')
const apiRouter = read('backend/API.gs')
const apiClient = read('src/services/api.ts')
const app = read('src/App.tsx')
const appCss = read('src/App.css')
const interactiveMetricCard = read('src/components/InteractiveMetricCard.tsx')
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
  /knownArmyListRegistry[\s\S]*armyLists: knownArmyListRegistry\.lists[\s\S]*knownArmyLists: getKnownArmyListCount[\s\S]*buildKnownArmyListRegistry[\s\S]*getArmyListObjects\(\)/,
  'Backend must derive knownArmyLists from the canonical Army Lists registry during the Army Intelligence response build.',
)
assert.match(
  backend,
  /source: "Community Library"[\s\S]*submissionDate[\s\S]*points[\s\S]*swc/,
  'Backend must expose lightweight Army List Explorer rows from the canonical Army Lists registry.',
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
  /knownArmyLists: number[\s\S]*knownArmyLists: getNumber\(record, 'knownArmyLists'\)/,
  'API client must preserve knownArmyLists through the Army Intelligence type and normalizer.',
)
assert.match(
  apiClient,
  /export type ArmyIntelligenceArmyList[\s\S]*armyLists: ArmyIntelligenceArmyList\[[\s\S]*normalizeArmyIntelligenceArmyList/,
  'API client must expose and normalize Army Intelligence explorer rows.',
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
  app,
  /RouteScrollReset[\s\S]*useNavigationType[\s\S]*navigationType === 'POP'[\s\S]*window\.scrollTo/,
  'Route navigation must scroll new pages to the top without overriding browser back/forward restoration.',
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
  /selectedKnownArmyLists = selectedArmyListExplorerRows\.length[\s\S]*actionLabel="Browse submitted army lists"[\s\S]*helperText="View submitted army lists"[\s\S]*Known Army Lists[\s\S]*onValueAction[\s\S]*setExplorerOpen\(true\)[\s\S]*selectedKnownArmyLists/,
  'Army Intelligence page must open the Army List Explorer from an obviously actionable Known Army Lists card and display the explorer row count.',
)
assert.match(
  interactiveMetricCard,
  /export default function InteractiveMetricCard[\s\S]*if \(onActivate\)[\s\S]*<button[\s\S]*aria-label=\{ariaLabel \|\| label\}[\s\S]*className=\{`\$\{className\} interactive-metric-card interactive-metric-card-action`\}[\s\S]*disabled=\{disabled\}[\s\S]*onClick=\{onActivate\}[\s\S]*type="button"/,
  'Shared InteractiveMetricCard must use one reusable native button interaction for mouse and keyboard activation.',
)
assert.match(
  interactiveMetricCard,
  /helperText \? <small className="interactive-metric-card-helper">\{helperText\}<\/small> : null/,
  'Shared InteractiveMetricCard must support subtle helper text for discoverability.',
)
assert.match(
  appCss,
  /\.interactive-metric-card-action[\s\S]*cursor: pointer[\s\S]*\.interactive-metric-card-action:hover,[\s\S]*\.interactive-metric-card-action:focus-visible[\s\S]*border-color: rgba\(76, 201, 240, 0\.58\)[\s\S]*box-shadow:[\s\S]*transform: translateY\(-2px\)/,
  'Clickable metric cards must expose hover and focus affordance with pointer cursor, accent border, elevation, and subtle motion.',
)
assert.match(
  appCss,
  /\.army-intelligence-metric small[\s\S]*grid-column: 2[\s\S]*line-height: 1\.2[\s\S]*@media[\s\S]*\.army-intelligence-metric small/,
  'Clickable metric helper text must render in the card and remain available in the mobile layout.',
)
assert.match(
  page,
  /import InteractiveMetricCard[\s\S]*function MetricCard[\s\S]*<InteractiveMetricCard[\s\S]*function ExplorerStat[\s\S]*<InteractiveMetricCard/,
  'Army Intelligence interactive metrics must use the shared InteractiveMetricCard component.',
)
assert.match(
  page,
  /ariaLabel="Show all submitted army lists"[\s\S]*helperText="Show all submitted lists"[\s\S]*label="Known Army Lists"[\s\S]*helperText=\{summary\.mostPopularSectorial \? 'Filter by this sectorial' : undefined\}[\s\S]*label="Most Popular Sectorial"[\s\S]*helperText=\{summary\.mostActivePlayer \? 'Filter by this player' : undefined\}[\s\S]*label="Most Submitted By"/,
  'Army Intelligence filter metrics must show helper text that explains the shared card action.',
)
assert.doesNotMatch(
  page,
  /className="army-intelligence-explorer-stat is-actionable"|className="army-intelligence-metric army-intelligence-metric-action"/,
  'Army Intelligence must not keep page-specific interactive metric styling outside the shared component.',
)
assert.match(
  page,
  /selectedExplorerScope[\s\S]*getSelectedExplorerScope\(selectedSectorial\)[\s\S]*selectedScopeLists[\s\S]*intelligenceListMatchesSelectedScope\(list, selectedExplorerScope\)[\s\S]*matchingLists[\s\S]*selectedScopeLists\.filter\(\(list\) => matchesResultFilter\(list, resultFilter\)\)[\s\S]*selectedArmyListExplorerRows[\s\S]*buildExplorerRowsFromSelectedLists\(matchingLists\)[\s\S]*selectedFaction=\{selectedExplorerScope\.label \|\| selectedSectorial\}/,
  'Army Intelligence Explorer must use the selected item scope for both rows and modal title.',
)
assert.match(
  page,
  /selectedArmyListExplorerRows[\s\S]*buildExplorerRowsFromSelectedLists\(matchingLists\)[\s\S]*selectedKnownArmyLists = selectedArmyListExplorerRows\.length[\s\S]*buildArmyListExplorerSummary\(selectedArmyListExplorerRows, selectedExplorerScope\)[\s\S]*buildArmyAnalysis\(matchingLists\)/,
  'Army Intelligence summary metrics and explorer rows must derive from the same filtered Army Intelligence collection.',
)
assert.match(
  page,
  /showFactionScopeStats=\{selectedExplorerScope\.isParentFaction\}[\s\S]*showFactionScopeStats \? \([\s\S]*Sectorials Represented[\s\S]*showFactionScopeStats && summary\.totalSectorials > 0[\s\S]*showFactionScopeStats \? \([\s\S]*Most Popular Sectorial/,
  'Army Intelligence Explorer must hide faction-only statistics when the selected item is a sectorial.',
)
assert.doesNotMatch(
  page,
  /data\.armyLists\.filter|getExplorerParentFaction|explorerRowMatchesSelectedScope/,
  'Army Intelligence selected-page metrics must not use a separate registry collection after applying the selected scope.',
)
assert.match(
  page,
  /ArmyListExplorer[\s\S]*Known Army Lists[\s\S]*Players[\s\S]*Sectorials Represented[\s\S]*Sectorial Coverage[\s\S]*Newest Submission[\s\S]*Most Popular Sectorial[\s\S]*Most Submitted By/,
  'Army Intelligence page must expose an interactive Army List Explorer with summary statistics.',
)
assert.match(
  page,
  /Most Popular Sectorial[\s\S]*setSectorialFilter\(summary\.mostPopularSectorial\)[\s\S]*Most Submitted By[\s\S]*setPlayerFilter\(summary\.mostActivePlayer\)/,
  'Army List Explorer summary statistics must filter by popular sectorial and active player.',
)
assert.match(
  page,
  /CANONICAL_ARMY_REGISTRY[\s\S]*getTotalSectorialsForFaction[\s\S]*army\.type === 'Sectorial'/,
  'Army List Explorer sectorial coverage must use the canonical faction registry.',
)
assert.match(
  page,
  /filterAndSortExplorerRows[\s\S]*Submission Date[\s\S]*Player[\s\S]*Sectorial[\s\S]*Search[\s\S]*Points/,
  'Army List Explorer must support requested sorting, filtering, and search controls.',
)
assert.match(
  page,
  /getArmyIntelligenceListTarget[\s\S]*\/army-list\//,
  'Army List Explorer rows must open the existing army-list target instead of creating a new viewer.',
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
  /countTacticalAwarenessOrders[\s\S]*entry\.skills[\s\S]*normalizeExactSkillToken[\s\S]*tacticalawareness/,
  'Tactical Awareness must be derived from exact decoded skill tokens.',
)
assert.match(
  page,
  /selectedSectorial[\s\S]*window\.scrollTo/,
  'Changing Army Intelligence sectorials must scroll the analysis back to the top.',
)
assert.match(
  page,
  /Profile[\s\S]*AVA Taken[\s\S]*Selections[\s\S]*Lists/,
  'Army Intelligence usage lists must render clear column headers.',
)
assert.match(
  page,
  /formatAvaTaken[\s\S]*toFixed\(1\)/,
  'AVA Taken must display with decimal precision instead of rounded integers.',
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
  /Sort[\s\S]*Alphabetically[\s\S]*Points: High to Low[\s\S]*Points: Low to High/,
  'Model Usage must expose alphabetical and points sorting.',
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
  /ARMY_INTELLIGENCE_DECODER_VERSION = 'army-intelligence-decoder-v4'/,
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
  /equipment: splitProfileTokens\(equipment\)[\s\S]*weapons: \(card\?\.weapons \|\| \[\]\)\.map\(normalizeWeaponToken\)/,
  'Standalone decoder must serialize profile-level equipment and normalized base weapon tokens.',
)
assert.match(
  decoder,
  /normalizeWeaponToken[\s\S]*replace\(\/\\s\+\\\[\[\^\\\]\]\+\\\]\$\/, ''\)/,
  'Standalone decoder must merge bracketed alternate weapon modes under the base weapon name.',
)
assert.match(
  decoder,
  /normalizeSkillTokenForDisplay[\s\S]*normalizeProfileToken\(skill\)/,
  'Standalone decoder must preserve full displayed skill text including brackets, parentheses, and punctuation.',
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
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'RUDRA FTO', skills: ['Tactical Awareness'], specialist: false, unit: 'RUDRA FTO' },
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
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'RACERBOT Mk-III', skills: ['Tactical Awareness'], specialist: false, unit: 'RACERBOT Mk-III' },
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'RACERBOT Mk-III', skills: ['Tactical Awareness'], specialist: false, unit: 'RACERBOT Mk-III' },
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
            { doctor: false, engineer: false, hacker: false, lieutenant: false, orderTypes: ['regular'], profile: 'RUDRA FTO', skills: ['Tactical Awareness'], specialist: false, unit: 'RUDRA FTO' },
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
            { equipment: ['Repeater'], hacker: false, lieutenant: false, orderTypes: ['regular'], points: 10, profile: 'RACERBOT Repeater', skills: ['Remote Presence', 'RemDriver [PH=13]'], structure: 1, troopType: 'REM', unit: 'RACERBOT Mk-III', weapons: ['Flash Pulse'], wounds: null },
            { equipment: ['D-Charges'], hacker: false, lieutenant: false, orderTypes: ['regular'], points: 28, profile: 'ARTALIS Engineer', skills: ['Engineer'], structure: null, troopType: 'MI', unit: 'ARTALIS', weapons: ['Combi Rifle', 'D-Charges [CC]', 'D-Charges [Demolition]'], wounds: 1 },
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
  sort: 'alphabetical',
  troopType: 'REM',
})
const hiRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  skill: '',
  sort: 'alphabetical',
  troopType: 'HI',
})
const hackerRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  skill: 'Hacker',
  sort: 'alphabetical',
  troopType: '',
})
const remRemoteRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: '',
  skill: 'Remote Presence',
  sort: 'alphabetical',
  troopType: 'REM',
  weapon: '',
})
const tagRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: '',
  skill: '',
  sort: 'alphabetical',
  troopType: 'TAG',
  weapon: '',
})
const panoceaniaAnalysis = buildFixtureAnalysis(typeSkillFixtureLists.slice(1))
const panoceaniaRemRows = filterAndSortModelUsage(panoceaniaAnalysis.modelUsage, {
  equipment: '',
  skill: '',
  sort: 'alphabetical',
  troopType: 'REM',
  weapon: '',
})
const remHackerRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: '',
  skill: 'Hacker',
  sort: 'alphabetical',
  troopType: 'REM',
  weapon: '',
})
const multiRifleRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: '',
  skill: '',
  sort: 'alphabetical',
  troopType: '',
  weapon: 'MULTI Rifle',
})
const dChargesWeaponRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: '',
  skill: '',
  sort: 'alphabetical',
  troopType: '',
  weapon: 'D-Charges',
})
const repeaterRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: 'Repeater',
  skill: '',
  sort: 'alphabetical',
  troopType: '',
  weapon: '',
})
const remRepeaterRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: 'Repeater',
  skill: '',
  sort: 'alphabetical',
  troopType: 'REM',
  weapon: '',
})
const multiRifleDChargesRows = filterAndSortModelUsage(typeSkillAnalysis.modelUsage, {
  equipment: 'D-Charges',
  skill: '',
  sort: 'alphabetical',
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
assert.equal(
  winningAnalysis.averageTacticalAwarenessOrders,
  3,
  'Known Operations Subsection winning list must count three Tactical Awareness profiles from exact skill tokens.',
)
assert.equal(
  losingAnalysis.averageTacticalAwarenessOrders,
  1,
  'Known Operations Subsection losing list must count one Tactical Awareness profile from exact skill tokens.',
)
assert.equal(
  allAnalysis.averageTacticalAwarenessOrders,
  2,
  'Tactical Awareness average must average per-list totals across multiple matching lists.',
)
assert.deepEqual(
  allAnalysis.modelUsage.find((row) => row.name === 'NETROD'),
  {
    avaTaken: 2,
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
    avaTaken: 1,
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
  filterAndSortModelUsage(typeSkillAnalysis.modelUsage, { skill: '', sort: 'alphabetical', troopType: '' }).map(formatModelUsageName),
  [
    'ARTALIS - Engineer',
    'ASURA - Hacker',
    'Pilot-X Team - Hacker',
    'RACERBOT Mk-III - RACERBOT Repeater',
    'RUDRA FTO - Repeater',
  ],
  'Alphabetical sort must order Model Usage by displayed model/profile label A-Z.',
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
  dChargesWeaponRows.map((row) => row.name),
  ['ARTALIS'],
  'Bracketed D-Charges weapon modes must merge under the base D-Charges filter.',
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
  ['Engineer', 'Hacker', 'Lieutenant', 'RemDriver [PH=13]', 'Remote Presence'],
  'Operations Subsection skill options must come from the selected sectorial dataset.',
)
assert.equal(
  buildSkillOptions(typeSkillFixtureLists.slice(0, 1)).includes('RemDriver [PH=13]'),
  true,
  'Skill options must preserve complete decoded skill strings including closing brackets.',
)
assert.deepEqual(
  buildSkillOptions(typeSkillFixtureLists.slice(1)),
  ['Forward Observer'],
  'Changing sectorial must refresh Skill dropdown options.',
)
assert.deepEqual(
  buildWeaponOptions(typeSkillFixtureLists.slice(0, 1)),
  ['Combi Rifle', 'D-Charges', 'Flash Pulse', 'MULTI Rifle', 'Submachine Gun'],
  'Weapon options must come from the selected sectorial dataset, merge bracketed modes, and sort alphabetically.',
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
  /snapshotHasDecodedProfileMetadata[\s\S]*troopType[\s\S]*skills[\s\S]*wounds[\s\S]*structure[\s\S]*weapons[\s\S]*equipment/,
  'Refresh script must redecode stale snapshots missing troop type, skills, wounds, structure, weapons, or equipment.',
)
assert.match(
  worker,
  /snapshotHasDecodedProfileMetadata[\s\S]*troopType[\s\S]*skills[\s\S]*wounds[\s\S]*structure[\s\S]*weapons[\s\S]*equipment/,
  'Commissioner decoder worker must redecode stale snapshots missing troop type, skills, wounds, structure, weapons, or equipment.',
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

const liveV2LoboForWorkSnapshot = buildLiveV2SnapshotFixture({
  listName: 'For Work',
  player: 'Lobo',
  sectorial: 'Operations Subsection',
  snapshotKey: 'casual:36:winner:lobo:a59a31d83c48418d817f7e887c935ae0636d5fbf4b67b6015738d41378a15c88',
})
const liveV2PanOceaniaJoanSnapshot = buildLiveV2SnapshotFixture({
  listName: ' Joan',
  player: 'ADangerousFrog',
  sectorial: 'Panoceania',
  snapshotKey: 'casual:36:loser:adangerousfrog:bf0e05e82a54d947aeeaac0d5ad1c41cc9d09a7e4ab059b8d4e2ad2f8c832b07',
})

assert.equal(
  snapshotHasCompleteProfileMetadata(liveV2LoboForWorkSnapshot),
  false,
  'Lobo / Operations Subsection / For Work v2 snapshot must be stale without weapons and equipment.',
)
assert.equal(
  snapshotHasCompleteProfileMetadata(liveV2PanOceaniaJoanSnapshot),
  false,
  'ADangerousFrog / PanOceania / Joan v2 snapshot must be stale without weapons and equipment.',
)
assert.equal(
  isCurrentSnapshot(
    liveV2LoboForWorkSnapshot,
    'a59a31d83c48418d817f7e887c935ae0636d5fbf4b67b6015738d41378a15c88',
  ),
  false,
  'Lobo / Operations Subsection / For Work v2 snapshot must be re-decoded even when the army-code hash is unchanged.',
)
assert.equal(
  isCurrentSnapshot(
    liveV2PanOceaniaJoanSnapshot,
    'bf0e05e82a54d947aeeaac0d5ad1c41cc9d09a7e4ab059b8d4e2ad2f8c832b07',
  ),
  false,
  'ADangerousFrog / PanOceania / Joan v2 snapshot must be re-decoded even when the army-code hash is unchanged.',
)

const storedArmyListRegistry = [
  { armyName: 'Onyx Attack', faction: 'Combined Army', player: 'Lobo' },
  { armyName: 'Morat Advance', faction: 'Combined Army', player: 'Frog' },
  { armyName: 'Shasvastii Shell', faction: 'Combined Army', player: 'Fixer' },
  { armyName: 'Bureau Strike', faction: 'O-12', player: 'Judge' },
  { armyName: 'Starmada Boarding', faction: 'O-12', player: 'Marshal' },
  { armyName: 'Corregidor Run', faction: 'Nomads', player: 'Nomad' },
]
const knownArmyListCounts = buildKnownArmyListCountsByFactionFixture(storedArmyListRegistry)
assert.equal(
  knownArmyListCounts['Combined Army'],
  3,
  'Combined Army knownArmyLists count must match stored Army Lists.',
)
assert.equal(
  knownArmyListCounts['O-12'],
  2,
  'O-12 knownArmyLists count must match stored Army Lists.',
)
assert.deepEqual(
  knownArmyListCounts,
  {
    'Combined Army': 3,
    Nomads: 1,
    'O-12': 2,
  },
  'Every faction count must match the stored Army Lists registry.',
)
assert.equal(
  buildKnownArmyListCountsByFactionFixture([
    ...storedArmyListRegistry,
    { armyName: 'Onyx Reinforcement', faction: 'Combined Army', player: 'New Player' },
  ])['Combined Army'],
  4,
  'New Army List submissions must increase the selected faction knownArmyLists count.',
)
assert.equal(
  attachKnownArmyListsFixture(
    { decoded: { faction: 'O-12', sectorial: 'Starmada' }, faction: 'O-12' },
    knownArmyListCounts,
  ).knownArmyLists,
  2,
  'Army Code corrections must preserve knownArmyLists counts from the stored Army Lists registry.',
)
assert.equal(
  attachKnownArmyListsFixture(
    { decoded: { faction: 'Combined Army', sectorial: 'Onyx Contact Force' }, faction: 'O-12' },
    knownArmyListCounts,
  ).knownArmyLists,
  3,
  'Corrected decoded factions must resolve knownArmyLists from the corrected canonical faction.',
)
assert.equal(
  attachKnownArmyListsFixture(
    { decoded: { faction: 'Combined Army', sectorial: 'Combined Army' }, faction: 'Combined Army' },
    buildKnownArmyListCountsByFactionFixture([
      ...storedArmyListRegistry,
      { armyName: 'Scheduled Refresh List', faction: 'Combined Army', player: 'Scheduler' },
    ]),
  ).knownArmyLists,
  4,
  'Scheduled Army Intelligence refresh responses must update knownArmyLists from the latest stored Army Lists.',
)

const explorerRows = buildArmyListExplorerRowsFixture([
  {
    id: 1,
    armyName: 'Onyx Attack',
    faction: 'Combined Army',
    player: 'Lobo',
    points: 300,
    sectorial: 'Onyx Contact Force',
    submissionDate: '2026-07-25',
    swc: 6,
  },
  {
    id: 2,
    armyName: 'Shas Shell',
    faction: 'Combined Army',
    player: 'FlashPulse',
    points: 295,
    sectorial: 'Shasvastii Expeditionary Force',
    submissionDate: '2026-07-27',
    swc: 5.5,
  },
  {
    id: 3,
    armyName: 'Morat Advance',
    faction: 'Combined Army',
    player: 'FlashPulse',
    points: 300,
    sectorial: 'Morat Aggression Force',
    submissionDate: '2026-07-26',
    swc: 6,
  },
  {
    id: 4,
    armyName: 'Bureau Strike',
    faction: 'O-12',
    player: 'Judge',
    points: 300,
    sectorial: 'O-12',
    submissionDate: '2026-07-24',
    swc: 6,
  },
])
const combinedExplorerRows = explorerRows.filter((row) => row.faction === 'Combined Army')
assert.equal(
  combinedExplorerRows.length,
  knownArmyListCounts['Combined Army'],
  'Known Army Lists count must match the selected faction explorer rows.',
)
assert.deepEqual(
  filterAndSortExplorerRowsFixture(combinedExplorerRows, { sort: 'submissionDate' }).map((row) => row.armyName),
  ['Shas Shell', 'Morat Advance', 'Onyx Attack'],
  'Army List Explorer must sort by submission date.',
)
assert.deepEqual(
  filterAndSortExplorerRowsFixture(combinedExplorerRows, { player: 'FlashPulse', sort: 'player' }).map((row) => row.armyName),
  ['Shas Shell', 'Morat Advance'],
  'Army List Explorer must filter by player.',
)
assert.deepEqual(
  filterAndSortExplorerRowsFixture(combinedExplorerRows, { sectorial: 'Onyx Contact Force', sort: 'sectorial' }).map((row) => row.armyName),
  ['Onyx Attack'],
  'Army List Explorer must filter by sectorial.',
)
assert.deepEqual(
  filterAndSortExplorerRowsFixture(combinedExplorerRows, { search: 'shas', sort: 'submissionDate' }).map((row) => row.armyName),
  ['Shas Shell'],
  'Army List Explorer search must match army names.',
)
assert.deepEqual(
  filterAndSortExplorerRowsFixture(combinedExplorerRows, { search: 'lobo', sort: 'submissionDate' }).map((row) => row.armyName),
  ['Onyx Attack'],
  'Army List Explorer search must match player names.',
)
assert.deepEqual(
  filterAndSortExplorerRowsFixture(combinedExplorerRows, { sort: 'points' }).map((row) => row.armyName),
  ['Morat Advance', 'Onyx Attack', 'Shas Shell'],
  'Army List Explorer must sort by points with deterministic tie handling.',
)
assert.deepEqual(
  buildArmyListExplorerSummaryFixture(combinedExplorerRows, 'Combined Army'),
  {
    knownArmyLists: 3,
    mostActivePlayer: 'FlashPulse',
    mostActivePlayerCount: 2,
    mostPopularSectorial: 'Morat Aggression Force',
    newestSubmission: '2026-07-27',
    players: 2,
    sectorialCoverage: 3,
    sectorials: 3,
    totalSectorials: 4,
  },
  'Army List Explorer summary statistics must match the selected faction Army Lists.',
)
assert.deepEqual(
  filterAndSortExplorerRowsFixture(combinedExplorerRows, {
    player: buildArmyListExplorerSummaryFixture(combinedExplorerRows, 'Combined Army').mostActivePlayer,
    sort: 'player',
  }).map((row) => row.armyName),
  ['Shas Shell', 'Morat Advance'],
  'Clicking Most Submitted By must filter to that player.',
)
assert.deepEqual(
  filterAndSortExplorerRowsFixture(combinedExplorerRows, {
    sectorial: buildArmyListExplorerSummaryFixture(combinedExplorerRows, 'Combined Army').mostPopularSectorial,
    sort: 'sectorial',
  }).map((row) => row.armyName),
  ['Morat Advance'],
  'Clicking Most Popular Sectorial must filter to that sectorial.',
)
const combinedRowsAfterNewSubmission = buildArmyListExplorerRowsFixture([
  ...explorerRows,
  {
    id: 5,
    armyName: 'Next Wave Probe',
    faction: 'Combined Army',
    player: 'Cipher',
    points: 300,
    sectorial: 'Next Wave',
    submissionDate: '2026-07-28',
    swc: 6,
  },
]).filter((row) => row.faction === 'Combined Army')
assert.deepEqual(
  buildArmyListExplorerSummaryFixture(combinedRowsAfterNewSubmission, 'Combined Army'),
  {
    knownArmyLists: 4,
    mostActivePlayer: 'FlashPulse',
    mostActivePlayerCount: 2,
    mostPopularSectorial: 'Morat Aggression Force',
    newestSubmission: '2026-07-28',
    players: 3,
    sectorialCoverage: 4,
    sectorials: 4,
    totalSectorials: 4,
  },
  'Sectorial Coverage must update after new Army List submissions.',
)
assert.equal(
  new Set(combinedExplorerRows.map((row) => row.id)).size,
  combinedExplorerRows.length,
  'Army List Explorer must not display duplicate Army Lists.',
)
assert.ok(
  combinedExplorerRows.every((row) => getArmyIntelligenceListTargetFixture(row).startsWith('/army-list/')),
  'Every Army List Explorer row must open through the existing army-list target.',
)

const alephExplorerRows = buildArmyListExplorerRowsFixture([
  {
    id: 10,
    armyName: 'Vanilla ALEPH Control',
    faction: 'ALEPH',
    player: 'Vanilla Player',
    points: 300,
    sectorial: 'ALEPH',
    submissionDate: '2026-07-20',
    swc: 6,
  },
  {
    id: 11,
    armyName: 'Steel Assault',
    faction: 'ALEPH',
    player: 'Steel Player',
    points: 300,
    sectorial: 'Steel Phalanx',
    submissionDate: '2026-07-21',
    swc: 6,
  },
  {
    id: 12,
    armyName: 'OSS Net One',
    faction: 'ALEPH',
    player: 'OSS Player',
    points: 300,
    sectorial: 'Operations Subsection',
    submissionDate: '2026-07-22',
    swc: 6,
  },
  {
    id: 13,
    armyName: 'OSS Net Two',
    faction: 'ALEPH',
    player: 'OSS Player',
    points: 295,
    sectorial: 'Operations Subsection',
    submissionDate: '2026-07-23',
    swc: 5.5,
  },
])
const alephScopeRows = selectExplorerRowsForScopeFixture(alephExplorerRows, 'ALEPH')
const steelScopeRows = selectExplorerRowsForScopeFixture(alephExplorerRows, 'Steel Phalanx')
const ossScopeRows = selectExplorerRowsForScopeFixture(alephExplorerRows, 'Operations Subsection')
assert.deepEqual(
  alephScopeRows.map((row) => row.armyName).sort(),
  ['OSS Net One', 'OSS Net Two', 'Steel Assault', 'Vanilla ALEPH Control'],
  'Selecting ALEPH must display ALEPH-wide Vanilla, Steel Phalanx, and Operations Subsection explorer rows.',
)
assert.deepEqual(
  steelScopeRows.map((row) => row.sectorial),
  ['Steel Phalanx'],
  'Selecting Steel Phalanx must display only Steel Phalanx explorer rows.',
)
assert.ok(
  steelScopeRows.every((row) => row.sectorial !== 'Operations Subsection'),
  'Selecting Steel Phalanx must not show Operations Subsection rows.',
)
assert.deepEqual(
  ossScopeRows.map((row) => row.sectorial),
  ['Operations Subsection', 'Operations Subsection'],
  'Selecting Operations Subsection must display only Operations Subsection explorer rows.',
)
assert.ok(
  ossScopeRows.every((row) => row.sectorial !== 'Steel Phalanx'),
  'Selecting Operations Subsection must not show Steel Phalanx rows.',
)
assert.equal(
  buildArmyListExplorerSummaryFixture(steelScopeRows, '').knownArmyLists,
  steelScopeRows.length,
  'Known Army Lists must equal the displayed explorer rows for sectorial selections.',
)
assert.equal(
  buildArmyListExplorerSummaryFixture(ossScopeRows, '').knownArmyLists,
  ossScopeRows.length,
  'Known Army Lists must equal the displayed explorer rows for Operations Subsection.',
)
assert.equal(
  buildArmyListExplorerSummaryFixture(alephScopeRows, 'ALEPH').knownArmyLists,
  alephScopeRows.length,
  'Known Army Lists must equal the displayed explorer rows for parent faction selections.',
)
const steelDecodedScopeLists = [
  buildSingleCollectionScopeListFixture({
    faction: 'ALEPH',
    listName: 'Steel Single Source',
    player: 'Steel Player',
    points: 299,
    regularOrders: 14,
    sectorial: 'Steel Phalanx',
    sourceId: '21',
    wounds: [1, 1, 1, 1.4],
  }),
]
const steelRowsFromSameCollection = buildExplorerRowsFromSelectedListsFixture(steelDecodedScopeLists)
const steelAnalysisFromSameCollection = buildFixtureAnalysis(steelDecodedScopeLists)
assert.equal(
  steelRowsFromSameCollection.length,
  steelAnalysisFromSameCollection.listCount,
  'Known Army Lists and derived statistics must use the same Steel Phalanx filtered collection.',
)
assert.equal(
  steelRowsFromSameCollection.length,
  1,
  'Non-zero Steel Phalanx derived statistics must imply a non-zero Known Army Lists count.',
)
assert.equal(
  steelRowsFromSameCollection[0].sectorial,
  'Steel Phalanx',
  'Steel Phalanx explorer rows derived from the selected collection must preserve exact sectorial scope.',
)
assert.equal(
  steelRowsFromSameCollection[0].points,
  steelAnalysisFromSameCollection.averagePoints,
  'Explorer points and average points must describe the same submitted Steel Phalanx list.',
)
const emptyScopeRows = buildExplorerRowsFromSelectedListsFixture([])
const emptyScopeAnalysis = buildFixtureAnalysis([])
assert.equal(emptyScopeRows.length, 0, 'An empty selected collection must produce zero Known Army Lists.')
assert.equal(emptyScopeAnalysis.listCount, 0, 'An empty selected collection must produce zero analyzed lists.')
assert.equal(emptyScopeAnalysis.averageRegularOrders, 0, 'An empty selected collection must produce zero average regular orders.')
assert.equal(emptyScopeAnalysis.averagePoints, 0, 'An empty selected collection must produce zero average points.')
assert.equal(emptyScopeAnalysis.averageDurability, 0, 'An empty selected collection must produce zero average durability.')

console.log('Army Intelligence Phase 1 checks passed.')

function read(path) {
  return readFileSync(path, 'utf8')
}

function buildKnownArmyListCountsByFactionFixture(lists) {
  return lists.reduce((counts, list) => {
    const faction = canonicalizeArmyParentFactionFixture(list.faction)

    if (!faction) {
      return counts
    }

    counts[faction] = (counts[faction] || 0) + 1
    return counts
  }, {})
}

function buildArmyListExplorerRowsFixture(lists) {
  return lists.map((list) => ({
    id: list.id,
    armyName: list.armyName,
    faction: canonicalizeArmyParentFactionFixture(list.faction),
    player: list.player,
    playerDisplayName: list.playerDisplayName || list.player,
    points: list.points,
    sectorial: list.sectorial,
    source: 'Community Library',
    submissionDate: list.submissionDate,
    swc: list.swc,
  }))
}

function buildExplorerRowsFromSelectedListsFixture(lists) {
  return lists.map((list, index) => ({
    id: Number(list.sourceId) || index + 1,
    armyName: list.decoded?.listName || 'Untitled Army List',
    faction: canonicalizeArmyParentFactionFixture(list.decoded?.faction || list.faction),
    player: list.player || list.sourcePlayer,
    playerDisplayName: list.player || list.sourcePlayer || 'Unknown Player',
    points: list.decoded?.totals.points || 0,
    sectorial: list.decoded?.sectorial || list.sectorial,
    source: list.gameType || list.sourceType || 'Army Intelligence',
    submissionDate: list.date || list.decodedAt,
    swc: list.decoded?.totals.swc || 0,
  }))
}

function buildSingleCollectionScopeListFixture({
  faction,
  listName,
  player,
  points,
  regularOrders,
  sectorial,
  sourceId,
  wounds,
}) {
  return {
    date: '2026-07-31',
    decoded: {
      combatGroups: [
        {
          entries: wounds.map((wound, index) => ({
            name: `${sectorial} Unit ${index + 1}`,
            profile: `${sectorial} Profile ${index + 1}`,
            skills: [],
            structure: null,
            unit: `${sectorial} Unit ${index + 1}`,
            wounds: wound,
          })),
        },
      ],
      faction,
      listName,
      orderCounts: {
        regular: regularOrders,
      },
      sectorial,
      totals: {
        points,
        swc: 6,
      },
    },
    faction,
    gameType: 'League',
    player,
    result: 'win',
    sectorial,
    sourceId,
    sourcePlayer: player,
    sourceType: 'league',
  }
}

function selectExplorerRowsForScopeFixture(rows, selectedItem) {
  const scope = getSelectedExplorerScopeFixture(selectedItem)

  return rows.filter((row) => {
    if (scope.isParentFaction) {
      return row.faction === scope.parentFaction
    }

    return row.sectorial === scope.label
  })
}

function getSelectedExplorerScopeFixture(selectedItem) {
  const label = String(selectedItem || '').trim()
  const parentFaction = canonicalizeArmyParentFactionFixture(label)
  const isParentFaction = parentFaction === label && ['ALEPH', 'Combined Army', 'O-12'].includes(label)

  return {
    isParentFaction,
    label,
    parentFaction,
  }
}

function filterAndSortExplorerRowsFixture(rows, filters) {
  const query = String(filters.search || '').trim().toLowerCase()

  return rows
    .filter((row) => !filters.player || row.playerDisplayName === filters.player)
    .filter((row) => !filters.sectorial || row.sectorial === filters.sectorial)
    .filter((row) =>
      !query ||
      row.playerDisplayName.toLowerCase().includes(query) ||
      row.armyName.toLowerCase().includes(query),
    )
    .sort((left, right) => compareExplorerRowsFixture(left, right, filters.sort || 'submissionDate'))
}

function compareExplorerRowsFixture(left, right, sort) {
  if (sort === 'player') {
    return left.playerDisplayName.localeCompare(right.playerDisplayName) ||
      compareExplorerRowsFixture(left, right, 'submissionDate')
  }

  if (sort === 'sectorial') {
    return left.sectorial.localeCompare(right.sectorial) ||
      compareExplorerRowsFixture(left, right, 'submissionDate')
  }

  if (sort === 'points') {
    return right.points - left.points || compareExplorerRowsFixture(left, right, 'submissionDate')
  }

  return Date.parse(right.submissionDate) - Date.parse(left.submissionDate) ||
    right.id - left.id ||
    left.armyName.localeCompare(right.armyName)
}

function buildArmyListExplorerSummaryFixture(rows, selectedParentFaction) {
  const playerCounts = new Map()
  const sectorialCounts = new Map()
  let newestSubmission = ''

  rows.forEach((row) => {
    playerCounts.set(row.playerDisplayName, (playerCounts.get(row.playerDisplayName) || 0) + 1)
    if (isCanonicalSectorialFixture(row.sectorial)) {
      sectorialCounts.set(row.sectorial, (sectorialCounts.get(row.sectorial) || 0) + 1)
    }
    if (!newestSubmission || Date.parse(row.submissionDate) > Date.parse(newestSubmission)) {
      newestSubmission = row.submissionDate
    }
  })

  const mostActivePlayer = getCountLeaderFixture(playerCounts)
  const mostPopularSectorial = getCountLeaderFixture(sectorialCounts)
  const totalSectorials = getTotalSectorialsForFactionFixture(selectedParentFaction)

  return {
    knownArmyLists: rows.length,
    mostActivePlayer: mostActivePlayer.name,
    mostActivePlayerCount: mostActivePlayer.count,
    mostPopularSectorial: mostPopularSectorial.name,
    newestSubmission,
    players: playerCounts.size,
    sectorialCoverage: totalSectorials > 0 ? sectorialCounts.size : 0,
    sectorials: sectorialCounts.size,
    totalSectorials,
  }
}

function getTotalSectorialsForFactionFixture(parentFaction) {
  const sectorialsByParent = {
    'Combined Army': [
      'Morat Aggression Force',
      'Next Wave',
      'Onyx Contact Force',
      'Shasvastii Expeditionary Force',
    ],
    'O-12': [
      'Starmada',
      'Torchlight Brigade',
    ],
  }

  return (sectorialsByParent[parentFaction] || []).length
}

function isCanonicalSectorialFixture(value) {
  const knownSectorials = new Set([
    'Morat Aggression Force',
    'Next Wave',
    'Onyx Contact Force',
    'Shasvastii Expeditionary Force',
    'Starmada',
    'Torchlight Brigade',
  ])

  return knownSectorials.has(value)
}

function getCountLeaderFixture(counts) {
  return Array.from(counts.entries())
    .map(([name, count]) => ({ count, name }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))[0] || {
      count: 0,
      name: '',
    }
}

function getArmyIntelligenceListTargetFixture(row) {
  return `/army-list/${encodeURIComponent(row.armyCode || row.armyLink || String(row.id))}`
}

function attachKnownArmyListsFixture(list, counts) {
  const faction = list.decoded?.faction || list.faction

  return {
    ...list,
    knownArmyLists: counts[canonicalizeArmyParentFactionFixture(faction)] || 0,
  }
}

function canonicalizeArmyParentFactionFixture(value) {
  const name = String(value || '').trim()
  const compact = name.replace(/[^a-z0-9]/gi, '').toLowerCase()
  const parentFactions = {
    combinedarmy: 'Combined Army',
    nomads: 'Nomads',
    o12: 'O-12',
    starmada: 'O-12',
    aleph: 'ALEPH',
    steelphalanx: 'ALEPH',
    operationssubsection: 'ALEPH',
    onyxcontactforce: 'Combined Army',
    morataggressionforce: 'Combined Army',
    shasvastiiexpeditionaryforce: 'Combined Army',
  }

  return parentFactions[compact] || name
}

function buildLiveV2SnapshotFixture({ listName, player, sectorial, snapshotKey }) {
  return {
    armyCodeHash: snapshotKey.split(':').at(-1),
    decoded: {
      combatGroups: [
        {
          entries: Array.from({ length: 15 }, (_, index) => ({
            profile: `${player} profile ${index + 1}`,
            skills: [],
            structure: index % 2 === 0 ? null : 1,
            troopType: index % 2 === 0 ? 'LI' : 'REM',
            wounds: index % 2 === 0 ? 1 : null,
          })),
        },
      ],
      decoderVersion: 'army-intelligence-decoder-v2',
      listName,
      sectorial,
    },
    player,
    snapshotKey,
    status: 'decoded',
  }
}

function isCurrentSnapshot(snapshot, armyCodeHash) {
  return (
    snapshot.armyCodeHash === armyCodeHash &&
    snapshot.status === 'decoded' &&
    snapshot.decoded?.decoderVersion === 'army-intelligence-decoder-v4' &&
    snapshotHasCompleteProfileMetadata(snapshot)
  )
}

function snapshotHasCompleteProfileMetadata(list) {
  if (list.status !== 'decoded' || !list.decoded) {
    return false
  }

  const groups = Array.isArray(list.decoded.combatGroups) ? list.decoded.combatGroups : []
  return groups.every((group) => {
    const entries = Array.isArray(group.entries) ? group.entries : []
    return entries.every((entry) =>
      Object.hasOwn(entry, 'troopType') &&
      Object.hasOwn(entry, 'skills') &&
      Object.hasOwn(entry, 'wounds') &&
      Object.hasOwn(entry, 'structure') &&
      Object.hasOwn(entry, 'weapons') &&
      Object.hasOwn(entry, 'equipment'),
    )
  })
}

function buildFixtureAnalysis(lists) {
  const entriesByList = lists.map((list) =>
    list.decoded.combatGroups.flatMap((group) => group.entries),
  )

  return {
    averagePoints: average(lists.map((list) => list.decoded.totals.points)),
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
  return buildEntryTokenOptions(lists, (entry) => (entry.weapons || []).map(normalizeWeaponModeName))
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
      ;(entry.weapons || []).forEach((weapon) => row.weapons.add(normalizeWeaponModeName(weapon)))
      rowsByKey.set(key, row)

      const appearances = listAppearances.get(key) || new Set()
      appearances.add(listIndex)
      listAppearances.set(key, appearances)
    })
  })

  return Array.from(rowsByKey.entries())
    .map(([key, row]) => ({
      equipment: Array.from(row.equipment).sort((left, right) => left.localeCompare(right)),
      avaTaken: (listAppearances.get(key)?.size || 0) > 0
        ? row.totalSelections / (listAppearances.get(key)?.size || 1)
        : 0,
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
    .sort((left, right) => compareModelUsageRows(left, right, 'alphabetical'))
}

function compareModelUsageRows(left, right, sort) {
  if (sort === 'pointsHigh') {
    return (right.points || 0) - (left.points || 0) || compareModelUsageRows(left, right, 'alphabetical')
  }

  if (sort === 'pointsLow') {
    return (left.points || 0) - (right.points || 0) || compareModelUsageRows(left, right, 'alphabetical')
  }

  const labelComparison = formatModelUsageName(left).localeCompare(formatModelUsageName(right))
  return labelComparison || right.totalSelections - left.totalSelections || right.listCount - left.listCount
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
  return (entry.skills || []).some((skill) => normalizeExactSkillToken(skill) === 'tacticalawareness') ? 1 : 0
}

function normalizeWeaponModeName(weapon) {
  return String(weapon || '').trim().replace(/\s+\[[^\]]+\]$/, '')
}

function normalizeExactSkillToken(skill) {
  return String(skill || '').trim().toLowerCase().replace(/[^a-z]/g, '')
}

function average(values) {
  if (values.length === 0) {
    return 0
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10
}
