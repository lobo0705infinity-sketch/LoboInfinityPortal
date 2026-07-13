import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const submitResult = read('src/pages/SubmitResult.tsx')

assert.match(
  submitResult,
  /shouldDefaultCommissionerToCurrentLeague/,
  'Submit Game must explicitly guard commissioner default event context.',
)

assert.match(
  submitResult,
  /auth\.isAtLeastRole\('Commissioner'\) && !hasExplicitGameType && !hasExplicitEventId/,
  'Commissioner default may only apply when no explicit game type or event was requested.',
)

assert.match(
  submitResult,
  /shouldDefaultCommissionerToCurrentLeague \? 'event' : inferredSubmitContext\.gameType/,
  'Commissioner Submit Game must default to an event submission instead of Community Player Registry.',
)

assert.match(
  submitResult,
  /shouldDefaultCommissionerToCurrentLeague\s*\?\s*'event-current-league'\s*:\s*inferredSubmitContext\.eventId/s,
  'Commissioner Submit Game must begin in the Current League event context.',
)

assert.match(
  submitResult,
  /searchParams\.get\('gameType'\) \?\?/,
  'Explicit gameType query parameters must continue to override commissioner defaults.',
)

assert.match(
  submitResult,
  /searchParams\.get\('eventId'\) \?\?/,
  'Explicit eventId query parameters must continue to override commissioner defaults.',
)

console.log('commissioner context checks passed')
