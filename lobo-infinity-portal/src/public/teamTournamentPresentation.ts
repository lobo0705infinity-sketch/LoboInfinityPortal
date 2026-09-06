import type { PublicGame, PublicTeamTournamentStanding } from './snapshotTypes'

function parsePublicDate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value
  const text = String(value ?? '').trim()
  if (!text) return null
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text)
  if (slash) {
    const date = Date.UTC(Number(slash[3]), Number(slash[1]) - 1, Number(slash[2]), Number(slash[4] || 0), Number(slash[5] || 0), Number(slash[6] || 0))
    const checked = new Date(date)
    if (checked.getUTCFullYear() === Number(slash[3]) && checked.getUTCMonth() === Number(slash[1]) - 1 && checked.getUTCDate() === Number(slash[2])) return date
    return null
  }
  const parsed = Date.parse(text)
  return Number.isFinite(parsed) ? parsed : null
}

function numericGameNumber(game: PublicGame): number | null {
  const value = game.id
  const text = String(value ?? '').trim()
  return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : null
}

export function orderPublicTeamTournamentGames(games: PublicGame[]): PublicGame[] {
  return games.map((game, sourceIndex) => ({ game, sourceIndex })).sort((left, right) => {
    const leftDate = parsePublicDate(left.game.date)
    const rightDate = parsePublicDate(right.game.date)
    if ((leftDate !== null) !== (rightDate !== null)) return leftDate !== null ? -1 : 1
    if (leftDate !== null && rightDate !== null && leftDate !== rightDate) return rightDate - leftDate
    const leftNumber = numericGameNumber(left.game)
    const rightNumber = numericGameNumber(right.game)
    if ((leftNumber !== null) !== (rightNumber !== null)) return leftNumber !== null ? -1 : 1
    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) return rightNumber - leftNumber
    return left.sourceIndex - right.sourceIndex
  }).map(item => item.game)
}

export function orderPublicTeamTournamentStandings(standings: PublicTeamTournamentStanding[]): PublicTeamTournamentStanding[] {
  return standings.map((team, sourceIndex) => ({ team, sourceIndex })).sort((left, right) =>
    Number(right.team.objectivePoints) - Number(left.team.objectivePoints)
    || Number(right.team.tournamentPoints) - Number(left.team.tournamentPoints)
    || Number(right.team.victoryPoints) - Number(left.team.victoryPoints)
    || left.team.teamName.localeCompare(right.team.teamName)
    || left.sourceIndex - right.sourceIndex,
  ).map(({ team }, index) => ({ ...team, rank: index + 1 }))
}

export function getPublicTeamTournamentParticipants(game: PublicGame): [string, string] {
  const clean = (...values: unknown[]) => values.map(value => String(value ?? '').trim()).find(value => value && !/^(draw|tie|tied)$/i.test(value)) || ''
  const isDraw = /^(draw|tie|tied)$/i.test(String((game as PublicGame & { gameResult?: unknown }).gameResult ?? '').trim())
  if (!isDraw) {
    const winner = clean(game.winnerDisplayName, game.winner)
    const loser = clean(game.loserDisplayName, game.loser)
    if (winner && loser) return [winner, loser]
  }
  return [clean(game.player1DisplayName, game.player1) || 'Unknown player 1', clean(game.player2DisplayName, game.player2) || 'Unknown player 2']
}

export const parsePublicTeamTournamentDateForTests = parsePublicDate
