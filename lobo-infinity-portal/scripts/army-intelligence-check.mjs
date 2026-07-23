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
  /Pending Decodes[\s\S]*Failed Decodes/,
  'Army Intelligence page must show pending and failed decodes.',
)
assert.match(
  page,
  /Lieutenant Choices[\s\S]*Hackers[\s\S]*Specialists/,
  'Army Intelligence page must show tactical aggregate sections.',
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
