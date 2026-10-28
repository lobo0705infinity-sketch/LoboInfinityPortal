import { useEffect, useState, type ReactNode } from 'react'
import { AURORA_FACTIONS, AURORA_TERRITORIES } from '../../shared/aurora-public.mjs'
import { factionName } from '../../shared/aurora-games.mjs'
import { getActiveNativeSessionToken } from '../services/apiCore'
import type { AuroraPublicState } from './auroraTypes'

type Player = { id: string; name: string; faction: string }
type Receipt = { sender: string; messageUrl: string; note: string }
type Offer = Receipt & { id: string; employer: string; location: string; bid: number }
type PublicOutcome = Pick<AuroraPublicState, 'territories' | 'standings'>
type Preview = {
  turn: number; previewHash: string; territories: AuroraPublicState['territories'];
  control: Array<{ location: string; before: string; after: string; reason: string; rows: Array<{ faction: string; earnedTP: number; op: number; tohaa: number; na2: number; influence: number }> }>;
  hiddenHand: { support: number; success: boolean } | null;
  infiltration: { comparisonTP: number; op: number; success: boolean } | null;
  contract: { earnedTP: number; support: number; threshold: number; success: boolean; insured: boolean } | null;
  narrativeWinner: string; narrative: Array<{ faction: string; tp: number; op: number }>;
  doctrines: Array<{ faction: string; name: string; requirement: string; canAward: boolean; scored: number }>;
  awards: Array<{ faction: string; vp: number; reason: string }>;
  unresolved: Array<{ id: string; status: string }>;
}
type Turn = {
  phase: 'choices' | 'open' | 'closed' | 'resolved'; start: AuroraPublicState;
  startCredits: Record<string, number>; offers: Offer[]; accepted: string;
  tohaa: (Receipt & { location: string; beneficiary: string; outcome: string }) | null;
  ca: (Receipt & { location: string }) | null;
  waived?: string[]; service: (Receipt & { kind: string; cost: number; location: string }) | null;
  dossier?: { location: string; tohaa: boolean; ca: boolean };
  narrativeBonuses: Array<{ faction: string; tp: number; source: string }>;
  resolution?: Preview & { at: string; publicPatch: PublicOutcome };
}
type Ops = {
  revision: number; commanders: Record<string, { commander: string; deputy: string }>;
  turns: Record<string, Turn>; credits: Record<string, number>; vp: Record<string, number>;
  awards: Array<{ id: string; turn: number; faction: string; vp: number; category: string; reason: string; at: string }>;
  objectives: Array<{ id: string; faction: string; title: string; requirement: string; assignedTurn: number; status: string; reason?: string; evidence?: string }>;
  journal: Array<{ id: string; at: string; turn: number; action: string; reason: string }>;
  preview: Preview | null;
}
type Values = Record<string, string | number | boolean | string[]>
type Mutate = (action: string, values: Values) => Promise<boolean>
const locationName = (id: string) => AURORA_TERRITORIES.find(t => t.id === id)?.name || id
const phases = { choices: 'Collecting private decisions', open: 'Games open · choices locked', closed: 'Reporting closed · review results', resolved: 'Resolved · records locked' }
async function request(action: string, signal?: AbortSignal, body?: unknown) {
  const response = await fetch(`/api/aurora-games?action=${action}`, {
    method: body ? 'POST' : 'GET', cache: 'no-store', signal, credentials: 'same-origin',
    headers: { authorization: `Bearer ${getActiveNativeSessionToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const value = await response.json()
  if (!response.ok) throw Error(value.error || 'Campaign operations are unavailable.')
  return value
}
export default function AuroraOperations({ state, onLoadOutcome }: { state: AuroraPublicState; onLoadOutcome: (turn: number, outcome: PublicOutcome) => void }) {
  const [ops, setOps] = useState<Ops | null>(null), [players, setPlayers] = useState<Player[]>([])
  const [turnNumber, setTurnNumber] = useState(state.turn), [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    request('operations', controller.signal).then(v => { setOps(v.operations); setPlayers(v.players); setError('') }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [refresh])
  async function mutate(action: string, values: Values) {
    if (!ops || busy) return false
    setBusy(true); setError(''); setMessage('')
    try {
      const value = await request('operate', undefined, { ...values, action, turn: turnNumber, revision: ops.revision })
      setOps(value.operations); setMessage('Saved to the private campaign ledger.'); return true
    } catch (e) { setError((e as Error).message); return false }
    finally { setBusy(false) }
  }
  const turn = ops?.turns[turnNumber], locked = turn?.phase !== 'choices'
  const preview = turn?.resolution || (ops?.preview?.turn === turnNumber ? ops.preview : null)
  const playerName = (id: string) => players.find(p => p.id === id)?.name || id || 'Unassigned'
  return <section id="campaign-operations" className="panel aurora-panel aurora-operations">
    <p className="eyebrow">Commissioner only · private records</p><h2>Campaign operations</h2>
    <p>Commanders and deputies DM secret decisions directly to Lobo in Discord. Record them here with the sender and an optional message link. Only the resolved public outcome is copied into the bulletin.</p>
    <button type="button" disabled={busy} onClick={() => setRefresh(n => n + 1)}>Reload private ledger</button>
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {!ops ? <p>Loading commissioner records…</p> : <>
      <label>Operations Turn<select aria-label="Operations Turn" value={turnNumber} onChange={e => setTurnNumber(Number(e.target.value))}><option value={0}>Before campaign start</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n} disabled={n !== state.turn && !ops.turns[n]}>Turn {n}</option>)}</select></label>
      <p><strong>{turn ? phases[turn.phase] : turnNumber ? 'Turn not prepared' : 'Register representatives before Turn 1'}</strong></p>
      <details><summary>Commanders & deputies</summary>
        <div className="table-wrapper"><table><thead><tr><th>Faction</th><th>Commander</th><th>Deputy</th></tr></thead><tbody>{AURORA_FACTIONS.map(f => <tr key={f}><td>{f}</td><td>{playerName(ops.commanders[f]?.commander)}</td><td>{playerName(ops.commanders[f]?.deputy)}</td></tr>)}</tbody></table></div>
        <RepresentativeForm players={players} busy={busy} mutate={mutate}/>
        <OperationForm title="Clear faction representatives" action="clear-representatives" disabled={busy} mutate={mutate}><FactionField/></OperationForm>
      </details>
      <details><summary>Campaign VP & private Credits</summary>
        <div className="table-wrapper"><table><thead><tr><th>Faction</th><th>Campaign VP</th><th>Available Credits</th><th>Reserved</th></tr></thead><tbody>{AURORA_FACTIONS.map(f => { const reserved = turn && turn.phase !== 'resolved' ? turn.offers.find(o => o.id === turn.accepted && o.employer === f)?.bid || 0 : 0; return <tr key={f}><td>{f}</td><td>{ops.vp[f]}</td><td>{ops.credits[f]}</td><td>{reserved}</td></tr> })}</tbody></table></div>
        <p>Credits stay private and have no final VP value. Contract income is available for spending from the next Turn.</p>
      </details>
      {!turn && turnNumber === state.turn && state.turn > 0 ? <OperationForm title="Prepare announced Turn" action="prepare" mutate={mutate} disabled={busy}><p>Save the announced territory state, starting VP, deadline and treasury balances before collecting choices. Previous Turns must be resolved first.</p></OperationForm> : null}
      {turn ? <div key={`${turnNumber}:${ops.revision}`}>
        <details open={turn.phase === 'choices'}><summary>Private faction decisions</summary>
          <p>Selections and accepted contracts lock before games. An employer’s offer commits its specialist selection. Accepted contracts and purchases cannot be changed.</p>
          {turn.tohaa ? <p><strong>Tohaa:</strong> {locationName(turn.tohaa.location)} · {turn.tohaa.beneficiary} · {turn.tohaa.outcome} · from {playerName(turn.tohaa.sender)}</p> : <p>Tohaa: {turn.waived?.includes('Tohaa') ? 'No selection · commissioner waiver' : 'Awaiting DM'}</p>}
          {turn.ca ? <p><strong>Combined Army:</strong> {locationName(turn.ca.location)} · from {playerName(turn.ca.sender)}</p> : <p>Combined Army: {turn.waived?.includes('Combined Army') ? 'No selection · commissioner waiver' : 'Awaiting DM'}</p>}
          <PrivateDecisionForm kind="hidden-hand" turn={turn} ops={ops} players={players} disabled={busy || locked} mutate={mutate}/>
          <PrivateDecisionForm kind="infiltration" turn={turn} ops={ops} players={players} disabled={busy || locked} mutate={mutate}/>
          <OperationForm title="Record no specialist selection" action="waive-selection" disabled={busy || locked} mutate={mutate}><label>Faction<select aria-label="Faction" name="faction"><option>Tohaa</option><option>Combined Army</option></select></label><p>Use only when a faction has no active representative or declined to submit a selection. The required explanation records your ruling.</p></OperationForm>
          <PrivateDecisionForm kind="offer" turn={turn} ops={ops} players={players} disabled={busy || locked} mutate={mutate}/>
          <h4>Offers</h4>{turn.offers.length ? turn.offers.map(o => <article key={o.id} className="aurora-game-review"><p>{o.employer} · {locationName(o.location)} · {o.bid} Credits · {o.id === turn.accepted ? 'Accepted · payment reserved' : 'Not accepted'}</p>{o.messageUrl ? <a href={o.messageUrl} target="_blank" rel="noopener noreferrer">Open private Discord message ↗</a> : null}{o.id !== turn.accepted && !locked ? <>
            <OperationForm title={`Record NA2 acceptance of ${o.employer} offer`} action="accept" values={{ id: o.id }} mutate={mutate} disabled={busy || Boolean(turn.accepted)}><Sender faction="NA2" ops={ops} players={players}/></OperationForm>
            <OperationForm title={`Withdraw ${o.employer} offer`} action="withdraw-offer" values={{ id: o.id }} mutate={mutate} disabled={busy}/>
          </> : null}</article>) : <p>No offers recorded. NA2 may decline all offers.</p>}
          {turn.service ? <p><strong>NA2 service:</strong> {turn.service.kind} · {turn.service.cost} Credits {turn.service.location ? `· ${locationName(turn.service.location)}` : ''}</p> : null}
          <PrivateDecisionForm kind="service" turn={turn} ops={ops} players={players} disabled={busy || locked || Boolean(turn.service)} mutate={mutate}/>
          {turn.dossier ? <p>Private Dossier for NA2 · {locationName(turn.dossier.location)}: Tohaa target {turn.dossier.tohaa ? 'yes' : 'no'}; CA target {turn.dossier.ca ? 'yes' : 'no'}. Share only these flags by DM; no beneficiary or desired outcome.</p> : null}
        </details>
        <details><summary>Secret Objectives & other awards</summary>
          <p>Record assignments privately. Each completed objective awards 2 VP, from Turn 2 onward, up to 6 VP per faction. Review evidence after closing reporting. Portal claims remain available in the game review panel below; direct DMs are also accepted.</p>
          <OperationForm title="Assign Secret Objective" action="assign-objective" mutate={mutate} disabled={busy || turn.phase === 'resolved' || turnNumber < 2}><FactionField/><label>Objective title<input name="title" required maxLength={200}/></label><label>Completion requirement<textarea name="requirement" required maxLength={4000}/></label></OperationForm>
          {ops.objectives.map(o => <article key={o.id} className="aurora-game-review"><h4>{o.faction} · {o.title}</h4><p>{o.requirement}</p><p>Assigned Turn {o.assignedTurn} · {o.status}</p>{o.reason ? <p>{o.reason}</p> : null}{o.status === 'assigned' && o.assignedTurn <= turnNumber ? <OperationForm title={`Review ${o.title}`} action="objective" values={{ id: o.id }} mutate={mutate} disabled={busy || turn.phase !== 'closed'}><label>Decision<select aria-label="Decision" name="approve"><option value="true">Approve · award 2 VP</option><option value="false">Reject</option></select></label><label>Private evidence / DM reference<textarea name="evidence" required maxLength={4000}/></label><label>Approved portal claim ID (optional)<input name="claimId" maxLength={80}/></label></OperationForm> : null}</article>)}
          <OperationForm title="Record Narrative TP reward" action="narrative-bonus" mutate={mutate} disabled={busy || locked}><FactionField/><label>Unique reward reference<input name="source" required maxLength={200}/></label><label>Narrative TP<input name="tp" type="number" min={1} max={10} required/></label><p>Use for an earned narrative reward expended before games. It never changes territorial totals.</p></OperationForm>
          {turn.narrativeBonuses.map(b => <p key={b.source}>{b.faction} · +{b.tp} Narrative TP · {b.source}</p>)}
          <OperationForm title="Record explained VP adjustment" action="adjustment" mutate={mutate} disabled={busy || !['closed', 'resolved'].includes(turn.phase)}><FactionField/><label>VP change<input name="vp" type="number" min={-100} max={100} required/></label><p>Use for a documented GM ruling or correction. This creates a permanent ledger entry; it does not replace Doctrine or Secret Objective approval.</p></OperationForm>
        </details>
        <h3>Turn control</h3>
        {turn.phase === 'choices' ? <OperationForm title="Lock decisions & open games" action="begin" disabled={busy} mutate={mutate}><p>Confirm all DMs have been recorded and NA2’s acceptance or decline and any purchase are final. Choices cannot change after this step.</p></OperationForm> : null}
        {turn.phase === 'open' ? <OperationForm title="Close campaign reporting" action="close" disabled={busy} mutate={mutate}><p>Stops new reports. Existing records can still be confirmed, corrected or rejected before resolution.</p></OperationForm> : null}
        {turn.phase === 'closed' ? <OperationForm title="Reopen reporting" action="reopen" disabled={busy} mutate={mutate}/> : null}
        {preview ? <ResolutionReview preview={preview} turn={turn} mutate={mutate} disabled={busy} onLoadOutcome={onLoadOutcome}/> : null}
      </div> : null}
      <details><summary>VP award ledger · {ops.awards.length} entries</summary><div className="table-wrapper"><table><thead><tr><th>Turn</th><th>Faction</th><th>VP</th><th>Reason</th><th>Recorded</th></tr></thead><tbody>{ops.awards.map(a => <tr key={a.id}><td>{a.turn}</td><td>{a.faction}</td><td>{a.vp > 0 ? '+' : ''}{a.vp}</td><td>{a.reason}</td><td>{new Date(a.at).toLocaleString()}</td></tr>)}</tbody></table></div></details>
      <details><summary>Private decision history · {ops.journal.length} entries</summary>{ops.journal.toReversed().map(j => <p key={j.id}>{new Date(j.at).toLocaleString()} · Turn {j.turn} · {j.action} · {j.reason}</p>)}</details>
    </>}
  </section>
}
function OperationForm({ title, action, values = {}, disabled, children, mutate }: { title: string; action: string; values?: Values; disabled: boolean; children?: ReactNode; mutate: Mutate }) {
  return <form className="aurora-operation-form" onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget, data = new FormData(form), body: Values = { ...values }
    for (const [key, value] of data.entries()) body[key] = String(value)
    for (const key of ['bid', 'tp', 'vp']) if (key in body) body[key] = Number(body[key])
    if ('approve' in body) body.approve = body.approve === 'true'
    if (action === 'resolve') body.doctrines = data.getAll('doctrines').map(String)
    if (await mutate(action, body)) form.reset()
  }}><fieldset disabled={disabled}><legend>{title}</legend>{children}<label>Commissioner explanation<textarea name="reason" required maxLength={2000}/></label><button className="aurora-primary" type="submit">{title}</button></fieldset></form>
}
function FactionField({ name = 'faction', choices = AURORA_FACTIONS }: { name?: string; choices?: readonly string[] }) { return <label>Faction<select aria-label="Faction" name={name}>{choices.map(f => <option key={f}>{f}</option>)}</select></label> }
function Sender({ faction, ops, players }: { faction: string; ops: Ops; players: Player[] }) {
  const reps = ops.commanders[faction], ids = [reps?.commander, reps?.deputy].filter(Boolean)
  return <><label>DM sender<select aria-label="DM sender" name="sender" required><option value="">Choose recorded representative</option>{ids.map(id => <option key={id} value={id}>{players.find(p => p.id === id)?.name || id}</option>)}</select></label>{!ids.length ? <p>Record this faction’s Commander or deputy first.</p> : null}<label>Discord message link (optional)<input name="messageUrl" type="url" maxLength={300}/></label><label>Private note (optional)<textarea name="note" maxLength={2000}/></label></>
}
function RepresentativeForm({ players, busy, mutate }: { players: Player[]; busy: boolean; mutate: Mutate }) {
  const [faction, setFaction] = useState<string>(AURORA_FACTIONS[0]), roster = players.filter(p => factionName(p.faction) === faction)
  return <OperationForm title="Save faction representatives" action="representatives" disabled={busy} mutate={mutate} values={{ faction }}><label>Faction<select aria-label="Faction" value={faction} onChange={e => setFaction(e.target.value)}>{AURORA_FACTIONS.map(f => <option key={f}>{f}</option>)}</select></label><div key={faction}><label>Commander<select aria-label="Commander" name="commander" required><option value="">Choose registered player</option>{roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Deputy<select aria-label="Deputy" name="deputy"><option value="">Not assigned</option>{roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div></OperationForm>
}
function PrivateDecisionForm({ kind, turn, ops, players, disabled, mutate }: { kind: string; turn: Turn; ops: Ops; players: Player[]; disabled: boolean; mutate: Mutate }) {
  const [employer, setEmployer] = useState<string>(AURORA_FACTIONS[0])
  const titles: Record<string, string> = { 'hidden-hand': 'Record Hidden Hand DM', infiltration: 'Record Infiltration DM', offer: 'Record employer offer DM', service: 'Record NA2 service DM' }
  const faction = kind === 'hidden-hand' ? 'Tohaa' : kind === 'infiltration' ? 'Combined Army' : kind === 'service' ? 'NA2' : employer
  return <OperationForm title={titles[kind]} action={kind} values={{ faction }} disabled={disabled} mutate={mutate}>
    {kind === 'offer' ? <label>Employer<select aria-label="Employer" value={employer} onChange={e => setEmployer(e.target.value)}>{AURORA_FACTIONS.filter(f => f !== 'NA2').map(f => <option key={f}>{f}</option>)}</select></label> : null}
    <label>Vulnerable Territory{kind === 'service' ? ' (Dossier only)' : ''}<select aria-label={kind === 'service' ? 'Vulnerable Territory (Dossier only)' : 'Vulnerable Territory'} name="location"><option value="">Choose territory</option>{turn.start.territories.filter(t => t.vulnerable).map(t => <option key={t.id} value={t.id}>{locationName(t.id)}</option>)}</select></label>
    {kind === 'hidden-hand' ? <><FactionField name="beneficiary" choices={AURORA_FACTIONS.slice(0, 8)}/><label>Desired outcome<select aria-label="Desired outcome" name="outcome"><option>INSTALL</option><option>PRESERVE</option></select></label></> : null}
    {kind === 'offer' ? <label>Bid · Credits<input name="bid" type="number" required min={1} max={3}/></label> : null}
    {kind === 'service' ? <label>Service<select aria-label="Service" name="kind"><option value="preparation">Operational Preparation · 2 Credits</option><option value="dossier">Intelligence Dossier · 1 Credit</option><option value="insurance">Failure Insurance · 2 Credits</option><option value="logistics">Independent Logistics · 2 Credits</option></select></label> : null}
    <Sender key={faction} faction={faction} ops={ops} players={players}/>
  </OperationForm>
}
function ResolutionReview({ preview: p, turn, mutate, disabled, onLoadOutcome }: { preview: Preview; turn: Turn; mutate: Mutate; disabled: boolean; onLoadOutcome: (turn: number, outcome: PublicOutcome) => void }) {
  return <div className="aurora-resolution-review"><h3>{turn.resolution ? 'Committed Turn outcome' : 'Resolution preview'}</h3>
    <p>Earned TP → Tohaa and NA2 support → territorial control → Infiltration → specialist outcomes → Narrative reward → approved Doctrines and objectives.</p>
    {p.control.map(c => <details key={c.location}><summary>{locationName(c.location)} · {c.before || 'Uncontrolled'} → {c.after || 'Uncontrolled'}</summary><p>{c.reason}</p><div className="table-wrapper"><table><thead><tr><th>Faction</th><th>Earned TP</th><th>Tohaa</th><th>NA2</th><th>Influence</th><th>OP</th></tr></thead><tbody>{c.rows.map(r => <tr key={r.faction}><td>{r.faction}</td><td>{r.earnedTP}</td><td>{r.tohaa}</td><td>{r.na2}</td><td>{r.influence}</td><td>{r.op}</td></tr>)}</tbody></table></div></details>)}
    <p>Tohaa: {p.hiddenHand ? `${p.hiddenHand.support} support · ${p.hiddenHand.success ? 'success' : 'failed'}` : 'No selection'}</p>
    <p>CA: {p.infiltration ? `${p.infiltration.comparisonTP} comparison TP · ${p.infiltration.op} own OP · ${p.infiltration.success ? 'success' : 'failed'}` : 'No selection'}</p>
    <p>NA2: {p.contract ? `${p.contract.earnedTP} earned TP / ${p.contract.threshold} required · ${p.contract.support} support · ${p.contract.success ? 'success · payment transfers' : p.contract.insured ? 'failed · Insurance awards 1 VP · payment returns' : 'failed · payment returns'}` : 'No accepted contract'}</p>
    <p>Narrative winner: {p.narrativeWinner || 'None / unresolved tie'}</p>
    <details><summary>Narrative TP / OP · separate from territorial Influence</summary>{p.narrative.map(r => <p key={r.faction}>{r.faction}: {r.tp} TP · {r.op} OP</p>)}</details>
    <h4>Resolution awards</h4>{p.awards.length ? p.awards.map((a, i) => <p key={i}>{a.faction} · +{a.vp} VP · {a.reason}</p>) : <p>No automatic VP awards.</p>}
    {p.unresolved.length ? <p role="alert">{p.unresolved.length} pending or disputed game(s) block resolution. Confirm, correct or reject them in game review, then reload this ledger.</p> : null}
    {turn.resolution ? <><p>Committed {new Date(turn.resolution.at).toLocaleString()}. Only ownership, public territory tags, and faction VP totals will be copied.</p><button type="button" disabled={disabled} onClick={() => onLoadOutcome(p.turn, turn.resolution!.publicPatch)}>Load resolved public outcome into bulletin</button></> : <OperationForm title="Commit reviewed Turn resolution" action="resolve" values={{ previewHash: p.previewHash }} disabled={disabled || turn.phase !== 'closed' || Boolean(p.unresolved.length)} mutate={mutate}>
      <h4>Approve eligible Faction Doctrines</h4>{p.doctrines.map(d => <label key={d.faction} className="aurora-doctrine-choice"><input type="checkbox" name="doctrines" value={d.faction} disabled={!d.canAward}/><span>{d.faction} · {d.name} · {d.scored}/3 scored<br/>{d.requirement}{!d.canAward ? ' · Not eligible or limit reached' : ' · Eligible for +1 VP'}</span></label>)}
      <p>Commits control, VP awards and Credit settlement once, and locks this Turn’s game records. Review the public bulletin separately before publishing.</p>
    </OperationForm>}
  </div>
}
