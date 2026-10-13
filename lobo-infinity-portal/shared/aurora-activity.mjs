const nonConquest = new Set(['NA2', 'Tohaa', 'Combined Army'])
export function locationActivity(activity, location) {
  const games = activity.games.filter(game => game.location === location).sort((a,b) => b.date.localeCompare(a.date))
  const rows = activity.totals.filter(row => row.location === location).sort((a,b) => b.tp-a.tp || b.op-a.op || a.faction.localeCompare(b.faction))
  const conquest = rows.filter(row => !nonConquest.has(row.faction))
  const first = conquest[0]
  const leaders = first && first.tp > 0 ? conquest.filter(row => row.tp === first.tp && row.op === first.op).map(row => row.faction) : []
  return { games, rows, leaders, count: games.length }
}
