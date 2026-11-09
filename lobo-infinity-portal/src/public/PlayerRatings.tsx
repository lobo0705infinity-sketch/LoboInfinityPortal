import { useEffect, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PortalIcon from '../components/PortalIcon'
import './PlayerRatings.css'

type Rating = { player: string; displayName: string; elo: number; games: number; wins: number; losses: number; draws: number; rank: number; provisional: boolean; lastChange: number; band: string }
type Change = { id: string; date: string; player1: string; player2: string; winner: string; player1Before: number; player2Before: number; player1After: number; player2After: number }
type Ratings = { version: number; generatedAt: string; sourceCutoff: string; snapshotId: string; gameCount: number; leaderboard: Rating[]; history: Change[] }
let cached: Ratings | undefined
let pending: Promise<Ratings> | undefined
const key = (name: string) => name.normalize('NFKC').trim().toLocaleLowerCase()
const changeText = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`
const playedDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value))
const playerGames = (history: Change[], player: string) => history.filter(g => [key(g.player1), key(g.player2)].includes(key(player)))
const ratingAfter = (g: Change, player: string) => key(g.player1) === key(player) ? g.player1After : g.player2After
const ratingBefore = (g: Change, player: string) => key(g.player1) === key(player) ? g.player1Before : g.player2Before
const resultOf = (g: Change, player: string) => g.winner === 'Draw' ? 'D' : key(g.winner) === key(player) ? 'W' : 'L'

function loadRatings() {
  pending ??= fetch('/api/player-ratings', { signal: AbortSignal.timeout(20000) }).then(async r => {
    if (!r.ok) throw Error('Unavailable')
    const next = await r.json() as Ratings
    if (next.version !== 1 || !Array.isArray(next.leaderboard) || !Array.isArray(next.history)) throw Error('Invalid ratings')
    cached = next
    return next
  }).finally(() => { pending = undefined })
  return pending
}
function useRatings() {
  const [value, setValue] = useState<Ratings | undefined>(cached)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    async function load() {
      try { const next = await loadRatings(); if (active) { setValue(next); setError('') } }
      catch { if (active) setError('Ratings are temporarily unavailable. Please try again shortly.') }
    }
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 60000)
    return () => { active = false; window.clearInterval(timer) }
  }, [attempt])
  return { value, error, retry: () => setAttempt(value => value + 1) }
}

export function PlayerRating({ player }: { player: string }) {
  const { value, error } = useRatings()
  const rating = value?.leaderboard.find(p => key(p.player) === key(player))
  return <Link className="elo-profile-link" to={`/elo?player=${encodeURIComponent(player)}`}><PortalIcon name="hall"/><span>Portal ELO</span><strong>{rating ? rating.elo : error ? 'Unavailable' : value ? 'Unrated' : '…'}</strong>{rating?.provisional ? <small>Provisional</small> : null}<span aria-hidden="true">↗</span></Link>
}

function RatingTrend({ games, player, compact = false }: { games: Change[]; player: string; compact?: boolean }) {
  const id = useId().replace(/:/g, '')
  const values = [1500, ...games.map(g => ratingAfter(g, player))]
  const width = compact ? 106 : 600, height = compact ? 34 : 174
  const inset = compact ? 4 : 14
  const low = Math.min(...values) - 15, high = Math.max(...values) + 15
  const x = (i: number) => inset + i * (width - inset * 2) / Math.max(1, values.length - 1)
  const y = (value: number) => height - inset - (value - low) * (height - inset * 2) / (high - low)
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return <svg className={compact ? 'elo-spark' : 'elo-trend'} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${player}: Portal ELO from 1500 to ${Math.round(values.at(-1) || 1500)} across ${games.length} games`}>
    {!compact ? <><defs><linearGradient id={`elo-fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.24"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><polygon points={`${x(0)},${height} ${points} ${x(values.length - 1)},${height}`} fill={`url(#elo-fill-${id})`}/><line x1={inset} x2={width-inset} y1={y(1500)} y2={y(1500)} className="elo-baseline"/></> : null}
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth={compact ? 2 : 2.5} strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx={x(values.length-1)} cy={y(values.at(-1) || 1500)} r={compact ? 2.5 : 4} fill="currentColor"/>
  </svg>
}
function RecentForm({ games, player }: { games: Change[]; player: string }) {
  return <span className="elo-form" aria-label="Last five results, oldest to newest">{games.slice(-5).map(g => <span className={`elo-result elo-result-${resultOf(g, player)}`} key={g.id} title={`${playedDate(g.date)}: ${resultOf(g, player) === 'W' ? 'Win' : resultOf(g, player) === 'L' ? 'Loss' : 'Draw'}`}>{resultOf(g, player)}</span>)}</span>
}
function PlayerDetail({ player, history }: { player: Rating; history: Change[] }) {
  const games = playerGames(history, player.player)
  const peak = Math.max(1500, ...games.map(g => ratingAfter(g, player.player)))
  return <section className="elo-detail" aria-label={`${player.displayName} rating details`}>
    <div className="elo-detail-heading"><div><p className="elo-kicker">PLAYER DOSSIER · #{player.rank}</p><h2>{player.displayName || player.player}</h2></div><Link to={`/players/${encodeURIComponent(player.player)}`}>Player profile <span aria-hidden="true">↗</span></Link></div>
    <div className="elo-detail-grid"><div className="elo-detail-numbers"><div className="elo-detail-rating"><strong>{player.elo}</strong><span>Portal ELO</span><span className={`elo-change ${player.lastChange >= 0 ? 'elo-up' : 'elo-down'}`}>{changeText(player.lastChange)} last game</span></div><dl><div><dt>Peak rating</dt><dd>{Math.round(peak)}</dd></div><div><dt>Games played</dt><dd>{player.games}</dd></div><div><dt>Win / loss / draw</dt><dd>{player.wins} / {player.losses} / {player.draws}</dd></div><div><dt>Discord role band</dt><dd>{player.band}</dd></div></dl>{player.provisional ? <p className="elo-provisional-note">Provisional · {Math.max(0, 10-player.games)} more games to an established rating</p> : <p className="elo-provisional-note">Established rating</p>}</div><div className="elo-chart-panel"><div className="elo-chart-heading"><span>Rating journey</span><span>{games.length} games</span></div><RatingTrend games={games} player={player.player}/><div className="elo-chart-caption"><span>Started at 1500</span><span>Games played →</span><span>Now {player.elo}</span></div></div></div>
    <div className="elo-recent-heading"><h3>Recent rating changes</h3><RecentForm games={games} player={player.player}/></div>
    <div className="table-wrapper"><table className="elo-history-table"><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Result</th><th scope="col">Change</th><th scope="col">Rating</th><th scope="col">Report</th></tr></thead><tbody>{games.slice(-5).reverse().map(g => { const a = key(g.player1) === key(player.player), result = resultOf(g, player.player), delta = ratingAfter(g, player.player) - ratingBefore(g, player.player); return <tr key={g.id}><td>{playedDate(g.date)}</td><td>{a ? g.player2 : g.player1}</td><td><span className={`elo-result elo-result-${result}`}>{result}</span></td><td className={delta >= 0 ? 'elo-up' : 'elo-down'}>{changeText(delta)}</td><td>{Math.round(ratingAfter(g, player.player))}</td><td>{g.id.startsWith('aurora:') ? 'Campaign' : <Link to={`/games/${g.id}`}>#{g.id} ↗</Link>}</td></tr> })}</tbody></table></div>
  </section>
}

export default function PlayerRatings() {
  const { value, error, retry } = useRatings()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [params] = useSearchParams()
  const selected = params.get('player') || ''
  const selectedPlayer = value?.leaderboard.find(p => key(p.player) === key(selected))
  const rows = value?.leaderboard.filter(p => `${p.player} ${p.displayName}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (status === 'all' || (status === 'provisional' ? p.provisional : !p.provisional))) || []
  const gamesByPlayer = new Map(value?.leaderboard.map(p => [p.player, playerGames(value.history, p.player)]))
  return <main className="portal-shell snapshot-public-page elo-page" data-page="portal-elo">
    <header className="elo-hero"><img src="/assets/portal-artwork/elo-main-man-v1.webp" srcSet="/assets/portal-artwork/elo-main-man-v1-mobile.webp 768w, /assets/portal-artwork/elo-main-man-v1.webp 1600w" sizes="(min-width:921px) calc(100vw - 318px), 100vw" width="1600" height="533" alt="Lobo lounges on a champion’s podium beside a gold trophy in a futuristic hall of fame" fetchPriority="high"/><div className="elo-hero-shade"/><div className="elo-hero-copy"><p className="elo-kicker">LOBO’S INFINITY LEAGUE · PLAYER RANKINGS</p><h1>Lobo Portal <em>ELO</em></h1><p>Every game counts.<br/>Make your way to the top.</p><div className="elo-hero-meta"><span><strong>{value?.leaderboard.length ?? '—'}</strong> rated players</span><span><strong>{value?.gameCount ?? '—'}</strong> completed games</span></div></div></header>
    <div className="elo-intro"><p>One leaderboard. All Portal games.</p><span><i aria-hidden="true"/>Automatic updates</span></div>
    {error ? <div className="elo-notice" role="alert"><span>{error}{value ? ' Showing the last loaded ratings.' : ''}</span><button type="button" onClick={retry}>Try again</button></div> : null}
    {!value && !error ? <div className="elo-loading" role="status">Loading the standings…</div> : null}
    {value ? <>
      <section className="elo-leaders" aria-label="Top three players">{value.leaderboard.slice(0,3).map(p => <Link className={`elo-leader elo-leader-${p.rank}`} key={p.player} to={`/elo?player=${encodeURIComponent(p.player)}`} aria-label={`Rank ${p.rank}: ${p.displayName}, ${p.elo} ELO, ${p.provisional ? 'provisional' : 'established'}`}><span className="elo-leader-rank">{p.rank === 1 ? <PortalIcon name="hall"/> : `0${p.rank}`}</span><div className="elo-leader-player"><span>{p.rank === 1 ? 'TOP OF THE TABLE' : `RANK ${p.rank}`}</span><strong>{p.displayName || p.player}</strong><small>{p.games} games · {p.provisional ? 'Provisional' : 'Established'}</small></div><div className="elo-leader-score"><strong>{p.elo}</strong><span className={p.lastChange >= 0 ? 'elo-up' : 'elo-down'}>{changeText(p.lastChange)}</span></div></Link>)}</section>
      {selectedPlayer ? <PlayerDetail player={selectedPlayer} history={value.history}/> : selected ? <div className="elo-notice">No completed Portal games found for this player.</div> : null}
      <section className="elo-standings" aria-labelledby="elo-standings-heading"><div className="elo-standings-toolbar"><div><p className="elo-kicker">THE STANDINGS</p><h2 id="elo-standings-heading">Who's climbing?</h2></div><div className="elo-filters"><label className="elo-search" htmlFor="elo-search"><PortalIcon name="search"/><span className="sr-only">Find a player</span><input id="elo-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a player…"/></label><label className="sr-only" htmlFor="elo-status">Rating status</label><select id="elo-status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All players</option><option value="established">Established</option><option value="provisional">Provisional</option></select></div></div>
        <div className="elo-table-wrap"><table className="elo-table"><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Portal ELO</th><th scope="col">Last game</th><th scope="col">Form</th><th scope="col">Games</th><th scope="col">W–L–D</th><th scope="col" className="elo-trend-column">Journey</th></tr></thead><tbody>{rows.map(p => <tr className={key(p.player) === key(selected) ? 'elo-selected-row' : ''} key={p.player}><td><span className={`elo-rank ${p.rank <= 3 ? 'elo-rank-top' : ''}`}>{String(p.rank).padStart(2,'0')}</span></td><td><Link className="elo-table-player" to={`/elo?player=${encodeURIComponent(p.player)}`}>{p.displayName || p.player}<span aria-hidden="true">↗</span></Link><small className="elo-table-status">{p.provisional ? 'Provisional' : 'Established'}</small></td><td className="elo-table-rating">{p.elo}</td><td className={`elo-change ${p.lastChange >= 0 ? 'elo-up' : 'elo-down'}`}><span aria-hidden="true">{p.lastChange > 0 ? '↗' : p.lastChange < 0 ? '↘' : '–'}</span> {changeText(p.lastChange)}</td><td><RecentForm games={gamesByPlayer.get(p.player) || []} player={p.player}/></td><td>{p.games}</td><td className="elo-table-record">{p.wins}–{p.losses}–{p.draws}</td><td className="elo-trend-column"><RatingTrend compact games={gamesByPlayer.get(p.player) || []} player={p.player}/></td></tr>)}</tbody></table></div>
        {!rows.length ? <p className="elo-empty">No players match these filters.</p> : null}<div className="elo-table-footer"><span>{rows.length} of {value.leaderboard.length} players</span><span>Form: last five games, oldest → newest</span></div>
      </section>
      <footer className="elo-page-footer"><details><summary>How Portal ELO works</summary><p>Everyone starts at 1500. Ratings change with win, draw, or loss and opponent strength (K = 32). All completed league, tournament, casual, and confirmed campaign games count. Ratings are provisional until ten games. Corrected results recalculate later games. Infinity the Meta ratings are independent.</p><p>Discord: use <code>/elo</code> to view ratings, or open a member’s profile to see their rating-band roles.</p></details><p>Published Portal results through <time dateTime={value.sourceCutoff}>{new Date(value.sourceCutoff).toLocaleString()}</time>. Confirmed campaign reports checked <time dateTime={value.generatedAt}>{new Date(value.generatedAt).toLocaleTimeString([], { hour:'numeric',minute:'2-digit' })}</time>.</p></footer>
    </> : null}
  </main>
}
