export const MATCHMAKING_TIME_ZONE = 'Europe/Warsaw'
export const MATCHMAKING_DIGEST_HOUR = 7
export const MINIMUM_MATCH_OVERLAP_MS = 90 * 60 * 1000

export const WEEKDAYS = Object.freeze([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
])

const timeZoneFormatterCache = new Map()

export function supportedTimeZones() {
  const zones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : []
  return ['UTC', ...zones.filter((zone) => zone !== 'UTC')]
}

export function normalizeTimeZone(value) {
  const candidate = String(value || '').trim()
  if (!candidate) throw new Error('Choose a time zone, such as Europe/Warsaw or America/New_York.')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    throw new Error(`“${candidate}” is not a supported IANA time zone.`)
  }
}

export function normalizeClockTime(value, label = 'Time') {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim())
  const hour = Number(match?.[1])
  const minute = Number(match?.[2])
  if (!match || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`${label} must use 24-hour HH:MM format, such as 19:30.`)
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function normalizeIsoDate(value) {
  const date = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || formatUtcDate(Date.parse(`${date}T00:00:00Z`)) !== date) {
    throw new Error('Date must use YYYY-MM-DD format, such as 2026-09-25.')
  }
  return date
}

export function zonedDateTimeToEpoch(dateValue, timeValue, timeZoneValue) {
  const date = normalizeIsoDate(dateValue)
  const time = normalizeClockTime(timeValue)
  const timeZone = normalizeTimeZone(timeZoneValue)
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let candidate = targetAsUtc

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(candidate, timeZone)
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0)
    candidate += targetAsUtc - representedAsUtc
  }

  const resolved = zonedParts(candidate, timeZone)
  if (
    resolved.year !== year
    || resolved.month !== month
    || resolved.day !== day
    || resolved.hour !== hour
    || resolved.minute !== minute
  ) {
    throw new Error(`${date} ${time} does not exist in ${timeZone}, usually because of a daylight-saving change.`)
  }
  return candidate
}

export function buildTimeWindow({ date, start, end, timeZone }) {
  const normalizedDate = normalizeIsoDate(date)
  const normalizedStart = normalizeClockTime(start, 'Start time')
  const normalizedEnd = normalizeClockTime(end, 'End time')
  const normalizedZone = normalizeTimeZone(timeZone)
  const startMs = zonedDateTimeToEpoch(normalizedDate, normalizedStart, normalizedZone)
  const endDate = normalizedEnd <= normalizedStart ? addUtcDays(normalizedDate, 1) : normalizedDate
  const endMs = zonedDateTimeToEpoch(endDate, normalizedEnd, normalizedZone)
  if (endMs <= startMs) throw new Error('End time must be after start time.')
  return { startMs, endMs, date: normalizedDate, start: normalizedStart, end: normalizedEnd, timeZone: normalizedZone }
}

export function dailyDigestWindow(nowMs = Date.now(), {
  timeZone = MATCHMAKING_TIME_ZONE,
  hour = MATCHMAKING_DIGEST_HOUR,
} = {}) {
  const parts = zonedParts(nowMs, timeZone)
  const date = formatDateParts(parts)
  const startMs = zonedDateTimeToEpoch(date, `${String(hour).padStart(2, '0')}:00`, timeZone)
  const endDate = addUtcDays(date, 1)
  const endMs = zonedDateTimeToEpoch(endDate, `${String(hour).padStart(2, '0')}:00`, timeZone)
  return {
    date,
    due: nowMs >= startMs,
    startMs,
    endMs,
    timeZone,
  }
}

export function expandRecurringAvailability(record, window) {
  const timeZone = normalizeTimeZone(record.timeZone)
  const anchorDate = formatDateParts(zonedParts(window.startMs, timeZone))
  const targetWeekday = String(record.weekday || '').trim().toLowerCase()
  if (!WEEKDAYS.includes(targetWeekday)) throw new Error(`Unsupported weekday: ${record.weekday}`)
  const output = []

  for (let offset = -2; offset <= 3; offset += 1) {
    const localDate = addUtcDays(anchorDate, offset)
    if (weekdayForDate(localDate) !== targetWeekday) continue
    const occurrence = buildTimeWindow({
      date: localDate,
      start: record.start,
      end: record.end,
      timeZone,
    })
    if (occurrence.startMs >= window.endMs || occurrence.endMs <= window.startMs) continue
    output.push({ ...record, ...occurrence })
  }
  return output
}

export function matchAvailabilityOccurrences(occurrences = [], {
  minimumOverlapMs = MINIMUM_MATCH_OVERLAP_MS,
} = {}) {
  const matches = []
  for (let leftIndex = 0; leftIndex < occurrences.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < occurrences.length; rightIndex += 1) {
      const left = occurrences[leftIndex]
      const right = occurrences[rightIndex]
      if (String(left.userId) === String(right.userId)) continue
      if (!formatsCompatible(left.format, right.format)) continue
      if (Number(left.points || 300) !== Number(right.points || 300)) continue
      if (!needsCompatible(left.need, right.need)) continue
      const overlapStartMs = Math.max(left.startMs, right.startMs)
      const overlapEndMs = Math.min(left.endMs, right.endMs)
      const overlapMs = overlapEndMs - overlapStartMs
      if (overlapMs < minimumOverlapMs) continue
      matches.push({ left, right, overlapStartMs, overlapEndMs, overlapMs })
    }
  }
  return matches.sort((a, b) => b.overlapMs - a.overlapMs || a.overlapStartMs - b.overlapStartMs)
}

export function formatsCompatible(left, right) {
  const first = String(left || 'tts').toLowerCase()
  const second = String(right || 'tts').toLowerCase()
  return first === 'either' || second === 'either' || first === second
}

export function needsCompatible(left, right) {
  const first = String(left || 'open').toLowerCase()
  const second = String(right || 'open').toLowerCase()
  if (first === 'league' || second === 'league') return first === second
  if (first === 'learn') return ['teach', 'open', 'casual'].includes(second)
  if (second === 'learn') return ['teach', 'open', 'casual'].includes(first)
  if (first === 'teach') return ['learn', 'open', 'casual'].includes(second)
  if (second === 'teach') return ['learn', 'open', 'casual'].includes(first)
  if (first === 'tournament') return ['tournament', 'competitive', 'open'].includes(second)
  if (second === 'tournament') return ['tournament', 'competitive', 'open'].includes(first)
  return true
}

export function discordTimestamp(epochMs, style = 'F') {
  return `<t:${Math.floor(Number(epochMs) / 1000)}:${style}>`
}

export function addUtcDays(dateValue, days) {
  const date = normalizeIsoDate(dateValue)
  const timestamp = Date.parse(`${date}T00:00:00Z`) + Number(days) * 24 * 60 * 60 * 1000
  return formatUtcDate(timestamp)
}

export function weekdayForDate(dateValue) {
  const date = normalizeIsoDate(dateValue)
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
}

function zonedParts(epochMs, timeZone) {
  const formatter = getTimeZoneFormatter(timeZone)
  const values = Object.fromEntries(formatter.formatToParts(new Date(epochMs))
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]))
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  }
}

function getTimeZoneFormatter(timeZone) {
  if (!timeZoneFormatterCache.has(timeZone)) {
    timeZoneFormatterCache.set(timeZone, new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }))
  }
  return timeZoneFormatterCache.get(timeZone)
}

function formatDateParts(parts) {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function formatUtcDate(epochMs) {
  return new Date(epochMs).toISOString().slice(0, 10)
}
