import assert from 'node:assert/strict'
import {
  formatNotificationTimestamp,
  parseNotificationTimestamp,
} from '../src/services/formatting.ts'

const firestoreTimestamp = {
  toDate: () => new Date('2026-08-12T15:30:00.000Z'),
}

const secondsTimestamp = {
  seconds: Date.UTC(2026, 7, 12) / 1000,
}

assert.equal(
  parseNotificationTimestamp(firestoreTimestamp)?.toISOString(),
  '2026-08-12T15:30:00.000Z',
  'Firestore Timestamp-like toDate() values should parse.',
)

assert.equal(
  parseNotificationTimestamp(secondsTimestamp)?.toISOString(),
  '2026-08-12T00:00:00.000Z',
  'Firestore seconds Timestamp-like values should parse.',
)

assert.equal(
  parseNotificationTimestamp(new Date('2026-08-12T00:00:00.000Z'))?.toISOString(),
  '2026-08-12T00:00:00.000Z',
  'JavaScript Date values should parse.',
)

assert.equal(
  parseNotificationTimestamp('2026-08-12T00:00:00.000Z')?.toISOString(),
  '2026-08-12T00:00:00.000Z',
  'ISO strings should parse.',
)

assert.equal(
  parseNotificationTimestamp(46246)?.toISOString(),
  '2026-08-12T00:00:00.000Z',
  'Google Sheets serial dates should parse.',
)

assert.equal(
  parseNotificationTimestamp(null),
  null,
  'Null timestamps should be invalid.',
)

assert.equal(
  parseNotificationTimestamp(undefined),
  null,
  'Undefined timestamps should be invalid.',
)

assert.equal(
  parseNotificationTimestamp('14:30:00'),
  null,
  'Time-only values should not become December 30, 1899.',
)

assert.equal(
  parseNotificationTimestamp('1899-12-30T14:30:00.000Z'),
  null,
  'Google Sheets time-only sentinel dates should be rejected.',
)

assert.equal(
  formatNotificationTimestamp('14:30:00'),
  'Unknown',
  'Invalid notification timestamps should display Unknown.',
)

console.log('notification timestamp formatter checks passed')
