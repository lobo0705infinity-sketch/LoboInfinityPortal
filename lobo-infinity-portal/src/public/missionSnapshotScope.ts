import type { PublicGame, PublicMission } from './snapshotTypes'

export function getEventMissionGames(mission: string, games: PublicGame[], eventId: string) {
  return games.filter((game) => game.mission === mission && (eventId === 'all' || game.eventId === eventId))
    .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id)
}

// The published mission summary covers all events. Event views must calculate
// their own numbers from the same pinned games snapshot as the directory.
export function summarizeMissionForEvent(mission: PublicMission, games: PublicGame[], eventId: string): PublicMission {
  if (eventId === 'all') return mission

  const rows = getEventMissionGames(mission.mission, games, eventId)
  const appearances = new Map<string, number>()
  const wins = new Map<string, number>()
  const divisions = new Map<string, number>()
  const scores: Record<'tp' | 'op' | 'vp', number[]> = { tp: [], op: [], vp: [] }
  let firstTurnWins = 0

  for (const game of rows) {
    divisions.set(game.division, (divisions.get(game.division) ?? 0) + 1)
    for (const faction of [game.player1Faction, game.player2Faction]) {
      if (faction) appearances.set(faction, (appearances.get(faction) ?? 0) + 1)
    }
    if (game.winner !== 'Draw' && game.winnerFaction) {
      wins.set(game.winnerFaction, (wins.get(game.winnerFaction) ?? 0) + 1)
      for (const score of ['tp', 'op', 'vp'] as const) {
        const winnerScore = Number(game[score].split('–')[0])
        if (game[score].split('–')[0].trim() && Number.isFinite(winnerScore)) scores[score].push(winnerScore)
      }
    }
    const firstPlayer = game.firstTurn === 'Player 1' ? game.player1
      : game.firstTurn === 'Player 2' ? game.player2 : game.firstTurn
    if (firstPlayer && firstPlayer === game.winner) firstTurnWins += 1
  }

  const byPopularity = (left: string, right: string) =>
    (appearances.get(right) ?? 0) - (appearances.get(left) ?? 0) || left.localeCompare(right)
  const mostPlayedFaction = [...appearances.keys()].sort(byPopularity)[0] ?? ''
  const mostSuccessfulFaction = [...appearances.keys()].sort((left, right) =>
    (wins.get(right) ?? 0) / (appearances.get(right) ?? 1) -
    (wins.get(left) ?? 0) / (appearances.get(left) ?? 1) || byPopularity(left, right))[0] ?? ''
  const average = (values: number[]) => values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) * 100 / values.length) / 100 : 0

  return {
    ...mission,
    games: rows.length,
    averageTP: average(scores.tp),
    averageOP: average(scores.op),
    averageVP: average(scores.vp),
    firstTurnWinRate: rows.length ? Math.round(firstTurnWins * 1000 / rows.length) / 10 : 0,
    mostSuccessfulFaction,
    mostPlayedFaction,
    lastPlayed: rows[0]?.date ?? '',
    divisionBreakdown: [...divisions.entries()].sort(([left], [right]) => left.localeCompare(right))
      .map(([division, count]) => ({ division, games: count })),
    recentGames: rows.slice(0, 10).map((game) => ({ id: game.id })),
    bestMoments: rows.filter((game) => game.bestMoment).map((game) => ({
      gameId: game.id, date: game.date, mission: game.mission, moment: game.bestMoment,
    })),
  }
}
