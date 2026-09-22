export const MATCHMAKING_TIME_ZONE = 'Europe/Warsaw'
export const MATCHMAKING_DIGEST_HOUR = 7
export const MINIMUM_MATCH_OVERLAP_MS = 90 * 60 * 1000

export const COMMON_TIME_ZONE_CHOICES = Object.freeze([
  { name: 'UTC / GMT', value: 'UTC', aliases: ['utc', 'gmt', 'universal'] },
  { name: 'Eastern Time (New York / Atlanta)', value: 'America/New_York', aliases: ['eastern', 'eastern time', 'et', 'est', 'edt', 'new york', 'nyc', 'atlanta', 'miami'] },
  { name: 'Central Time (Chicago / Dallas)', value: 'America/Chicago', aliases: ['central', 'central time', 'ct', 'cst', 'cdt', 'chicago', 'dallas', 'houston'] },
  { name: 'Mountain Time (Denver)', value: 'America/Denver', aliases: ['mountain', 'mountain time', 'mt', 'mst', 'mdt', 'denver'] },
  { name: 'Arizona Time (Phoenix)', value: 'America/Phoenix', aliases: ['arizona', 'phoenix', 'arizona time'] },
  { name: 'Pacific Time (Los Angeles / Seattle)', value: 'America/Los_Angeles', aliases: ['pacific', 'pacific time', 'pt', 'pst', 'pdt', 'los angeles', 'la', 'seattle', 'san francisco'] },
  { name: 'Alaska Time (Anchorage)', value: 'America/Anchorage', aliases: ['alaska', 'alaska time', 'akst', 'akdt', 'anchorage'] },
  { name: 'Hawaii Time (Honolulu)', value: 'Pacific/Honolulu', aliases: ['hawaii', 'hawaii time', 'hst', 'honolulu'] },
  { name: 'Atlantic Time (Halifax)', value: 'America/Halifax', aliases: ['atlantic', 'atlantic time', 'ast', 'adt', 'halifax'] },
  { name: 'Newfoundland Time (St. John’s)', value: 'America/St_Johns', aliases: ['newfoundland', 'newfoundland time', 'nst', 'ndt', 'st johns'] },
  { name: 'Mexico City', value: 'America/Mexico_City', aliases: ['mexico', 'mexico city'] },
  { name: 'Brazil Time (São Paulo)', value: 'America/Sao_Paulo', aliases: ['brazil', 'brasil', 'sao paulo', 'são paulo'] },
  { name: 'Argentina Time (Buenos Aires)', value: 'America/Argentina/Buenos_Aires', aliases: ['argentina', 'buenos aires'] },
  { name: 'United Kingdom (London)', value: 'Europe/London', aliases: ['uk', 'united kingdom', 'britain', 'england', 'london', 'bst'] },
  { name: 'Ireland (Dublin)', value: 'Europe/Dublin', aliases: ['ireland', 'dublin'] },
  { name: 'Central Europe (Berlin / Paris / Rome)', value: 'Europe/Berlin', aliases: ['central europe', 'cet', 'cest', 'berlin', 'paris', 'rome', 'madrid', 'amsterdam', 'brussels', 'vienna', 'prague'] },
  { name: 'Poland (Warsaw)', value: 'Europe/Warsaw', aliases: ['poland', 'warsaw'] },
  { name: 'Eastern Europe (Athens / Helsinki)', value: 'Europe/Athens', aliases: ['eastern europe', 'eet', 'eest', 'athens', 'helsinki', 'bucharest'] },
  { name: 'Turkey (Istanbul)', value: 'Europe/Istanbul', aliases: ['turkey', 'türkiye', 'istanbul'] },
  { name: 'India (Kolkata)', value: 'Asia/Kolkata', aliases: ['india', 'ist', 'kolkata', 'calcutta', 'mumbai', 'delhi'] },
  { name: 'China (Shanghai)', value: 'Asia/Shanghai', aliases: ['china', 'shanghai', 'beijing'] },
  { name: 'Japan (Tokyo)', value: 'Asia/Tokyo', aliases: ['japan', 'jst', 'tokyo'] },
  { name: 'Singapore', value: 'Asia/Singapore', aliases: ['singapore', 'sgt'] },
  { name: 'Australia Eastern (Sydney / Melbourne)', value: 'Australia/Sydney', aliases: ['australia eastern', 'aest', 'aedt', 'sydney', 'melbourne'] },
  { name: 'New Zealand (Auckland)', value: 'Pacific/Auckland', aliases: ['new zealand', 'nzst', 'nzdt', 'auckland'] },
])

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

