import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const complete = fs.readFileSync('backend/PublicGenerationComplete.gs', 'utf8')
const foundation = fs.readFileSync('backend/PublicGenerationFoundation.gs', 'utf8')
const api = fs.readFileSync('backend/API.gs', 'utf8')

assert.match(complete, /function runBuildCompletePublicGenerationCandidate\(\)/)
assert.match(complete, /captureCompletePublicGenerationFrozenInput_\(generation\)/)
assert.match(complete, /readCompletePublicGenerationContext_\(record\)/)
assert.match(complete, /PUBLIC_GENERATION_COMPLETE_REQUIRED_SOURCES/)
assert.match(complete, /PUBLIC_GENERATION_COMPLETE_OPTIONAL_SOURCES/)
assert.match(complete, /completedStages\.indexOf\("required-sections"\)/)
assert.match(complete, /completedStages\.indexOf\("optional-sections"\)/)
assert.match(complete, /validateCompletePublicGenerationStage_/)
assert.match(complete, /validatePersistedPublicGenerationText_/)
assert.match(complete, /sourceGeneration: record\.generation/)
assert.match(complete, /published: false/)
assert.match(complete, /livePointer: false/)
assert.match(complete, /safeToContinue:/)

assert.doesNotMatch(complete, /rebuildGameEngine\s*\(/)
assert.doesNotMatch(complete, /processAutomationQueueBatch\s*\(/)
assert.doesNotMatch(complete, /decodeArmy|refreshArmyIntelligence|publishPublic[A-Z]/)
assert.doesNotMatch(complete, /doGet|doPost|requireApiPermission|jsonOutput/)
assert.doesNotMatch(api, /runBuildCompletePublicGenerationCandidate/)

assert.match(foundation, /player1ArmyListId:/)
assert.match(foundation, /player2ArmyListId:/)
assert.match(complete, /Duplicate canonical Game ID in frozen input/)
assert.match(complete, /Game 73 semantic fixture failed/)
assert.match(complete, /Three-division League semantic validation failed/)
assert.match(complete, /assertNoForbiddenPublicGenerationKeys_/)
assert.match(complete, /createImmutablePublicGenerationFile_/)
assert.match(complete, /sanitizeCompletePublicGenerationLeague_/)
assert.match(complete, /PUBLIC_GENERATION_PUBLIC_LEAGUE_EVENT_FIELDS/)
assert.match(complete, /createOrValidateCompletePublicGenerationFile_/)

const allowlistMatch = complete.match(
  /const PUBLIC_GENERATION_PUBLIC_LEAGUE_EVENT_FIELDS = \[[\s\S]*?\];/,
)
const sanitizerStart = complete.indexOf('function sanitizeCompletePublicGenerationLeague_')
const writerStart = complete.indexOf('function writeCompletePublicGenerationArtifact_', sanitizerStart)
assert.ok(allowlistMatch && sanitizerStart > -1 && writerStart > sanitizerStart)
const sandbox = {
  JSON,
  Object,
  parsePublicGenerationJson_: (value, fallback) => {
    try { return JSON.parse(String(value || '')) } catch { return fallback }
  },
}
vm.createContext(sandbox)
vm.runInContext(
  `${allowlistMatch[0]}\n${complete.slice(sanitizerStart, writerStart)}`,
  sandbox,
)
const canonicalLeagueFixture = {
  dashboard: {
    divisionStandings: [{
      division: 'main',
      event: {
        id: 'event-current-league',
        name: 'Current League',
        type: 'League',
        status: 'Active',
        scoringModel: 'TP/OP/VP',
        commissioners: 'Commissioner',
        owner: 'Commissioner',
        permissions: { manage: true },
        automation: 'Enabled',
        privateNotes: 'never public',
      },
      standings: [{ player: 'Lobo', wins: 1 }],
    }],
  },
}
const publicLeagueFixture = sandbox.sanitizeCompletePublicGenerationLeague_(canonicalLeagueFixture)
const event = publicLeagueFixture.dashboard.divisionStandings[0].event
assert.deepEqual(JSON.parse(JSON.stringify(event)), {
  id: 'event-current-league',
  name: 'Current League',
  type: 'League',
  status: 'Active',
  scoringModel: 'TP/OP/VP',
})
assert.equal('commissioners' in event, false)
assert.equal('permissions' in event, false)
assert.equal('owner' in event, false)
assert.equal(publicLeagueFixture.dashboard.divisionStandings[0].standings[0].player, 'Lobo')

console.log('Complete unpublished public-generation checks passed.')
