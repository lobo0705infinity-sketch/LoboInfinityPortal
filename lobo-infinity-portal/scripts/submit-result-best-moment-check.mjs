import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const submitResult = read('src/pages/SubmitResult.tsx')
const api = read('src/services/api.ts')
const backend = read('backend/ResultSubmissionApi.gs')

const casualSubmit = extractFunctionBlock(submitResult, 'async function submitCasual')
const leagueSubmit = extractFunctionBlock(submitResult, 'async function submit(event')
const commissionerPayload = extractFunctionBlock(submitResult, 'function buildCommissionerPayload')
const tournamentSubmit = extractFunctionBlock(submitResult, 'async function submit(event', submitResult.indexOf('function TeamTournamentResultSubmission'))

assert.match(
  casualSubmit,
  /const submission = \{\s*\.\.\.casualResult,\s*bestMoment: getFormDataString\(new FormData\(event\.currentTarget\), 'bestMoment'\),\s*\}/,
  'Casual submission must read the visible Best Moment form value into submission.bestMoment.',
)
assert.match(
  casualSubmit,
  /validateCasualResult\(submission,/,
  'Casual validation must validate the same submission object sent to the API.',
)
assert.match(
  casualSubmit,
  /apiClient\.submitCasualResult\(buildCommissionerPayload\(submission\)\)/,
  'Casual API payload must be built from the submitted Best Moment value.',
)
assert.match(
  submitResult,
  /<textarea\s+name="bestMoment"\s+onChange=\{\(event\) => updateCasualField\('bestMoment', event\.target\.value\)\}\s+required\s+rows=\{4\}\s+value=\{casualResult\.bestMoment\}/,
  'Casual Best Moment textarea must be the named controlled casualResult.bestMoment field.',
)

assert.match(
  commissionerPayload,
  /return \{\s*\.\.\.submission,\s*commissionerMode: true,\s*commissionerOverride: isCommissionerOverride,\s*commissionerReason,/,
  'Commissioner payload must preserve submission.bestMoment while adding commissioner metadata.',
)

assert.match(
  leagueSubmit,
  /const submission = \{\s*\.\.\.leagueResult,\s*bestMoment: getFormDataString\(new FormData\(event\.currentTarget\), 'bestMoment'\),\s*\}/,
  'League submission must read the visible Best Moment form value into submission.bestMoment.',
)
assert.match(
  leagueSubmit,
  /validateLeagueResult\(eventHome, submission,/,
  'League validation must continue to use the league submission object.',
)
assert.match(
  leagueSubmit,
  /apiClient\.submitLeagueResult\(buildCommissionerPayload\(submission\)\)/,
  'League API payload must continue to be built from the league submission object.',
)
assert.match(
  submitResult,
  /<textarea\s+name="bestMoment"\s+onChange=\{\(event\) => updateField\('bestMoment', event\.target\.value\)\}\s+required\s+rows=\{4\}\s+value=\{leagueResult\.bestMoment\}/,
  'League Best Moment textarea must remain the named controlled leagueResult.bestMoment field.',
)

assert.match(
  tournamentSubmit,
  /const form = new FormData\(event\.currentTarget\)[\s\S]*const params = Object\.fromEntries\(form\.entries\(\)\) as Record<string, string>/,
  'Tournament submission must continue to build params from form data.',
)
assert.match(
  submitResult,
  /<textarea name="bestMoment" required rows=\{3\} \/>/,
  'Tournament Best Moment textarea must keep the bestMoment form field name.',
)
assert.match(
  tournamentSubmit,
  /apiClient\.saveTeamTournamentResult\(\{\s*\.\.\.params,/,
  'Tournament submission must continue to send form params, including bestMoment when supported.',
)

assert.match(
  api,
  /postRequest\('submitCasualResult', options, \{\s*bestMoment: submission\.bestMoment,/,
  'submitCasualResult must serialize submission.bestMoment as bestMoment.',
)
assert.match(
  api,
  /postRequest\('submitLeagueResult', options, \{\s*\.\.\.submission,/,
  'submitLeagueResult must continue to serialize league submission fields including bestMoment.',
)
assert.match(
  backend,
  /if \(getResultSubmissionString\(params\.bestMoment\) === ""\)\s*return resultSubmissionFailure\("Best Moment is required\."\);/,
  'Backend Best Moment validation must remain required.',
)
assert.match(
  submitResult,
  /error instanceof Error\s*\?\s*error\.message\s*:\s*'Casual game could not be submitted\./,
  'Casual frontend errors must display the precise backend message when available.',
)

console.log('submit result Best Moment binding checks passed')

function extractFunctionBlock(source, signature, startAt = 0) {
  const start = source.indexOf(signature, startAt)
  assert.notEqual(start, -1, `${signature} must exist.`)
  const open = source.indexOf('{', start)
  assert.notEqual(open, -1, `${signature} must have a body.`)
  let depth = 0

  for (let index = open; index < source.length; index += 1) {
    const char = source[index]

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(start, index + 1)
      }
    }
  }

  assert.fail(`${signature} body must be balanced.`)
}
