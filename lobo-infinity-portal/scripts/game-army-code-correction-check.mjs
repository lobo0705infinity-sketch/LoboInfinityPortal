import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const api = read('backend/API.gs')
const auth = read('backend/AuthApi.gs')
const config = read('backend/Config.gs')
const correction = read('backend/GameArmyCodeCorrectionApi.gs')

const failures = []

check(
  /function handleApiPost\(e, action\)[\s\S]*case "correctGameArmyCode":[\s\S]*requireApiPermission\(e,\s*"dataCorrections"[\s\S]*correctGameArmyCode\(e, auth\)/,
  'Game Army Code correction must be available through the authenticated POST router.',
  api,
)

check(
  /case "correctGameArmyCode":[\s\S]*requireApiPermission\(e,\s*"dataCorrections"[\s\S]*correctGameArmyCode\(e, auth\)/,
  'Every routed Game Army Code correction action must require the data correction permission.',
  api,
)

check(
  /dataCorrections:\s*USER_ROLES\.COMMISSIONER/,
  'Data correction permission must require the commissioner role.',
  auth,
)

check(
  /GAME_ARMY_CODE_CORRECTION_AUDIT:\s*"Game Army Code Correction Audit"/,
  'Game Army Code corrections must have a dedicated audit sheet.',
  config,
)

check(
  /validateSubmittedArmyCode\(\s*correctedArmyCode,\s*""\s*\)/,
  'Corrected Army Codes must pass the production validation pipeline before storage.',
  correction,
)

check(
  /decodeArmyCode\(correctedArmyCode\)/,
  'Corrected Army Codes must decode through the shared production decoder.',
  correction,
)

check(
  /validation\.blocking[\s\S]*validation\.severity === "Error"[\s\S]*!validation\.valid/,
  'Invalid corrected Army Codes must be rejected before any write.',
  correction,
)

check(
  /target\.sheet\s*\.\s*getRange\(\s*target\.rowNumber,\s*target\.armyCodeColumn \+ 1\s*\)\s*\.\s*setValue\(correctedArmyCode\)/,
  'Correction writes must update only the selected winner or loser Army Code cell.',
  correction,
)

check(
  /ensureResultSubmissionArmyCodeColumns\(sheet\)/,
  'Correction must use the normal result-submission Army Code column resolver.',
  correction,
)

check(
  /function getGameArmyCodeCorrectionPlayerNumber\(winner, playerRole\)[\s\S]*if \(winner === 0\)[\s\S]*playerRole === "winner"[\s\S]*\? 1[\s\S]*: 2/,
  'Draw corrections must map winnerArmyCode to Player 1 and loserArmyCode to Player 2.',
  correction,
)

check(
  /return playerRole === "winner"[\s\S]*\? winner[\s\S]*: winner === 1 \? 2 : 1/,
  'Non-draw corrections must preserve winner and loser Army Code mapping.',
  correction,
)

check(
  !/Winner\/loser Army Code correction is not available for drawn games/.test(correction),
  'Drawn games must not be rejected by the correction target resolver.',
)

check(
  /sourceType:[\s\S]*getGameEngineGameType\(row\) === "casual"[\s\S]*\? "casual"[\s\S]*: "league"/,
  'Corrections must retain the game source type for Army Intelligence snapshot regeneration.',
  correction,
)

check(
  /recordGameArmyCodeCorrectionAudit\(\{[\s\S]*previousHash[\s\S]*newHash[\s\S]*commissioner[\s\S]*reason/,
  'Correction must record previous and new hashes, commissioner, and reason.',
  correction,
)

check(
  /regenerateCorrectedGameArmyIntelligenceSnapshot\(\s*gameId,\s*playerRole,\s*target\.sourceType,[\s\S]*correctedArmyCode,\s*decoded\s*\)/,
  'Snapshot regeneration must use the target source type from the selected game.',
  correction,
)

check(
  /buildArmyIntelligenceSources\(\)[\s\S]*source\.sourceType === sourceType[\s\S]*String\(source\.sourceId\) === String\(gameId\)[\s\S]*source\.sourcePlayer === playerRole/,
  'Snapshot regeneration must be scoped to the selected game and player role.',
  correction,
)

check(
  /removeArmyIntelligenceSnapshotsForSource\(\s*source\.sourceType,\s*source\.sourceId,\s*source\.sourcePlayer\s*\)/,
  'Old snapshots for the corrected source must be removed before regeneration.',
  correction,
)

check(
  /invalidatePortalCacheActions\(\[\s*"armyLists",\s*"armyIntelligence"\s*\]\)/,
  'Correction must invalidate only armyLists and armyIntelligence cache actions.',
  correction,
)

check(
  /snapshotJson\.totals\.points !== decoded\.points[\s\S]*unitCount !== decoded\.unitCount/,
  'Regenerated snapshots must be verified against the decoded Army Code.',
  correction,
)

check(
  (correction.match(/\.setValue\(correctedArmyCode\)/g) || []).length === 1,
  'Correction must write the corrected Army Code to exactly one selected cell.',
)

check(
  !/gameResult[\s\S]{0,120}\.setValue|setValue[\s\S]{0,120}gameResult|GAME_RESULT[\s\S]{0,120}\.setValue|setValue[\s\S]{0,120}GAME_RESULT/.test(correction),
  'Correction must not modify the game result, so drawn games remain Draw.',
)

if (failures.length > 0) {
  console.error('Game Army Code correction regression check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Game Army Code correction regression check passed: 21 checks.')

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function check(condition, message, source = '') {
  const passed = condition instanceof RegExp
    ? condition.test(source)
    : Boolean(condition)

  if (!passed) {
    failures.push(message)
  }
}