const commonTimeZoneAliases = new Map(COMMON_TIME_ZONE_CHOICES.flatMap((choice) => (
  [choice.name, choice.value, ...choice.aliases]
    .map((alias) => [normalizeTimeZoneSearch(alias), choice.value])
)))

export function supportedTimeZones() {
  const zones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : []
  return ['UTC', ...zones.filter((zone) => zone !== 'UTC')]
}

export function timeZoneAutocompleteChoices(value, zones = supportedTimeZones()) {
  const needle = normalizeTimeZoneSearch(value)
  if (!needle) return COMMON_TIME_ZONE_CHOICES.slice(0, 25).map(({ name, value: zone }) => ({ name, value: zone }))

  const commonValues = new Set(COMMON_TIME_ZONE_CHOICES.map((choice) => choice.value))
  const candidates = [
    ...COMMON_TIME_ZONE_CHOICES.map((choice) => ({
      name: choice.name,
      value: choice.value,
      score: bestTimeZoneSearchScore([choice.name, choice.value, ...choice.aliases], needle),
      common: true,
    })),
    ...zones.filter((zone) => !commonValues.has(zone)).map((zone) => ({
      name: zone.replaceAll('_', ' '),
      value: zone,
      score: bestTimeZoneSearchScore([zone], needle),
      common: false,
    })),
  ]
  return candidates
    .filter((choice) => Number.isFinite(choice.score))
    .sort((left, right) => left.score - right.score || Number(right.common) - Number(left.common) || left.name.localeCompare(right.name))
    .slice(0, 25)
    .map(({ name, value: zone }) => ({ name: name.slice(0, 100), value: zone }))
}

export function normalizeTimeZone(value) {
  const candidate = String(value || '').trim()
  if (!candidate) throw new Error('Choose a time zone, such as Europe/Warsaw or America/New_York.')
  const normalizedCandidate = normalizeTimeZoneSearch(candidate)
  const resolvedCandidate = commonTimeZoneAliases.get(normalizedCandidate)
    || supportedTimeZones().find((zone) => normalizeTimeZoneSearch(zone) === normalizedCandidate)
    || candidate
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: resolvedCandidate }).format(new Date())
    return resolvedCandidate
  } catch {
    throw new Error(`I could not recognize “${candidate}”. Start typing a city, country, or familiar zone such as Eastern or Pacific.`)
  }
}

export function normalizeClockTime(value, label = 'Time') {
  const candidate = String(value || '').trim().toLowerCase().replaceAll('.', '').replace(/\s+/g, '')
  const meridiemMatch = /(am|pm)$/.exec(candidate)
  const meridiem = meridiemMatch?.[1] || ''
  const clock = meridiem ? candidate.slice(0, -meridiem.length) : candidate
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(clock)
  let hour = Number(match?.[1])
  const minute = Number(match?.[2] || 0)

  if (meridiem) {
    if (!match || hour < 1 || hour > 12 || minute > 59) throw invalidClockTimeError(label)
    if (hour === 12) hour = 0
    if (meridiem === 'pm') hour += 12
  } else if (!match || hour < 0 || hour > 23 || minute > 59) {
    throw invalidClockTimeError(label)
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function invalidClockTimeError(label) {
  return new Error(`${label} must be a standard or 24-hour time, such as 7 PM, 7:30 PM, 1900, or 19:30.`)
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

function bestTimeZoneSearchScore(values, needle) {
  let best = Number.POSITIVE_INFINITY
  for (const value of values) {
    const normalized = normalizeTimeZoneSearch(value)
    if (!normalized) continue
    if (normalized === needle) best = Math.min(best, 0)
    else if (normalized.endsWith(` ${needle}`)) best = Math.min(best, 1)
    else if (normalized.startsWith(needle)) best = Math.min(best, 2)
    else if (normalized.split(' ').some((part) => part.startsWith(needle))) best = Math.min(best, 3)
    else if (normalized.includes(needle)) best = Math.min(best, 4)
  }
  return best
}

function normalizeTimeZoneSearch(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
