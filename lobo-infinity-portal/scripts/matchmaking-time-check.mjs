import assert from 'node:assert/strict'
import {
  buildTimeWindow,
  dailyDigestWindow,
  discordTimestamp,
  expandRecurringAvailability,
  formatsCompatible,
  matchAvailabilityOccurrences,
  needsCompatible,
  normalizeClockTime,
  normalizeIsoDate,
  normalizeTimeZone,
  weekdayForDate,
  zonedDateTimeToEpoch,
} from '../bot/matchmaking-time.mjs'

assert.equal(normalizeClockTime('7:05'), '07:05')
assert.equal(normalizeIsoDate('2026-09-22'), '2026-09-22')
assert.equal(normalizeTimeZone('Europe/Warsaw'), 'Europe/Warsaw')
assert.equal(weekdayForDate('2026-09-22'), 'tuesday')
await assert.rejects(async () => normalizeClockTime('7pm'), /HH:MM/)
await assert.rejects(async () => normalizeIsoDate('2026-02-30'), /YYYY-MM-DD/)

const warsawEvening = buildTimeWindow({
  date: '2026-09-22',
  start: '19:00',
  end: '22:00',
  timeZone: 'Europe/Warsaw',
})
assert.equal(new Date(warsawEvening.startMs).toISOString(), '2026-09-22T17:00:00.000Z')
assert.equal(new Date(warsawEvening.endMs).toISOString(), '2026-09-22T20:00:00.000Z')
assert.equal(discordTimestamp(warsawEvening.startMs), '<t:1790096400:F>')

const overnight = buildTimeWindow({
  date: '2026-09-22',
  start: '22:00',
  end: '01:00',
  timeZone: 'Europe/Warsaw',
})
assert.equal(overnight.endMs - overnight.startMs, 3 * 60 * 60 * 1000)

assert.throws(
  () => zonedDateTimeToEpoch('2026-03-29', '02:30', 'Europe/Warsaw'),
  /does not exist/,
)

const now = Date.parse('2026-09-22T05:00:00.000Z')
const digest = dailyDigestWindow(now)
assert.equal(digest.date, '2026-09-22')
assert.equal(digest.due, true)
assert.equal(new Date(digest.startMs).toISOString(), '2026-09-22T05:00:00.000Z')
assert.equal(new Date(digest.endMs).toISOString(), '2026-09-23T05:00:00.000Z')
assert.equal(dailyDigestWindow(now - 1).due, false)

const lobo = {
  userId: '1',
  displayName: 'Lobo',
  weekday: 'tuesday',
  start: '19:00',
  end: '23:00',
  timeZone: 'Europe/Warsaw',
  format: 'tts',
  points: 300,
  need: 'open',
}
const challenger = {
  ...lobo,
  userId: '2',
  displayName: 'Challenger',
  start: '20:00',
  end: '22:00',
  timeZone: 'Europe/London',
}
const occurrences = [
  ...expandRecurringAvailability(lobo, digest),
  ...expandRecurringAvailability(challenger, digest),
]
assert.equal(occurrences.length, 2)
const matches = matchAvailabilityOccurrences(occurrences)
assert.equal(matches.length, 1)
assert.equal(matches[0].overlapMs, 60 * 60 * 1000 * 2)
assert.equal(formatsCompatible('tts', 'either'), true)
assert.equal(formatsCompatible('tts', 'in-person'), false)
assert.equal(needsCompatible('learn', 'teach'), true)
assert.equal(needsCompatible('league', 'open'), false)

console.log('Matchmaking time checks passed.')
