export type PublicStreamWithDate = { date?: unknown }

/** Parse the canonical stream date formats without relying on host date parsing. */
export function parseCanonicalStreamDate(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  let year: number
  let month: number
  let day: number
  let hour = 0
  let minute = 0
  let second = 0
  let millisecond = 0
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const isoTimestamp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(text)
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (isoTimestamp) {
    year = Number(isoTimestamp[1])
    month = Number(isoTimestamp[2])
    day = Number(isoTimestamp[3])
    hour = Number(isoTimestamp[4])
    minute = Number(isoTimestamp[5])
    second = Number(isoTimestamp[6])
    millisecond = Number((isoTimestamp[7] || '').padEnd(3, '0') || 0)
  } else if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
    day = Number(iso[3])
  } else if (slash) {
    month = Number(slash[1])
    day = Number(slash[2])
    year = Number(slash[3])
  } else {
    return null
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  const parsed = new Date(timestamp)
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? timestamp
    : null
}

/** Return a newest-first view while preserving canonical order for ties/invalid dates. */
export function sortPublicStreamsByDate<T extends PublicStreamWithDate>(streams: readonly T[]): T[] {
  return streams
    .map((stream, index) => ({ stream, index, timestamp: parseCanonicalStreamDate(stream.date) }))
    .sort((left, right) => {
      if (left.timestamp !== null && right.timestamp !== null) return right.timestamp - left.timestamp
      if (left.timestamp !== null) return -1
      if (right.timestamp !== null) return 1
      return left.index - right.index
    })
    .map(({ stream }) => stream)
}
