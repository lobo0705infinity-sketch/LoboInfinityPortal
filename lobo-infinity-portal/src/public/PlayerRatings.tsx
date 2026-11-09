import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

type Rating = { player: string; displayName: string; elo: number; games: number; wins: number; losses: number; draws: number; rank: number; provisional: boolean; lastChange: number; band: string }
type Change = { id: string; date: string; player1: string; player2: string; winner: string; player1Before: number; player2Before: number; player1After: number; player2After: number }
type Ratings = { version: number; generatedAt: string; sourceCutoff: string; snapshotId: string; gameCount: number; leaderboard: Rating[]; history: Change[] }
let cached: Ratings | undefined

function useRatings() {
  const [value, setValue] = useState<Ratings | undefined>(cached)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const r = await fetch('/api/player-ratings', { signal: AbortSignal.timeout(20000) })
        if (!r.ok) throw Error('Ratings are temporarily unavailable. Please try again shortly.')
        const next = await r.json() as Ratings
        if (next.version !== 1 || !Array.isArray(next.leaderboard) || !Array.isArray(next.history)) throw Error('Ratings could not be verified.')
        cached = next
        if (active) { setValue(next); setError('') }
      } catch { if (active) setError('Ratings are temporarily unavailable. Please try again shortly.') }
    }
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 60000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  return { value, error }
}

export function PlayerRating({ player }: { player: string }) {
  const { value, error } = useRatings()
  const rating = value?.leaderboard.find(p => p.player.toLocaleLowerCase() === player.toLocaleLowerCase())
  return <p><Link to={`/elo?player=${encodeURIComponent(player)}`}>Portal ELO: {rating ? `${rating.elo}${rating.provisional ? ' · Provisional' : ''}` : error ? 'Temporarily unavailable' : value ? 'Unrated' : 'Loading…'}</Link></p>
}

export default function PlayerRatings() {
  const { value, error } = useRatings()
  const [query, setQuery] = useState('')
  const [params] = useSearchParams()
  const selected = params.get('player') || ''
  const rows = value?.leaderboard.filter(p => `${p.player} ${p.displayName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) || []
  const history = value?.history.filter(g => [g.player1, g.player2].includes(selected)).slice().reverse() || []
  return <main className="portal-shell snapshot-public-page" data-page="portal-elo">
    <header className="page-header"><p className="eyebrow">All Portal games</p><h1>Lobo Portal ELO</h1><p>One rating across league, tournament, casual, and confirmed campaign games. Everyone starts at 1500. Win, draw, or loss and opponent strength determine the change; K = 32. Ratings are provisional until ten completed games.</p><p>Infinity the Meta ratings are separate and do not affect Portal ELO.</p></header>
    {error ? <p role="alert">{error}{value ? ' Showing the last loaded ratings.' : ''}</p> : null}
    {!value && !error ? <p role="status">Loading ratings…</p> : null}
    {value ? <>
      <p>{value.gameCount} completed games · Portal results through {new Date(value.sourceCutoff).toLocaleString()} · Confirmed campaign reports checked {new Date(value.generatedAt).toLocaleString()}. Ratings and Discord roles refresh automatically.</p>
      <section className="panel"><h2>Leaderboard</h2><label htmlFor="elo-search">Find a player </label><input id="elo-search" type="search" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="table-wrapper"><table className="snapshot-data-table"><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Portal ELO</th><th scope="col">Last change</th><th scope="col">Games</th><th scope="col">W–L–D</th><th scope="col">Status</th></tr></thead><tbody>{rows.map(p => <tr key={p.player}><td>{p.rank}</td><td><Link to={`/elo?player=${encodeURIComponent(p.player)}`}>{p.displayName || p.player}</Link></td><td>{p.elo}</td><td>{p.lastChange >= 0 ? '+' : ''}{p.lastChange.toFixed(1)}</td><td>{p.games}</td><td>{p.wins}–{p.losses}–{p.draws}</td><td>{p.provisional ? 'Provisional' : 'Established'}</td></tr>)}</tbody></table></div>{!rows.length ? <p>No rated players match this search.</p> : null}
      </section>
      {selected ? <section className="panel"><h2>{selected} — Rating history</h2><p><Link to={`/players/${encodeURIComponent(selected)}`}>Open player profile</Link></p><div className="table-wrapper"><table className="snapshot-data-table"><thead><tr><th scope="col">Date</th><th scope="col">Game</th><th scope="col">Opponent</th><th scope="col">Result</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>{history.map(g => { const a = g.player1 === selected; return <tr key={g.id}><td>{g.date}</td><td>{g.id.startsWith('aurora:') ? 'Campaign' : <Link to={`/games/${g.id}`}>#{g.id}</Link>}</td><td>{a ? g.player2 : g.player1}</td><td>{g.winner === 'Draw' ? 'Draw' : g.winner === selected ? 'Win' : 'Loss'}</td><td>{Math.round(a ? g.player1Before : g.player2Before)}</td><td>{Math.round(a ? g.player1After : g.player2After)}</td></tr> })}</tbody></table></div>{!history.length ? <p>No completed games for this player.</p> : null}</section> : null}
    </> : null}
  </main>
}
