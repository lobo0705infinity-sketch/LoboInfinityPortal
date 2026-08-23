import { readFileSync } from 'node:fs'

const canonical = readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
const gameEngine = readFileSync('backend/rebuildGameEngine().gs', 'utf8')
const automation = readFileSync('backend/AutomationApi.gs', 'utf8')
const deepLinks = readFileSync('backend/DeepLinkApi.gs', 'utf8')

const checks = [
  ['Google Form submissions publish after canonical rebuild', /coordinateCanonicalRebuild\([\s\S]*?canonicalSubmissionPublishGameAutomation_\(targetRow\)/.test(canonical)],
  ['Portal League and Casual publish once through the shared hook', (canonical.match(/canonicalSubmissionPublishGameAutomation_\(targetRow\);/g) || []).length === 3],
  ['Portal Team Tournament publishes through the shared hook', /canonicalSubmitPortalTeamTournamentGame_[\s\S]*?canonicalSubmissionPublishGameAutomation_\(targetRow\)/.test(canonical)],
  ['Shared hook resolves the submitted canonical Game ID', /const gameId = Number\(targetRow\) - 1;[\s\S]*Number\(game\.id\) === gameId/.test(canonical)],
  ['Shared hook never substitutes a different latest game', /if \(!submittedGame\)[\s\S]*return;[\s\S]*publishLatestGameSubmittedAutomationEvent\(submittedGame\)/.test(canonical)],
  ['Shared publisher accepts the exact submitted game', /function publishLatestGameSubmittedAutomationEvent\(game\)[\s\S]*publishGameSubmittedAutomationEvent\(submittedGame\)/.test(gameEngine)],
  ['Game event retains canonical payload and classification', /eventType: "gameSubmitted"[\s\S]*payload:[\s\S]*JSON\.stringify\(latestGame \|\| \{\}\)/.test(gameEngine)],
  ['Discord queue reuses the existing game payload builder', /item\.eventType === "gameSubmitted"[\s\S]*buildDiscordGamePayload\(eventPayload\)/.test(automation)],
  ['Game announcements link to the canonical Battle Report route', /case "gameSubmitted":[\s\S]*return "\/games\/" \+ encodeURIComponent\(getDeepLinkId\(data\.gameId \|\| data\.id\)\)/.test(deepLinks)],
  ['Rebuild itself does not publish game events', !/function rebuildGameEngine\([^]*?publishLatestGameSubmittedAutomationEvent\(/.test(gameEngine.split('function persistGameEngineState')[0])],
  ['Discord publication remains non-blocking', /function publishGameSubmittedAutomationEvent\(game\)[\s\S]*try \{[\s\S]*catch \(err\)/.test(gameEngine)],
  ['Queue deduplication remains enabled', /dedupeKey: item\.queueId/.test(automation)],
]

let failed = false
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  failed ||= !pass
}

if (failed) process.exitCode = 1
