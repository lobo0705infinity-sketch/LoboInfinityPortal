import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const submitResult = read('src/pages/SubmitResult.tsx')
const api = read('src/services/api.ts')
const resultSubmission = read('backend/ResultSubmissionApi.gs')
const teamTournament = read('backend/TeamTournamentApi.gs')

assert.match(
  submitResult,
  /Submit Game For Other Players/,
  'Commissioner mode toggle must be rendered by Submit Game.',
)

assert.match(
  submitResult,
  /label="Player 1"/,
  'Commissioner mode must expose Player 1 selection.',
)

assert.match(
  submitResult,
  /label=\{isCommissionerSubmission \? 'Player 2' : 'Opponent'\}/,
  'Commissioner mode must expose Player 2 selection for league and casual games.',
)

assert.match(
  submitResult,
  /Commissioner Override/,
  'Commissioner override must be visible to commissioners.',
)

assert.match(
  submitResult,
  /commissionerReason/,
  'Commissioner submissions must carry an audit reason.',
)

assert.match(
  api,
  /commissionerMode\?: boolean/,
  'Submit Game API payload must support commissioner mode.',
)

assert.match(
  resultSubmission,
  /getResultSubmissionCommissionerContext/,
  'League and casual submission must enforce commissioner mode server-side.',
)

assert.match(
  resultSubmission,
  /Commissioner Submission Audit/,
  'Commissioner submissions must write an audit record.',
)

assert.match(
  teamTournament,
  /buildCommissionerTeamTournamentOverrideAssignment/,
  'Tournament submission must support commissioner override corrections.',
)

assert.match(
  teamTournament,
  /recordResultSubmissionCommissionerAudit/,
  'Tournament commissioner submissions must write an audit record.',
)

console.log('commissioner submit checks passed')
