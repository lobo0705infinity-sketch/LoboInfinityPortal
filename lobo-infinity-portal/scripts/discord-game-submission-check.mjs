import { readFileSync } from 'node:fs'

const canonical = readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
const gameEngine = readFileSync('backend/rebuildGameEngine().gs', 'utf8')
const automation = readFileSync('backend/AutomationApi.gs', 'utf8')
const deepLinks = readFileSync('backend/DeepLinkApi.gs', 'utf8')

const checks = [
  ['Google Form submissions enqueue after persistence and before canonical rebuild', /SpreadsheetApp\.flush\(\);[\s\S]*?canonicalSubmissionEnqueueGameAutomation_\(targetRow[\s\S]*?coordinateCanonicalRebuild\(/.test(canonical)],
  ['All canonical branches enqueue once through the shared hook', (canonical.match(/canonicalSubmissionEnqueueGameAutomation_\(targetRow, \{/g) || []).length === 3],
  ['Portal Team Tournament enqueues before canonical rebuild', /canonicalSubmitPortalTeamTournamentGame_[\s\S]*?canonicalSubmissionEnqueueGameAutomation_\(targetRow[\s\S]*?coordinateCanonicalRebuild\(/.test(canonical)],
  ['Shared hook resolves the submitted canonical Game ID without analytics', /const gameId = Number\(targetRow\) - 1;/.test(canonical) && !/canonicalSubmissionEnqueueGameAutomation_[\s\S]*getAllRecentGameObjects/.test(canonical)],
  ['Shared hook records enqueue failure and returns for rebuild', /Game submitted automation enqueue failed[\s\S]*return null/.test(canonical)],
  ['Shared publisher accepts the exact submitted game', /function publishLatestGameSubmittedAutomationEvent\(game\)[\s\S]*publishGameSubmittedAutomationEvent\(submittedGame\)/.test(gameEngine)],
  ['Game event stores only canonical identity fields', /const payload = JSON\.stringify\(\{[\s\S]*eventId:[\s\S]*gameId:[\s\S]*gameType:[\s\S]*\}\)/.test(automation)],
  ['Discord queue resolves the canonical game downstream and reuses its payload builder', /buildAutomationGamePayloadById_[\s\S]*buildDiscordGamePayload\(game \|\| eventPayload\)/.test(automation)],
  ['Game announcements link to the canonical Battle Report route', /case "gameSubmitted":[\s\S]*return "\/games\/" \+ encodeURIComponent\(getDeepLinkId\(data\.gameId \|\| data\.id\)\)/.test(deepLinks)],
  ['Rebuild itself does not publish game events', !/function rebuildGameEngine\([^]*?publishLatestGameSubmittedAutomationEvent\(/.test(gameEngine.split('function persistGameEngineState')[0])],
  ['Submission enqueue performs no queue processing or Discord delivery', !/function canonicalSubmissionEnqueueGameAutomation_[\s\S]*processAutomationQueueItem|function canonicalSubmissionEnqueueGameAutomation_[\s\S]*sendDiscordAnnouncementPayload/.test(canonical)],
  ['Queue deduplication remains enabled', /dedupeKey: item\.queueId/.test(automation)],
]

let failed = false
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  failed ||= !pass
}

if (failed) process.exitCode = 1
