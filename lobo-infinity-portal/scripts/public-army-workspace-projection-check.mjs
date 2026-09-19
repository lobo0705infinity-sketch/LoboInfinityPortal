import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const backend = read('backend/PublicArmyWorkspaceProjection.gs')
const endpoint = read('api/public-army-workspace-projection.mjs')
const service = read('src/services/publicArmyWorkspaceProjection.ts')
const listsPage = read('src/pages/ArmyLists.tsx')
const intelligencePage = read('src/pages/ArmyIntelligence.tsx')
const intelligenceBackend = read('backend/ArmyIntelligenceApi.gs')

assert.match(backend, /readArmyIntelligenceReadModelPayload\(\)/)
assert.match(backend, /buildArmyIntelligencePublicSummaryProjection\(readModel\)/)
assert.match(backend, /buildArmyIntelligencePublicFactionProjection\(readModel, option\)/)
assert.match(backend, /PUBLIC_ARMY_INTELLIGENCE_SUMMARY_FILE_ID/)
assert.match(backend, /PUBLIC_ARMY_INTELLIGENCE_DETAIL_FILE_ID/)
assert.match(backend, /games: parse\(getRecentGames/)
assert.doesNotMatch(backend, /CanonicalDecoderGateway|UrlFetchApp|decode\(/)
assert.doesNotMatch(backend, /getCanonicalGameSubmittedArmyListObjects|getArmyListObjects/)
assert.match(endpoint, /stale-while-revalidate=86400/)
assert.match(endpoint, /intelligenceSummary/)
assert.match(endpoint, /intelligenceFaction/)
assert.match(endpoint, /artifact\?\.projection/)
assert.match(endpoint, /artifact\?\.details/)
assert.doesNotMatch(endpoint, /script\.google\.com/)
assert.match(service, /buildSubmittedArmyListLibraryFromSources/)
assert.match(service, /getIntelligenceSummary/)
assert.match(service, /getIntelligenceFaction/)
assert.match(listsPage, /publicArmyWorkspace\s*\.getArmyLists/)
assert.doesNotMatch(listsPage, /getSubmittedArmyListLibrary/)
assert.match(intelligencePage, /publicArmyWorkspace\s*\.getIntelligenceSummary/)
assert.match(intelligencePage, /publicArmyWorkspace\s*\.getIntelligenceFaction/)
assert.doesNotMatch(intelligencePage, /getArmyIntelligenceSummary/)
assert.doesNotMatch(intelligencePage, /getArmyIntelligenceFaction/)
assert.match(intelligenceBackend, /markPublicArmyWorkspaceProjectionDirty_\(\["intelligence"\]\)/)

for (const forbidden of ['Submitter Email', 'sessionToken', 'commissionerEmails', 'password']) {
  assert.ok(!backend.includes(forbidden), `Public Army projection contains forbidden marker: ${forbidden}`)
}

console.log('Public Army workspace projection check passed.')
