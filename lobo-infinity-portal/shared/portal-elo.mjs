// One deterministic calculation for the Portal leaderboard and Discord roles.
export const PORTAL_ELO_BASE = 1500
export const PORTAL_ELO_K = 32
export const ratingKey = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US')

export function ratingBand(value) {
  if (!Number.isFinite(value)) throw Error('A finite rating is required.')
  const rating = Math.round(value)
  if (rating < 1000) return 'Under 1000'
  if (rating >= 2200) return '2200+'
  const lower = Math.floor(rating / 200) * 200
  return `${lower}–${lower + 199}`
}

export function calculatePortalElo(games) {
  if (!Array.isArray(games)) throw Error('The complete game history is required.')
  const unique = new Map(), players = new Map(), history = []
  for (const game of games) {
    const id = String(game.id ?? '').trim(), a = ratingKey(game.player1), b = ratingKey(game.player2)
    const date = String(game.date ?? '').slice(0, 10), winner = ratingKey(game.winner)
    if (!id || !a || !b || a === b || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date ||
        ![a, b, 'draw'].includes(winner)) throw Error(`Invalid completed game: ${id || '(missing ID)'}`)
    const record = { id, a, b, date, winner }
    const prior = unique.get(id)
    if (prior && JSON.stringify(prior.record) !== JSON.stringify(record)) throw Error(`Conflicting game ID: ${id}`)
    if (!prior) unique.set(id, { record, game })
  }
  const ordered = [...unique.values()].sort((a, b) => a.record.date.localeCompare(b.record.date) ||
    a.record.id.localeCompare(b.record.id, 'en', { numeric: true }))
  function player(key, name, displayName) {
    if (!players.has(key)) players.set(key, { player: String(name).trim(), displayName: String(displayName || name).trim(),
      rating: PORTAL_ELO_BASE, games: 0, wins: 0, losses: 0, draws: 0, lastChange: 0, lastPlayed: '' })
    return players.get(key)
  }
  for (const { record: g, game } of ordered) {
    const a = player(g.a, game.player1, game.player1DisplayName), b = player(g.b, game.player2, game.player2DisplayName)
    const score = g.winner === 'draw' ? 0.5 : g.winner === g.a ? 1 : 0
    const beforeA = a.rating, beforeB = b.rating
    const delta = PORTAL_ELO_K * (score - 1 / (1 + 10 ** ((beforeB - beforeA) / 400)))
    a.rating += delta; b.rating -= delta
    for (const [p, s, change] of [[a, score, delta], [b, 1 - score, -delta]]) {
      p.games++; p.lastPlayed = g.date; p.lastChange = change
      if (s === 0.5) p.draws++; else if (s === 1) p.wins++; else p.losses++
    }
    history.push({ id: g.id, date: g.date, player1: a.player, player2: b.player, winner: game.winner,
      player1Before: beforeA, player2Before: beforeB, player1After: a.rating, player2After: b.rating, change: delta })
  }
  const leaderboard = [...players.values()].map(p => ({ ...p, elo: Math.round(p.rating), band: ratingBand(p.rating), provisional: p.games < 10 }))
    .sort((a, b) => b.rating - a.rating || a.player.localeCompare(b.player))
  let lastRating, rank
  leaderboard.forEach((p, index) => { if (p.rating !== lastRating) rank = index + 1; p.rank = rank; lastRating = p.rating })
  return { version: 1, baseline: PORTAL_ELO_BASE, k: PORTAL_ELO_K, scope: 'All completed Portal games',
    gameCount: unique.size, leaderboard, history }
}

// Only confirmed production campaign reports count. Practice is a separate store.
export function campaignEloGames(games, canonicalPlayers = []) {
  const aliases = new Map(canonicalPlayers.map(p => [ratingKey(p.player), p.player]))
  return games.filter(g => g.status === 'confirmed' && (!g.late || g.lateApproved) && (!g.duplicateOf || g.duplicateApproved))
    .map(g => {
      const a = aliases.get(ratingKey(g.playerA.name)) || g.playerA.name
      const b = aliases.get(ratingKey(g.playerB.name)) || g.playerB.name
      if (![g.opA, g.opB].every(v => typeof v === 'number' && Number.isFinite(v))) throw Error('Invalid confirmed campaign score.')
      return { id: `aurora:${g.id}`, date: g.date, player1: a, player2: b,
        winner: g.opA === g.opB ? 'Draw' : g.opA > g.opB ? a : b }
    })
}
