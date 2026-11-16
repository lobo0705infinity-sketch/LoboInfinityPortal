import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AURORA_TERRITORIES } from '../../shared/aurora-public.mjs'

type ObjectiveOffer = { options: Array<{ title: string; requirement: string }>; defaultIndex: number; selectedIndex: number | null; deadline: string }
type Decisions = { revision: number; faction: string; canChoose: boolean; nomination: { turn: number; deadline: string; eligible: string[] } | null; turn: { turn: number; deadline: string; objectives: ObjectiveOffer | null; ownerEligible: string[]; ownerSelected: string[] | null; ownerLocked: boolean } | null; objectives: Array<{ id: string; title: string; requirement: string; assignedTurn: number; status: string }>; nominationHistory: Array<{ turn: number; territory: string }> }
const name = (id: string) => AURORA_TERRITORIES.find(t => t.id === id)?.name || id
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'long' })
export default function AuroraFactionDecisions() {
  const [data, setData] = useState<Decisions | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [login, setLogin] = useState(false), [refresh, setRefresh] = useState(0), [message, setMessage] = useState('')
  useEffect(() => {
    const abort = new AbortController()
    fetch('/api/aurora-games?action=decisions', { credentials: 'same-origin', cache: 'no-store', signal: abort.signal }).then(async r => { const value = await r.json(); if (!r.ok) { setLogin(r.status === 401); throw Error(value.error) } setLogin(false); setData(value) }).catch(e => { if (!abort.signal.aborted) setError(e.message) })
    return () => abort.abort()
  }, [refresh])
  async function choose(action: string, turn: number, values: Record<string, unknown>) {
    if (!data) return
    setBusy(true); setError(''); setMessage('')
    try {
      const r = await fetch('/api/aurora-games?action=choose', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...values, action, turn, revision: data.revision }) })
      const result = await r.json(); if (!r.ok) throw Error(result.error)
      setData(result); setMessage('Your faction’s choice is recorded.')
    } catch (e) { setError((e as Error).message); setRefresh(n => n + 1) } finally { setBusy(false) }
  }
  async function signIn() {
    setBusy(true)
    try { const r = await fetch('/api/aurora-signup?action=login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnPath: '/campaign/aurora-vii/decisions' }) }); const v = await r.json(); if (!r.ok) throw Error(v.error); window.location.assign(v.authorizeUrl) }
    catch (e) { setError((e as Error).message); setBusy(false) }
  }
  const locked = busy || !data?.canChoose
  return <section className="panel aurora-panel aurora-private-decisions"><p className="eyebrow">Private faction planning</p><h2>{data ? `${data.faction} decisions` : 'Faction decisions'}</h2><p>Only your faction’s choices appear here. Your registered Commander or deputy submits the final selection. All selections lock before the global opening of games.</p>
    <button type="button" disabled={busy} onClick={() => { setError(''); setRefresh(n => n + 1) }}>Refresh decisions</button>
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {login ? <><button className="aurora-primary" type="button" disabled={busy} onClick={() => void signIn()}>Verify my Discord account</button><p>Use your registered account. <Link to="/campaign/aurora-vii/register">Campaign registration →</Link></p></> : null}
    {data ? <>
      {!data.canChoose ? <p>You can review your faction’s information. Ask its Commander or deputy to submit choices.</p> : null}
      {data.nomination ? <form onSubmit={e => { e.preventDefault(); void choose('nominate', data.nomination!.turn, { territory: new FormData(e.currentTarget).get('territory') }) }}><fieldset disabled={locked}><legend>Nominate a vulnerable territory · Turn {data.nomination.turn}</legend><p>Respond by {date(data.nomination.deadline)}. Existing required or excluded reward selections have priority. Every faction can compete at your nominated territory.</p><label>Territory<select name="territory" required>{data.nomination.eligible.map(id => <option value={id} key={id}>{name(id)}</option>)}</select></label><button className="aurora-primary" type="submit">Submit nomination</button></fieldset></form> : <p>No nomination is currently awaiting your faction.</p>}
      {data.turn ? <div key={`${data.turn.turn}:${data.revision}`}><h3>Turn {data.turn.turn} preparation</h3><p>Selection deadline: {date(data.turn.deadline)}</p>
        {data.turn.objectives ? <form onSubmit={e => { e.preventDefault(); void choose('select-objective', data.turn!.turn, { index: Number(new FormData(e.currentTarget).get('index')) }) }}><fieldset disabled={locked || data.turn.objectives.selectedIndex !== null}><legend>Choose one Secret Objective</legend>{data.turn.objectives.options.map((o, index) => <label className="aurora-objective-option" key={o.title}><input type="radio" name="index" value={index} required defaultChecked={index === (data.turn!.objectives!.selectedIndex ?? data.turn!.objectives!.defaultIndex)}/><strong>{o.title}{index === data.turn!.objectives!.defaultIndex ? ' · deadline default' : ''}</strong><span>{o.requirement}</span></label>)}<p>Only the selected objective is active. If no choice arrives by the deadline, the marked default is assigned when the GM locks preparation. The reward remains 2 VP, within the six-VP campaign cap.</p><button className="aurora-primary" type="submit">Choose objective</button></fieldset></form> : <p>No objective choice is awaiting your faction. Normal assignments appear below.</p>}
        {data.turn.ownerEligible.length > 2 ? <form onSubmit={e => { e.preventDefault(); void choose('select-owner-advantages', data.turn!.turn, { territories: new FormData(e.currentTarget).getAll('territories') }) }}><fieldset disabled={locked || data.turn.ownerLocked}><legend>Activate up to two owner advantages</legend>{data.turn.ownerEligible.map(id => <label key={id}><input name="territories" type="checkbox" value={id} defaultChecked={data.turn!.ownerSelected?.includes(id)}/>{name(id)}</label>)}<p>General battlefield rules remain active everywhere. If you miss the deadline, the two highest-value eligible territories are selected; alphabetical order breaks ties.</p><button className="aurora-primary" type="submit">Save owner advantages</button></fieldset></form> : <p>{data.turn.ownerEligible.length ? `Owner advantages apply automatically in ${data.turn.ownerEligible.map(name).join(' and ')}.` : 'Your faction owns no vulnerable territory this Turn.'}</p>}
      </div> : <p>No open Turn 3+ selection window. The GM will publish the preparation deadline before games.</p>}
      <h3>Objective assignment history</h3>{data.objectives.length ? data.objectives.map(o => <article key={o.id}><h4>Turn {o.assignedTurn} · {o.title} · {o.status}</h4><p>{o.requirement}</p></article>) : <p>No assignments recorded.</p>}
      <h3>Your nomination history</h3>{data.nominationHistory.length ? data.nominationHistory.map(n => <p key={n.turn}>Turn {n.turn} · {name(n.territory)}</p>) : <p>No nominations used.</p>}
    </> : !login && !error ? <p>Loading your private faction decisions…</p> : null}
  </section>
}
