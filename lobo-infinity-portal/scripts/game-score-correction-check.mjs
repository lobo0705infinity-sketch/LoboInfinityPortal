import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const api = read('backend/API.gs')
const auth = read('backend/AuthApi.gs')
const config = read('backend/Config.gs')
const correction = read('backend/GameScoreCorrectionApi.gs')
const rebuild = read('backend/Rebuild.gs')
const securityCacheAudit = read('scripts/security-cache-audit.mjs')

const failures = []

check(
  /function handleApiPost\(e, action\)[\s\S]*case "correctGameScore":[\s\S]*requireApiPermission\(e,\s*"dataCorrections"[\s\S]*correctGameScore\(e, auth\)/,
  'Game Score correction must be available through the authenticated POST router.',
  api,
)

check(
  /case "correctGameScore":[\s\S]*requireApiPermission\(e,\s*"dataCorrections"[\s\S]*correctGameScore\(e, auth\)/,
  'Every routed Game Score correction action must require the data correction permission.',
  api,
)

check(
  /dataCorrections:\s*USER_ROLES\.COMMISSIONER/,
  'Data correction permission must require the commissioner role.',
  auth,
)

check(
  /GAME_SCORE_CORRECTION_AUDIT:\s*"Game Score Correction Audit"/,
  'Game Score corrections must have a dedicated audit sheet.',
  config,
)

check(
  /validateGameScoreCorrectionExpectations\(\s*params,\s*target\s*\)/,
  'Correction must validate expected game identity and current scores before writing.',
  correction,
)

check(
  /expectedTp[\s\S]*expectedOp[\s\S]*expectedVp/,
  'Correction must support expected TP, OP, and VP guards.',
  correction,
)

check(
  /player1ObjectivePoints[\s\S]*player2ObjectivePoints[\s\S]*FORM\.P1OP[\s\S]*FORM\.P2OP/,
  'OP correction must target only the Objective Point columns.',
  correction,
)

check(
  /player1TournamentPoints[\s\S]*player2TournamentPoints[\s\S]*FORM\.P1TP[\s\S]*FORM\.P2TP/,
  'TP correction parameters must map to only TP columns when explicitly supplied.',
  correction,
)

check(
  /player1VictoryPoints[\s\S]*player2VictoryPoints[\s\S]*FORM\.P1VP[\s\S]*FORM\.P2VP/,
  'VP correction parameters must map to only VP columns when explicitly supplied.',
  correction,
)

check(
  /player1Raw === "" &&[\s\S]*player2Raw === ""[\s\S]*return null/,
  'Unspecified score pairs must not be written.',
  correction,
)

check(
  /target\.sheet[\s\S]*\.getRange\(\s*target\.rowNumber,\s*update\.player1Column \+ 1\s*\)[\s\S]*\.setValue\(update\.player1\)[\s\S]*target\.sheet[\s\S]*\.getRange\(\s*target\.rowNumber,\s*update\.player2Column \+ 1\s*\)[\s\S]*\.setValue\(update\.player2\)/,
  'Correction writes must update only the selected score pair cells.',
  correction,
)

check(
  /const correctedResult\s*=\s*getGameScoreCorrectionResult\(after\)[\s\S]*const storedResult\s*=\s*getGameScoreCorrectionStoredResult\(target\.row\)[\s\S]*if \(correctedResult !== storedResult\)[\s\S]*FORM\.GAME_RESULT \+ 1[\s\S]*\.setValue\(correctedResult\)/,
  'Score correction must reconcile the canonical result only when corrected scores change it.',
  correction,
)

check(
  /recordGameScoreCorrectionAudit\(\{[\s\S]*previous: before[\s\S]*next: after[\s\S]*commissioner[\s\S]*reason/,
  'Correction must record previous scores, new scores, commissioner, and reason.',
  correction,
)

check(
  /function recordGameScoreCorrectionAudit\(record\)[\s\S]*record\.previous\.tp[\s\S]*record\.previous\.op[\s\S]*record\.previous\.vp[\s\S]*record\.next\.tp[\s\S]*record\.next\.op[\s\S]*record\.next\.vp/,
  'Audit must persist previous and new TP, OP, and VP values.',
  correction,
)

check(
  /rebuildEverything\(\)/,
  'Score correction must reuse the shared full rebuild pipeline.',
  correction,
)

check(
  /rebuildGameEngine\(\)[\s\S]*rebuildStandings\(\)[\s\S]*rebuildPlayerAnalytics\(\)[\s\S]*rebuildFactionAnalytics\(\)[\s\S]*rebuildMissionAnalytics\(\)/,
  'Shared rebuildEverything pipeline must rebuild game engine, standings, and analytics.',
  rebuild,
)

check(
  /invalidatePortalCacheGroup\("all"\)/,
  'Score correction must invalidate affected portal caches after rebuild.',
  correction,
)

check(
  /correctGameScore:\s*\{\s*authRequired:\s*true,\s*userScoped:\s*false\s*\}/,
  'Security cache audit must know the score correction endpoint is authenticated.',
  securityCacheAudit,
)

if (failures.length > 0) {
  console.error('Game Score correction regression check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Game Score correction regression check passed: 18 checks.')

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
