import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AURORA_CONQUEST_FACTIONS, AURORA_FACTIONS, AURORA_TERRITORIES } from '../../shared/aurora-public.mjs'
import { validateAuroraPublicState } from '../../shared/aurora-public-state.mjs'
import { getActiveNativeSessionToken } from '../services/apiCore'
import { useSnapshotData } from '../public/useSnapshotData'
import type { PublicEvent } from '../public/snapshotTypes'
import { useAuroraPublication } from './useAuroraPublication'
import type { AuroraPublicState } from './auroraTypes'
import AuroraGames from './AuroraGames'
import AuroraOperations from './AuroraOperations'
import './AuroraCampaign.css'

export default function AuroraPublisher() {
  const { publication, error, reload } = useAuroraPublication()
  const events = useSnapshotData<PublicEvent[]>('events')
  const [draft, setDraft] = useState<AuroraPublicState | null>(null)
  const [chapter, setChapter] = useState({ title: '', body: '' })
  const [approved, setApproved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!publication) return
    setDraft(structuredClone(publication.state))
    const current = publication.state.story.find(item => item.turn === publication.state.turn)
    setChapter({ title: current?.title || '', body: current?.body || '' })
    setApproved(false)
  }, [publication])

  function update(values: Partial<AuroraPublicState>) { setDraft(previous => previous ? { ...previous, ...values } : previous); setApproved(false) }
  function loadOutcome(turn: number, outcome: Pick<AuroraPublicState, 'territories' | 'standings'>) {
    if (!draft || draft.turn !== turn) { setMessage(`Select Turn ${turn} in the public bulletin before loading its outcome.`); return }
    update({ territories: outcome.territories, standings: outcome.standings })
    setMessage('Resolved ownership and Campaign VP are loaded into the public draft. Review the bulletin and approve publication below.')
  }
  async function publish() {
    if (!draft || !publication || !approved || saving) return
    setMessage('')
    try {
      const story = draft.story.filter(item => item.turn !== draft.turn)
      if (chapter.title.trim() || chapter.body.trim()) story.push({ turn: draft.turn, ...chapter })
      const candidate = { ...draft, story,
        campaignEvent: draft.campaignEvent && Object.values(draft.campaignEvent).some(Boolean) ? draft.campaignEvent : null,
        narrativeMission: draft.narrativeMission && Object.values(draft.narrativeMission).some(Boolean) ? draft.narrativeMission : null,
      }
      const state = validateAuroraPublicState(candidate)
      setSaving(true)
      const response = await fetch('/api/aurora-campaign', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${getActiveNativeSessionToken()}` }, body: JSON.stringify({ expectedRevision: publication.revision, state }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Campaign publication failed.')
      setMessage('The approved public campaign state is now published.')
      reload()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Campaign publication failed.') }
    finally { setSaving(false) }
  }

  if (!draft) return <main className="portal-shell aurora-campaign"><header className="page-header"><h1>Aurora VII publication</h1></header><p>{error || 'Loading the current public campaign state…'}</p>{error ? <button type="button" onClick={reload}>Try again</button> : null}</main>
  return <main className="portal-shell aurora-campaign"><header className="page-header"><p className="eyebrow">Commissioner · Campaign operations & public bulletin</p><h1>Aurora VII administration</h1><p>Record private Discord decisions, review scoring and resolve the Turn in campaign operations. Load the approved public outcome into the bulletin before publishing.</p><Link to="/campaign/aurora-vii" target="_blank">Open the public campaign →</Link><p><Link to="/commissioner/aurora-vii/registration">Open campaign registration form →</Link></p><p><Link to="/commissioner/aurora-vii/reporting-test">Test reporting & opponent confirmation →</Link></p></header>
    <div className="aurora-notice"><p>Campaign operations and game claims remain private. Every field in the public bulletin form becomes public. Keep private decisions, evidence, faction briefings and future releases out of those bulletin fields.</p></div>
    {error ? <div role="alert"><p>{error} Your draft has not been published.</p><button type="button" onClick={reload}>Reload public state</button></div> : null}
    <AuroraOperations state={publication!.state} onLoadOutcome={loadOutcome}/>
    <AuroraGames admin/>
    <form className="aurora-admin-form" onSubmit={event => { event.preventDefault(); void publish() }}>
      <section className="panel aurora-panel"><h2>Current Turn & reporting</h2><div className="aurora-admin-columns"><label>Campaign Turn<select value={draft.turn} onChange={event => { const turn = Number(event.target.value); update({ turn }); const entry = draft.story.find(item => item.turn === turn); setChapter({ title: entry?.title || '', body: entry?.body || '' }) }}><option value={0}>Before campaign start</option>{[1, 2, 3, 4, 5, 6].map(turn => <option value={turn} key={turn}>Turn {turn}</option>)}</select></label><label>Turn deadline (include timezone)<input value={draft.deadline} placeholder="2026-11-15T23:59:00-05:00" onChange={event => update({ deadline: event.target.value })}/></label><label>Campaign event<select value={draft.eventId} onChange={event => update({ eventId: event.target.value })}><option value="">Not linked yet</option>{(events.data ?? []).filter(event => /narrative campaign/i.test(event.type)).map(event => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label><label>Public campaign reporting form<input type="url" value={draft.reportUrl} placeholder="https://…" onChange={event => update({ reportUrl: event.target.value })}/></label></div><p>Confirmed Aurora VII games appear automatically in campaign battle history and live totals. Linking an event is optional context; it is not required for campaign reporting.</p></section>
      <section className="panel aurora-panel"><h2>Public territory state</h2><p>{draft.territories.filter(item => item.vulnerable).length} of 4 Vulnerable Territories selected. Select none before campaign start.</p>{AURORA_TERRITORIES.map(territory => { const item = draft.territories.find(value => value.id === territory.id)!; const change = (values: Partial<typeof item>) => update({ territories: draft.territories.map(current => current.id === item.id ? { ...current, ...values } : current) }); return <div className="aurora-admin-territory" key={territory.id}><h3>{territory.name} · {territory.vp} VP</h3><label>Published controller<select value={item.controller} onChange={event => change({ controller: event.target.value })}><option value="">Not announced</option>{AURORA_CONQUEST_FACTIONS.map(faction => <option key={faction}>{faction}</option>)}</select></label><div className="aurora-admin-checks"><label><input type="checkbox" checked={item.vulnerable} onChange={event => change({ vulnerable: event.target.checked })}/>Vulnerable this Turn</label><label><input type="checkbox" checked={item.ruin} onChange={event => change({ ruin: event.target.checked })}/>Publicly revealed Ruin</label><label><input type="checkbox" checked={item.infiltrated} onChange={event => change({ infiltrated: event.target.checked })}/>Published CA foothold</label></div></div> })}</section>
      <section className="panel aurora-panel"><h2>Current Campaign Event</h2><label>Announced Event title<input value={draft.campaignEvent?.title || ''} onChange={event => update({ campaignEvent: { title: event.target.value, rules: draft.campaignEvent?.rules || '' } })}/></label><label>Complete player-facing battlefield rules<textarea value={draft.campaignEvent?.rules || ''} onChange={event => update({ campaignEvent: { title: draft.campaignEvent?.title || '', rules: event.target.value } })}/></label></section>
      <section className="panel aurora-panel"><h2>Current Narrative Mission</h2>{([['title', 'Announced mission title'], ['briefing', 'Current player-facing briefing'], ['reward', 'Announced reward'], ['sheetUrl', 'Public current mission sheet link']] as const).map(([field, label]) => { const value = draft.narrativeMission?.[field] || ''; const change = (text: string) => update({ narrativeMission: { title: '', briefing: '', reward: '', sheetUrl: '', ...draft.narrativeMission, [field]: text } }); return <label key={field}>{label}{field === 'briefing' || field === 'reward' ? <textarea value={value} onChange={event => change(event.target.value)}/> : <input type={field === 'sheetUrl' ? 'url' : 'text'} value={value} onChange={event => change(event.target.value)}/>}</label> })}</section>
      <section className="panel aurora-panel"><h2>Published Campaign VP</h2><p>Load the resolved ledger totals from campaign operations. Record any explained VP amendment in the private ledger, then load the public outcome again.</p><div className="aurora-admin-columns">{AURORA_FACTIONS.map(faction => <label key={faction}>{faction}<input type="number" min="0" max="1000" step="1" readOnly value={draft.standings.find(item => item.faction === faction)?.vp ?? ''}/></label>)}</div></section>
      <section className="panel aurora-panel"><h2>Public Turn TP / OP totals</h2><p>Keep Narrative Mission totals separate from the four Vulnerable Territories. These figures are displayed without deciding control or rewards.</p><div className="aurora-admin-totals">{draft.totals.map((item, index) => { const change = (values: Partial<typeof item>) => update({ totals: draft.totals.map((current, position) => position === index ? { ...current, ...values } : current) }); return <div className="aurora-admin-total-row" key={index}><label>Location<select value={item.location} onChange={event => change({ location: event.target.value })}><option value="narrative">Narrative Mission</option>{draft.territories.filter(item => item.vulnerable).map(item => <option value={item.id} key={item.id}>{AURORA_TERRITORIES.find(territory => territory.id === item.id)!.name}</option>)}</select></label><label>Faction<select value={item.faction} onChange={event => change({ faction: event.target.value })}>{AURORA_FACTIONS.map(faction => <option key={faction}>{faction}</option>)}</select></label><label>TP<input type="number" min="0" step="1" value={item.tp} onChange={event => change({ tp: Number(event.target.value) })}/></label><label>OP<input type="number" min="0" step="1" value={item.op} onChange={event => change({ op: Number(event.target.value) })}/></label><button type="button" aria-label={`Remove total row ${index + 1}`} onClick={() => update({ totals: draft.totals.filter((_, position) => position !== index) })}>Remove</button></div> })}<button type="button" onClick={() => update({ totals: [...draft.totals, { location: 'narrative', faction: AURORA_FACTIONS[0], tp: 0, op: 0 }] })}>Add public total</button></div></section>
      <section className="panel aurora-panel"><h2>{draft.turn ? `Turn ${draft.turn}` : 'Campaign opening'} story release</h2><p>Enter only this Turn’s released player-facing chapter. Previous published chapters are retained.</p><label>Chapter title<input value={chapter.title} onChange={event => { setChapter(previous => ({ ...previous, title: event.target.value })); setApproved(false) }}/></label><label>Released story<textarea value={chapter.body} onChange={event => { setChapter(previous => ({ ...previous, body: event.target.value })); setApproved(false) }}/></label></section>
      <section className="panel aurora-panel"><h2>Publish the public bulletin</h2><div className="aurora-admin-checks"><label><input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)}/>I confirm all content here is approved for players, contains no private choices or future releases, and reflects the reviewed campaign results.</label></div><p role="status">{message}</p><button className="aurora-primary" disabled={!approved || saving || Boolean(error)} type="submit">{saving ? 'Publishing…' : 'Publish approved public state'}</button></section>
    </form>
  </main>
}
