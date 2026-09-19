import fs from 'node:fs'

const base = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/public-snapshots/20260831T045141Z/'
const source = fs.readFileSync(new URL('../src/public/SnapshotArmyIntelligence.tsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/public/SnapshotArmyIntelligence.css', import.meta.url), 'utf8')
const app = fs.readFileSync(new URL('../src/public/SnapshotPublicApp.tsx', import.meta.url), 'utf8')

const [summaryResponse, detailResponse] = await Promise.all([
  fetch(`${base}army-intelligence-summary.json`),
  fetch(`${base}army-intelligence-detail.json`),
])
assert(summaryResponse.ok, 'summary Blob readable')
assert(detailResponse.ok, 'detail Blob readable')
const summaryEnvelope = await summaryResponse.json()
const detailEnvelope = await detailResponse.json()
const summary = summaryEnvelope.data?.[0]
const groups = detailEnvelope.data

assert(summaryEnvelope.snapshotId === '20260831T045141Z', 'summary snapshot identity')
assert(detailEnvelope.snapshotId === '20260831T045141Z', 'detail snapshot identity')
assert(summary?.available === true, 'summary availability')
assert(Number.isInteger(summary?.decodedLists), 'decoded count schema')
assert(Array.isArray(summary?.options) && summary.options.length > 0, 'selector option schema')
assert(Array.isArray(groups) && groups.length === summary.options.length, 'detail group schema')
assert(groups.every((group) => typeof group.faction === 'string' && Array.isArray(group.lists) && Array.isArray(group.armyLists)), 'detail group fields')

const decoded = groups.flatMap((group) => group.lists).filter((list) => list.decoded)
const entries = decoded.flatMap((list) => list.decoded.combatGroups.flatMap((group) => group.entries))
assert(decoded.length > 0, 'decoded detail lists')
assert(entries.length > 0, 'unit/profile entries')
assert(entries.some((entry) => entry.skills?.length), 'skills filter data')
assert(entries.some((entry) => entry.weapons?.length), 'weapons filter data')
assert(entries.some((entry) => entry.troopType), 'troop type filter data')
assert(decoded.some((list) => list.mission), 'mission intelligence data')
assert(decoded.some((list) => list.result || list.results?.length), 'result filter data')
assert(groups.some((group) => group.armyLists.some((list) => list.playerDisplayName && list.submissionDate)), 'public list explorer data')

for (const required of ['Select sectorial', 'Army Lists with a Winning Record', 'Army Lists with a Losing Record', 'Troop or profile', 'All Types', 'All Skills', 'All Weapons', 'All Equipment', 'Alphabetically', 'Model Usage', 'Role coverage', 'Army List Explorer']) {
  assert(source.includes(required), `feature mapping: ${required}`)
}
assert(app.includes('<SnapshotArmyIntelligence />'), 'snapshot-native route component')
assert(source.indexOf("useSnapshotData<Summary[]>('army-intelligence-summary')") < source.indexOf('<ArmyIntelligenceDetail'), 'summary loads before detail component')
assert(source.includes("useSnapshotData<DetailGroup[]>('army-intelligence-detail')"), 'detail uses immutable cached snapshot client')
const detailLayout = source.slice(source.indexOf('function ArmyIntelligenceDetail'), source.indexOf('function IntelligenceBrief'))
const summaryPosition = detailLayout.indexOf('snapshot-intelligence-mature-metrics')
const filtersPosition = detailLayout.indexOf('aria-label="Model Usage filters"')
const capabilitiesPosition = detailLayout.indexOf('<IntelligenceBrief')
assert(summaryPosition >= 0 && summaryPosition < filtersPosition && filtersPosition < capabilitiesPosition,
  'summary row appears above analyze/filter controls and Observed Capabilities')
assert((detailLayout.match(/snapshot-intelligence-mature-metrics/g) || []).length === 1,
  'no duplicate summary row remains below capability cards')
assert(/\.snapshot-intelligence-metrics\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(145px,\s*1fr\)\)/s.test(css),
  'desktop summary uses a responsive grid')
assert(/@media \(max-width:\s*640px\)[\s\S]*?\.snapshot-intelligence-metrics[^}]*grid-template-columns:\s*1fr/.test(css),
  'mobile summary collapses to a single-column grid')
for (const forbidden of ['apiClient', 'UrlFetch', 'decoder', 'refreshArmy', 'publicArmyWorkspace', 'preparedProjection', 'armyCode']) {
  assert(!source.includes(forbidden), `forbidden dependency absent: ${forbidden}`)
}
const keyText = JSON.stringify(groups).toLowerCase()
assert(!keyText.includes('armycode'), 'raw Army Code absent')

console.log(`Snapshot Army Intelligence regression passed: ${summary.options.length} groups, ${decoded.length} decoded lists, ${entries.length} entries.`)

function assert(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`)
}
