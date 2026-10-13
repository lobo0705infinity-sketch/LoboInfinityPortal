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
    if (live.data && hash.startsWith('#battle-')) { const battle = document.getElementById(hash.slice(1)); if (battle instanceof HTMLDetailsElement) battle.open = true; battle?.scrollIntoView({ block: 'start' }) }
  }, [hash, live.data])
  const rows = live.data?.totals ?? []
  const games = [...(live.data?.games ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  return <section className="panel aurora-panel">

    <h2>Results</h2>

    {live.error ? <p role="alert">{live.error} {live.data ? 'The results below are from the last successful check.' : 'Live totals are unavailable; they are not assumed to be zero.'}</p> : null}
    {!live.data && !live.error ? <p role="status">Loading confirmed campaign results…</p> : live.data ? <>
      <p><strong>{games.length} confirmed {games.length === 1 ? 'game' : 'games'}{state.turn ? ' this Turn' : ' before campaign start'}.</strong></p>
      {(['territory', 'narrative'] as const).map(kind => {
        const totals = rows.filter(r => (r.location === 'narrative') === (kind === 'narrative'))
        return totals.length ? <div key={kind}><h3>{kind === 'narrative' ? 'Narrative Mission totals' : 'Territory battle totals'}</h3>
          <div className="table-wrapper"><table><thead><tr><th scope="col">Location</th><th scope="col">Faction</th><th scope="col">TP</th><th scope="col">OP</th></tr></thead><tbody>{totals.map(r => <tr key={`${r.location}:${r.faction}`}><td>{locationName(r.location)}</td><td>{r.faction}</td><td>{r.tp}</td><td>{r.op}</td></tr>)}</tbody></table></div>
        </div> : null
      })}
      {games.length ? <><h3>Confirmed battle history</h3><div className="aurora-public-battles">{games.map(g => <details className="aurora-battle-row" id={`battle-${g.id}`} key={g.id}>
        <summary><span><strong>{g.playerA.name} vs {g.playerB.name}</strong><small>{locationName(g.location)} · {g.date}</small></span><span className="aurora-battle-score">{g.opA}–{g.opB}<small>OP</small></span></summary>
        <div className="aurora-battle-details"><p>{factionName(g.playerA.faction)} vs {factionName(g.playerB.faction)} · {g.mission}</p><p><strong>{g.opA}–{g.opB} OP · {g.tpA}–{g.tpB} TP</strong></p>
        <Link to={`/campaign/aurora-vii/${g.location === 'narrative' ? 'missions' : `territories/${g.location}`}`}>View Campaign Location →</Link>
        <p><Link to={`/campaign/aurora-vii/games?game=${g.id}`}>Players: review or request a correction →</Link></p></div>
      </details>)}</div></> : <p className="aurora-results-empty">{state.turn ? 'Play a game, record both scores, and confirm the result. Your campaign’s battle history and totals will appear here.' : 'Confirmed games and standings will appear here when the campaign begins.'}</p>}
    </> : null}
    {games.length ? <p className="aurora-muted">Live TP/OP progress · Campaign VP and control are resolved by Lobo. Narrative totals stay separate.</p> : null}
    <details className="aurora-info-section"><summary>Results information & refresh</summary><p>Only confirmed or commissioner-approved results count. Late and possible duplicate games also need Lobo’s approval.</p>{live.updated ? <p>Checked at {live.updated} · Refreshes every minute.</p> : null}<button type="button" onClick={live.reload}>Refresh live results</button></details>
    {state.totals.length ? <details><summary>GM-published results reference</summary><p>This is a separately published checkpoint, not additional games. It is not added to the live totals above.</p><ul>{state.totals.map(r => <li key={`${r.location}:${r.faction}`}>{locationName(r.location)} · {r.faction}: {r.tp} TP · {r.op} OP</li>)}</ul></details> : null}
  </section>
}
