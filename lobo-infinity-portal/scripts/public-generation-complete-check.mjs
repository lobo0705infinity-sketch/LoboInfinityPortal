import assert from 'node:assert/strict'
import fs from 'node:fs'

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

console.log('Complete unpublished public-generation checks passed.')
