import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const api = read('backend/API.gs')
const auth = read('backend/AuthApi.gs')
const config = read('backend/Config.gs')
const correction = read('backend/GameScoreCorrectionApi.gs')

const checks = [
  [
    /case "repairHistoricalArmyCodes":[\s\S]*requireApiPermission\(e,\s*"dataCorrections"[\s\S]*repairHistoricalArmyCodes\(e, auth\)/,
    'Historical Army Code repair must use the Commissioner-protected POST route.',
    api,
  ],
  [
    /dataCorrections:\s*USER_ROLES\.COMMISSIONER/,
    'Data correction permission must require the Commissioner role.',
    auth,
  ],
  [
    /GAME_ARMY_CODE_CORRECTION_AUDIT:\s*"Game Army Code Correction Audit"/,
    'Army Code repairs must retain their dedicated audit sheet.',
    config,
  ],
  [
    /function repairHistoricalArmyCodes\(e, auth\)[\s\S]*getGameScoreCorrectionTarget\(gameId\)[\s\S]*validateGameScoreCorrectionExpectations/,
    'Repair must resolve one canonical game and validate optimistic expectations.',
    correction,
  ],
  [
    /Player 1 and Player 2 Army Codes are required\./,
    'Repair must require both canonical player Army Codes.',
    correction,
  ],
  [
    /Submitted Army Codes match the stored Army Codes\./,
    'No-op Army Code repairs must be rejected.',
    correction,
  ],
  [
    /FORM\.PLAYER1_ARMY_CODE \+ 1[\s\S]*setValue\(player1ArmyCode\)[\s\S]*FORM\.PLAYER2_ARMY_CODE \+ 1[\s\S]*setValue\(player2ArmyCode\)/,
    'Repair must update only the two canonical Army Code columns.',
    correction,
  ],
  [
    /if \(typeof rebuildEverything === "function"\)[\s\S]*rebuildEverything\(\)[\s\S]*rebuildGameEngine\(\)/,
    'Repair must use the existing deterministic rebuild path.',
    correction,
  ],
  [
    /recordGameArmyCodeCorrectionAudit\(\{[\s\S]*previousPlayer1ArmyCode[\s\S]*previousPlayer2ArmyCode[\s\S]*player1ArmyCode[\s\S]*player2ArmyCode/,
    'Repair must audit both previous and replacement Army Codes.',
    correction,
  ],
  [
    /function recordGameArmyCodeCorrectionAudit[\s\S]*sheet\.appendRow/,
    'Army Code repair audit must remain durable.',
    correction,
  ],
  [
    /invalidatePortalCacheGroup\("all"\)/,
    'Repair must invalidate the established derived read-model cache scope.',
    correction,
  ],
  [
    /gameEngineRebuilt:[\s\S]*previousArmyCodes:[\s\S]*armyCodes:/,
    'Repair response must report before/after codes and rebuild status.',
    correction,
  ],
]

const failures = checks
  .filter(([pattern, , source]) => !pattern.test(source))
  .map(([, message]) => message)

if (/case "correctGameArmyCode"|function correctGameArmyCode\(/.test(`${api}\n${correction}`)) {
  failures.push('Removed single-side Army Code correction endpoint must not return.')
}

if (failures.length > 0) {
  console.error('Game Army Code correction regression check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Game Army Code correction regression check passed: ${checks.length} checks.`)

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}
