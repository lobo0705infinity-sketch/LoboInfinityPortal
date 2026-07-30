import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const app = read('src/App.tsx')
const api = read('src/services/api.ts')
const gameCenter = read('src/pages/CommissionerGameCenter.tsx')
const correctionPage = read('src/pages/CommissionerGameScoreCorrection.tsx')

const failures = []

check(
  /const CommissionerGameScoreCorrection = lazyRoute\('CommissionerGameScoreCorrection',\s*\(\) => import\('\.\/pages\/CommissionerGameScoreCorrection'\)\)/,
  'Score correction page must be lazy-loaded by App.',
  app,
)

check(
  /path="\/commissioner\/game-center\/:gameId\/score-correction"[\s\S]*<CommissionerGameScoreCorrection \/>/,
  'Score correction page must have a Commissioner Game Center route.',
  app,
)

check(
  /const canCorrectScores = auth\.isAtLeastRole\('Commissioner'\)/,
  'Game Center correction action must be Commissioner-only.',
  gameCenter,
)

check(
  /navigate\(`\/commissioner\/game-center\/\$\{game\.id\}\/score-correction`\)/,
  'Game Center rows must link to the selected game score correction route.',
  gameCenter,
)

check(
  /event\.stopPropagation\(\)[\s\S]*navigate\(`\/commissioner\/game-center\/\$\{game\.id\}\/score-correction`\)/,
  'Correction action must not replace the existing row click Game Details behavior.',
  gameCenter,
)

check(
  /onClick=\{\(\) => navigate\(`\/games\/\$\{game\.id\}`\)\}/,
  'Game Center row click must continue opening existing Game Details.',
  gameCenter,
)

check(
  /apiClient[\s\S]*\.getGameCenter\(\{ signal: controller\.signal \}\)/,
  'Score correction page must load the selected game from canonical Game Center data.',
  correctionPage,
)

check(
  /await apiClient\.correctGameScore\(correction\)/,
  'Score correction page must submit through the existing correctGameScore client.',
  correctionPage,
)

check(
  /!auth\.authenticated \|\| !auth\.isAtLeastRole\('Commissioner'\)/,
  'Score correction page must require a Commissioner session.',
  correctionPage,
)

check(
  /expectedEventId: game\.eventId[\s\S]*expectedPlayer1: game\.player1[\s\S]*expectedPlayer2: game\.player2[\s\S]*expectedTp: normalizeExistingScore\(game\.tp\)[\s\S]*expectedOp: normalizeExistingScore\(game\.op\)[\s\S]*expectedVp: normalizeExistingScore\(game\.vp\)/,
  'Correction request must include immutable game and current score guards.',
  correctionPage,
)

check(
  /if \(normalizeExistingScore\(game\.op\) !== normalizeScorePair\(current\.p1Op, current\.p2Op\)\)[\s\S]*request\.player1ObjectivePoints = current\.p1Op\.trim\(\)[\s\S]*request\.player2ObjectivePoints = current\.p2Op\.trim\(\)/,
  'OP fields must only be sent when OP changes.',
  correctionPage,
)

check(
  /if \(normalizeExistingScore\(game\.tp\) !== normalizeScorePair\(current\.p1Tp, current\.p2Tp\)\)[\s\S]*request\.player1TournamentPoints = current\.p1Tp\.trim\(\)[\s\S]*request\.player2TournamentPoints = current\.p2Tp\.trim\(\)/,
  'TP fields must only be sent when TP changes.',
  correctionPage,
)

check(
  /if \(normalizeExistingScore\(game\.vp\) !== normalizeScorePair\(current\.p1Vp, current\.p2Vp\)\)[\s\S]*request\.player1VictoryPoints = current\.p1Vp\.trim\(\)[\s\S]*request\.player2VictoryPoints = current\.p2Vp\.trim\(\)/,
  'VP fields must only be sent when VP changes.',
  correctionPage,
)

check(
  /correctGameScore:\s*\([\s\S]*request: GameScoreCorrectionRequest[\s\S]*\) => Promise<GameScoreCorrectionResult>/,
  'API client contract must expose correctGameScore.',
  api,
)

check(
  /postRequest\('correctGameScore', options, params\)/,
  'API client must call the deployed correctGameScore endpoint.',
  api,
)

if (failures.length > 0) {
  console.error('Game Score correction UI regression check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Game Score correction UI regression check passed: 15 checks.')

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
