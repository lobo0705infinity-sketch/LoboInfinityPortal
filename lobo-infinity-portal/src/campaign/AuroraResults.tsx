import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AURORA_TERRITORIES } from '../../shared/aurora-public.mjs'
import { factionName } from '../../shared/aurora-games.mjs'
import { useCampaignActivity } from './AuroraActivity'
import type { AuroraPublicState } from './auroraTypes'

const locationName = (id: string) => id === 'narrative' ? 'Narrative Mission' : AURORA_TERRITORIES.find(t => t.id === id)?.name || id
export default function AuroraResults({ state }: { state: AuroraPublicState }) {
  const live = useCampaignActivity(state.turn)
  const { hash } = useLocation()
  useEffect(() => {
    if (live.data && hash.startsWith('#battle-')) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, live.data])
  const rows = live.data?.totals ?? []
  const games = [...(live.data?.games ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  return <section className="panel aurora-panel">
    <p className="eyebrow">Live results · {state.turn ? `Turn ${state.turn}` : 'Before Turn 1'}</p>
    <h2>Confirmed games & Turn totals</h2>
    <p>Opponent-confirmed and commissioner-approved games supply these totals and the campaign map. Pending, disputed, rejected and unapproved late or duplicate games do not count.</p>
    {live.updated ? <p className="aurora-muted">Checked at {live.updated} · Refreshes every minute.</p> : null}
    {live.error ? <p role="alert">{live.error} {live.data ? 'The results below are from the last successful check.' : 'Live totals are unavailable; they are not assumed to be zero.'}</p> : null}
    {!live.data && !live.error ? <p role="status">Loading confirmed campaign results…</p> : live.data ? <>
      <p><strong>{games.length} confirmed {games.length === 1 ? 'game' : 'games'}{state.turn ? ' this Turn' : ' before campaign start'}.</strong></p>
      {(['territory', 'narrative'] as const).map(kind => {
        const totals = rows.filter(r => (r.location === 'narrative') === (kind === 'narrative'))
        return <div key={kind}><h3>{kind === 'narrative' ? 'Narrative Mission totals' : 'Territory battle totals'}</h3>
          {totals.length ? <div className="table-wrapper"><table><thead><tr><th scope="col">Location</th><th scope="col">Faction</th><th scope="col">TP</th><th scope="col">OP</th></tr></thead><tbody>{totals.map(r => <tr key={`${r.location}:${r.faction}`}><td>{locationName(r.location)}</td><td>{r.faction}</td><td>{r.tp}</td><td>{r.op}</td></tr>)}</tbody></table></div> : <p>No confirmed {kind === 'narrative' ? 'narrative games' : 'territory battles'} yet.</p>}
        </div>
      })}
      <h3>Confirmed battle history</h3>
      {games.length ? <div className="aurora-public-battles">{games.map(g => <article className="aurora-game-review" id={`battle-${g.id}`} key={g.id}>
        <h4>{g.playerA.name} vs {g.playerB.name}</h4>
        <p>{factionName(g.playerA.faction)} vs {factionName(g.playerB.faction)} · {g.date}</p>
        <p>{locationName(g.location)} · {g.mission}</p><p><strong>{g.opA}–{g.opB} OP · {g.tpA}–{g.tpB} TP</strong></p>
        <Link to={`/campaign/aurora-vii/${g.location === 'narrative' ? 'missions' : `territories/${g.location}`}`}>View Campaign Location →</Link>
        <p><Link to={`/campaign/aurora-vii/games?game=${g.id}`}>Players: review this game or request a correction →</Link></p>
      </article>)}</div> : <p>Confirmed campaign submissions will appear here automatically.</p>}
    </> : null}
    <p>These TP/OP totals are provisional campaign progress. Lobo resolves territory control, private faction systems and Campaign VP at Turn end. Narrative totals stay separate from territorial Influence.</p>
    <button type="button" onClick={live.reload}>Refresh live results</button>
    {state.totals.length ? <details><summary>GM-published results reference</summary><p>This is a separately published checkpoint, not additional games. It is not added to the live totals above.</p><ul>{state.totals.map(r => <li key={`${r.location}:${r.faction}`}>{locationName(r.location)} · {r.faction}: {r.tp} TP · {r.op} OP</li>)}</ul></details> : null}
  </section>
}
