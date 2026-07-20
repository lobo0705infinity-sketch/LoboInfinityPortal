import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const submitResult = read('src/pages/SubmitResult.tsx')

assert.match(
  submitResult,
  /const selectedGameType =\s*searchParams\.get\('gameType'\) \?\?\s*inferredSubmitContext\.gameType/s,
  'Submit Game must not bypass the shared game-type chooser for commissioners.',
)

assert.doesNotMatch(
  submitResult,
  /shouldDefaultCommissionerToCurrentLeague|auth\.isAtLeastRole\('Commissioner'\) && !hasExplicitGameType && !hasExplicitEventId/,
  'Commissioner role must not force /submit-game into the Current League event context.',
)

assert.match(
  submitResult,
  /searchParams\.get\('gameType'\) \?\?/,
  'Explicit gameType query parameters must continue to select focused submission flows.',
)

assert.match(
  submitResult,
  /searchParams\.get\('eventId'\) \?\?/,
  'Explicit eventId query parameters must continue to select event-specific submission flows.',
)

console.log('commissioner context checks passed')
