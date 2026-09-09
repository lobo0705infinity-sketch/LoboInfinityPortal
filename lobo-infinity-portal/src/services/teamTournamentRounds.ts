export function normalizeTeamTournamentRoundNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  const text = String(value ?? '').trim()
  if (!text) return null
  const match = text.match(/^(?:round\s*)?(\d+)$/i)
  if (!match) return null
  const number = Number(match[1])
  return Number.isInteger(number) && number > 0 ? number : null
}

export function getTeamTournamentRoundNumber(round: Record<string, unknown> | null | undefined): number | null {
  if (!round) return null
  const numbers = [round.number, round.name, round.round]
    .map(normalizeTeamTournamentRoundNumber)
    .filter((number): number is number => number !== null)
  return numbers.length ? Math.max(...numbers) : null
}

export function getNextTeamTournamentRoundNumber(
  rounds: Array<Record<string, unknown>>,
  current?: Record<string, unknown> | null,
): number {
  return Math.max(0, ...rounds.map(getTeamTournamentRoundNumber).filter((number): number is number => number !== null), getTeamTournamentRoundNumber(current) ?? 0) + 1
}
