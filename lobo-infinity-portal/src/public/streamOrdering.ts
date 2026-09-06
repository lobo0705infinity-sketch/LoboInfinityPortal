export type PublicStreamWithDate = { date?: unknown }

/** Parse the canonical stream date formats without relying on host date parsing. */
export function parseCanonicalStreamDate(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  let year: number
  let month: number
  let day: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (iso) {
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
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const timestamp = Date.UTC(year, month - 1, day)
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
