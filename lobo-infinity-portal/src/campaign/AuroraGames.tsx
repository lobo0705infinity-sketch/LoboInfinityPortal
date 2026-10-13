import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AURORA_TERRITORIES, AURORA_TURNS } from '../../shared/aurora-public.mjs'
import { campaignScore, factionName } from '../../shared/aurora-games.mjs'
import { getActiveNativeSessionToken } from '../services/apiCore'
import { useSnapshotData } from '../public/useSnapshotData'
import type { MissionGeistCatalog } from '../services/publicSnapshot'
import { resolveMissionGeistNavigation } from '../config/missionGeistNavigation'
import type { AuroraPublicState } from './auroraTypes'
const ROOT='/campaign/aurora-vii'
type Player={id:string;name:string;faction:string}
type History={at:string;action:string;actor:string;detail:string}
export type CampaignGame={id:string;turn:number;date:string;kind:string;location:string;mission:string;playerA:Player;playerB:Player;opA:number;opB:number;tpA:number;tpB:number;status:string;revision:number;late:boolean;lateApproved:boolean;duplicateOf?:string;duplicateApproved?:boolean;map:string;notes:string;armyA:string;armyB:string;photos:string;notification:string;correction?:{reason:string};history:History[]}
type Claim={id:string;gameId:string;name:string;faction:string;objective:string;explanation:string;status:string;revision:number;history:History[]}
type Data={state:AuroraPublicState;turns:AuroraPublicState[];player:Player|null;players:Player[];games:CampaignGame[];claims:Claim[];totals:AuroraPublicState['totals']}
type Draft={turn:number;opponent:string;date:string;kind:string;location:string;mission:string;opA:number;opB:number;map:string;notes:string;armyA:string;armyB:string;photos:string}
const labels:Record<string,string>={awaiting_confirmation:'Awaiting opponent confirmation',awaiting_late_approval:'Awaiting Lobo’s late approval',awaiting_duplicate_review:'Awaiting Lobo’s duplicate review',correction_requested:'Correction requested',confirmed:'Confirmed',rejected:'Rejected'}
const locationName=(id:string)=>id==='narrative'?'Narrative Mission':AURORA_TERRITORIES.find(t=>t.id===id)?.name||id
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
async function api(action:string,body?:unknown,admin=false){
  const token=admin?getActiveNativeSessionToken():null
  const response=await fetch(`/api/aurora-games?action=${action}`,{method:body?'POST':'GET',credentials:'same-origin',headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})})
  const value=await response.json()
  if(!response.ok)throw Object.assign(Error(value.error||'Could not load campaign games.'),{status:response.status,signedIn:value.signedIn})
  return value
}
export default function AuroraGames({submit=false,admin=false}:{submit?:boolean;admin?:boolean}){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[loginNeeded,setLoginNeeded]=useState(false),[signedIn,setSignedIn]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[refresh,setRefresh]=useState(0)
  const [params]=useSearchParams(),gameId=params.get('game')
  useEffect(()=>{let alive=true;api(admin?'admin':'mine',undefined,admin).then(value=>{if(alive){setData(value);setError('');setLoginNeeded(false)}},(e:Error&{status?:number;signedIn?:boolean})=>{if(alive){setError(e.message);setLoginNeeded(e.status===401);setSignedIn(Boolean(e.signedIn))}});return()=>{alive=false}},[admin,refresh])
  async function login(){setBusy(true);setError('');try{const r=await fetch('/api/aurora-signup?action=login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnPath:`${ROOT}/${submit?'submit':'games'}${gameId?`?game=${gameId}`:''}`})});const v=await r.json();if(!r.ok)throw Error(v.error);window.location.assign(v.authorizeUrl)}catch(e){setError((e as Error).message);setBusy(false)}}
  async function mutate(action:string,body:unknown){setBusy(true);setError('');setMessage('');try{await api(action,body,admin);setRefresh(n=>n+1);setMessage('Saved.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const games=data?.games.slice().reverse().sort((a,b)=>Number(b.id===gameId)-Number(a.id===gameId)||Number(b.status==='awaiting_confirmation'&&b.playerB.id===data.player?.id)-Number(a.status==='awaiting_confirmation'&&a.playerB.id===data.player?.id))||[]
  return <section className="panel aurora-panel aurora-games">
    <h2>{admin?'Commissioner · Campaign games & private claims':submit?'Submit Campaign Game':'My Campaign Games'}</h2>
    <button type="button" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Refresh games</button>
    {error?<p role="alert">{error}</p>:null}{message?<p role="status">{message}</p>:null}
    {loginNeeded?<><button className="aurora-primary" type="button" disabled={busy} onClick={()=>void login()}>{busy?'Opening Discord…':'Verify my Discord account'}</button><p>Use the Discord account registered for Aurora VII.{signedIn?<> This account is not registered. <Link to={`${ROOT}/register`}>Register</Link> or verify your other account.</>:null}</p></>:!data?<p>Loading campaign games…</p>:<>
      {submit&&data.player?<Submission data={data} onSaved={()=>setRefresh(n=>n+1)}/>:null}
      {!submit||admin?<>
        {admin?<CampaignTotalsTable totals={data.totals}/>:null}
        <h3>{admin?'Recorded games':'Your recorded games & confirmations'}</h3>
        {gameId&&!games.some(g=>g.id===gameId)?<p role="alert">This game is unavailable to this account. Only its players and Lobo can review it.</p>:null}
        {!admin&&!games.some(g=>g.playerB.id===data.player?.id&&g.status==='awaiting_confirmation')?<p>No games awaiting your confirmation.</p>:null}
        {games.map(g=><GameReview key={`${g.id}:${g.revision}`} game={g} me={data.player?.id} admin={admin} busy={busy} mutate={mutate}/>)}
        {!games.length?<p>No campaign games recorded yet.</p>:null}
        <h3>{admin?'Private secret-objective claims':'Your private claims'}</h3><p>Visible only to the claimant and Lobo. Approval does not automatically award Campaign VP.</p>
        {data.claims.map(c=><ClaimReview key={`${c.id}:${c.revision}`} claim={c} admin={admin} busy={busy} mutate={mutate}/>)}{!data.claims.length?<p>No private claims.</p>:null}
      </>:null}
    </>}
  </section>
}
function Submission({data,onSaved}:{data:Data;onSaved:()=>void}){
  const [defaultDate]=useState(today),[openedAt]=useState(()=>Date.now()),[turn,setTurn]=useState(data.state.turn),[kind,setKind]=useState('territory'),[mission,setMission]=useState(''),[opA,setOpA]=useState(''),[opB,setOpB]=useState(''),[formValues,setFormValues]=useState<Partial<Draft>>({}),[draft,setDraft]=useState<Draft|null>(null),[saved,setSaved]=useState<CampaignGame|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const state=data.turns.find(t=>t.turn===turn)||data.state,missions=AURORA_TURNS.find(t=>t.turn===turn)?.missions||[],catalog=useSnapshotData<MissionGeistCatalog>('mission-catalog')
  const selectedMission=kind==='narrative'?state.narrativeMission?.title||'':mission
  const refs=resolveMissionGeistNavigation({mission:missions.find(m=>m.name===mission)?.reference||''},catalog.data?.missions||[]).records
  const reference=kind==='narrative'?state.narrativeMission?.sheetUrl:refs.find(r=>{try{const u=new URL(r.canonicalUrl);return u.protocol==='https:'&&u.hostname==='infinitygeist.com'}catch{return false}})?.canonicalUrl
  let score:ReturnType<typeof campaignScore>|null=null
  try{if(opA!==''&&opB!=='')score=campaignScore(Number(opA),Number(opB))}catch{/* Native and server validation cover invalid scores. */}
  async function save(){if(!draft)return;setBusy(true);setError('');try{const v=await api('submit',draft);setSaved(v.game);onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  if(saved)return <div className="aurora-notice"><h3>Game submitted</h3><p>{labels[saved.status]}. {saved.late?'Lobo must authorize this late result before it counts.':'It will count after confirmation.'}</p>{saved.duplicateOf?<p>Possible duplicate: Lobo must verify this is a separate battle before it counts.</p>:null}<p>If the Discord notification cannot reach your opponent, send this link directly.</p><VerificationLink id={saved.id}/><Link to={`${ROOT}/games?game=${saved.id}`}>Open your game →</Link></div>
  if(!state.turn)return <p>Submissions open when Lobo announces the active Campaign Turn and its four Vulnerable Territories.</p>
  if(draft){const opponent=data.players.find(p=>p.id===draft.opponent)!;const scored=campaignScore(draft.opA,draft.opB);return <div className="aurora-game-review"><h3>Review both players’ scores</h3><p>Turn {draft.turn} · {draft.date} · {locationName(draft.kind==='narrative'?'narrative':draft.location)} · {draft.mission}</p><ScoreReview a={data.player!} b={opponent} opA={draft.opA} opB={draft.opB} tpA={scored.tpA} tpB={scored.tpB}/><p>{scored.result}. TP: victory 4, draw 2, defeat 0; +1 for scoring at least 5 OP; +1 for a defeat by no more than 2 OP.</p><p>Map: {draft.map||'Not provided'}</p>{draft.notes?<p>{draft.notes}</p>:null}<p>One submission covers both players. Your opponent confirms or requests a correction. Private objectives are claimed separately.</p>{error?<p role="alert">{error}</p>:null}<button type="button" disabled={busy} onClick={()=>setDraft(null)}>Back to form</button><button type="button" className="aurora-primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Submit for opponent confirmation'}</button></div>}
  return <form className="aurora-admin-form aurora-game-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),text=(key:string)=>String(f.get(key)||'');if(!score||!selectedMission){setError('Choose a mission and enter both scores.');return}const next={turn,kind,mission:selectedMission,opA:Number(opA),opB:Number(opB),opponent:text('opponent'),date:text('date'),location:text('location'),map:text('map'),notes:text('notes'),armyA:text('armyA'),armyB:text('armyB'),photos:text('photos')};setFormValues(next);setDraft(next)}}>
    <div className="aurora-admin-columns">
      <label>Campaign Turn<select aria-label="Campaign Turn" value={turn} onChange={e=>{setTurn(Number(e.target.value));setMission('')}}>{data.turns.map(t=><option key={t.turn} value={t.turn}>Turn {t.turn}{t.turn===data.state.turn?' · Active':' · Late approval required'}</option>)}</select></label>
      <label>Your registered player<input readOnly value={`${data.player!.name} · ${factionName(data.player!.faction)}`}/></label>
      <label>Opponent<select aria-label="Opponent" name="opponent" required defaultValue={formValues.opponent||''}><option value="">Choose a player from another faction</option>{data.players.filter(p=>p.id!==data.player!.id&&p.faction!==data.player!.faction).map(p=><option value={p.id} key={p.id}>{p.name} · {factionName(p.faction)}</option>)}</select></label>
      <p className="aurora-muted">Your opponent must belong to a different campaign faction. Same-faction games are prohibited for both Territory Battles and Narrative Missions.</p>
      <label>Date played<input name="date" type="date" required defaultValue={formValues.date||defaultDate} max={defaultDate}/></label>
      <label>Game type<select aria-label="Game type" value={kind} onChange={e=>{setKind(e.target.value);setMission('')}}><option value="territory">Territory Battle</option><option value="narrative" disabled={!state.narrativeMission}>Narrative Mission</option></select></label>
      {kind==='territory'?<><label>Campaign Location<select aria-label="Campaign Location" key={turn} name="location" required defaultValue={state.territories.some(t=>t.id===formValues.location&&t.vulnerable)?formValues.location:''}><option value="">Choose a Vulnerable Territory</option>{state.territories.filter(t=>t.vulnerable).map(t=><option key={t.id} value={t.id}>{locationName(t.id)}</option>)}</select></label><label>Mission played<select aria-label="Mission played" required value={mission} onChange={e=>setMission(e.target.value)}><option value="">Choose this Turn’s mission</option>{missions.map(m=><option key={m.name}>{m.name}</option>)}</select></label></>:<label>Active Narrative Mission<input readOnly value={selectedMission}/></label>}
      <label>Your Objective Points<input type="number" min="0" max="10" step="1" required value={opA} onChange={e=>setOpA(e.target.value)}/></label>
      <label>Opponent Objective Points<input type="number" min="0" max="10" step="1" required value={opB} onChange={e=>setOpB(e.target.value)}/></label>
      <label>Map / terrain layout (optional)<input name="map" maxLength={200} defaultValue={formValues.map}/></label>
    </div>
    {reference?<a href={reference} target="_blank" rel="noopener noreferrer">Open mission rules ↗</a>:<p><Link to={`${ROOT}/missions`}>View this Turn’s mission briefing and rules availability →</Link></p>}
    {score?<p role="status">{score.result} · Your TP: {score.tpA} · Opponent TP: {score.tpB}</p>:null}
    <label>Battle notes (optional)<textarea name="notes" maxLength={3000} defaultValue={formValues.notes}/></label><p>Keep secret-objective details out of battle notes and shared photos. Submit a private claim from your recorded game.</p>
    <details><summary>Army codes and photo links (optional)</summary><label>Your army code<textarea name="armyA" maxLength={4000} defaultValue={formValues.armyA}/></label><label>Opponent army code<textarea name="armyB" maxLength={4000} defaultValue={formValues.armyB}/></label><label>Photo links · HTTPS, one per line<textarea name="photos" maxLength={3000} defaultValue={formValues.photos}/></label></details>
    {turn!==data.state.turn||Boolean(state.deadline&&openedAt>Date.parse(state.deadline))?<p className="aurora-important">This is a late submission request. It cannot count until Lobo authorizes it.</p>:null}
    {error?<p role="alert">{error}</p>:null}<button type="submit" className="aurora-primary">Review scores before submission</button>
  </form>
}
function ScoreReview({a,b,opA,opB,tpA,tpB}:{a:Player;b:Player;opA:number;opB:number;tpA:number;tpB:number}){return <div className="aurora-score-grid">{[{p:a,op:opA,tp:tpA},{p:b,op:opB,tp:tpB}].map(v=><div key={v.p.id}><strong>{v.p.name}</strong><span>{factionName(v.p.faction)}</span><b>{v.op} OP · {v.tp} TP</b></div>)}</div>}
function VerificationLink({id}:{id:string}){const [message,setMessage]=useState(''),url=`https://lobo-infinity-portal.vercel.app${ROOT}/games?game=${id}`;return <div className="aurora-verification"><label>Opponent verification link<input readOnly value={url} onFocus={e=>e.target.select()}/></label><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setMessage('Link copied. Send it to your opponent.')}catch{setMessage('Select the link above to copy it.')}}}>Copy verification link</button><p role="status">{message}</p></div>}
function GameReview({game:g,me,admin,busy,mutate}:{game:CampaignGame;me?:string;admin:boolean;busy:boolean;mutate:(action:string,body:unknown)=>Promise<void>}){
  const [reason,setReason]=useState(''),[objective,setObjective]=useState(''),[explanation,setExplanation]=useState('')
  const act=(action:string,values?:unknown)=>void mutate(admin?'admin-action':'act',{id:g.id,revision:g.revision,action,reason,values})
  return <article className="aurora-game-review" id={`game-${g.id}`}>
    <h3>{g.playerA.name} vs {g.playerB.name}</h3><p><strong>{labels[g.status]||g.status}</strong>{g.late?` · Late ${g.lateApproved?'approved':'approval required'}`:''}</p>
    {g.duplicateOf&&!g.duplicateApproved?<p className="aurora-important">Possible duplicate of game {g.duplicateOf}. Lobo must verify this is a separate battle before it counts.</p>:null}
    <p>Turn {g.turn} · {g.date} · {locationName(g.location)} · {g.mission}</p><ScoreReview a={g.playerA} b={g.playerB} opA={g.opA} opB={g.opB} tpA={g.tpA} tpB={g.tpB}/>
    {g.map?<p>Map: {g.map}</p>:null}{g.notes?<p>{g.notes}</p>:null}
    {g.armyA||g.armyB||g.photos?<details><summary>Army codes & photos</summary>{g.armyA?<p>Submitter army code: <code>{g.armyA}</code></p>:null}{g.armyB?<p>Opponent army code: <code>{g.armyB}</code></p>:null}{g.photos.split(/\s+/).filter(Boolean).map((url,i)=><p key={url}><a href={url} target="_blank" rel="noopener noreferrer">Photo {i+1} ↗</a></p>)}</details>:null}
    {g.correction?<p className="aurora-important">Correction requested: {g.correction.reason}</p>:null}
    {['awaiting_confirmation','awaiting_late_approval'].includes(g.status)?<VerificationLink id={g.id}/>:null}
    {g.status==='awaiting_confirmation'&&(admin||g.playerB.id===me)?<button type="button" className="aurora-primary" disabled={busy} onClick={()=>act('confirm')}>Confirm result</button>:null}
    {g.status!=='rejected'||admin?<><label>{admin?'Commissioner explanation':'Correction requested · Explain what needs changing'}<textarea maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>{g.status!=='rejected'?<button type="button" disabled={busy||!reason.trim()} onClick={()=>act('correction')}>Request correction</button>:null}</>:null}
    {admin?<details><summary>Commissioner actions & correction</summary>
      <form className="aurora-admin-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),location=String(f.get('location'));act('correct',{opA:Number(f.get('opA')),opB:Number(f.get('opB')),date:String(f.get('date')),location,mission:String(f.get('mission')),kind:location==='narrative'?'narrative':'territory'})}}>
        <div className="aurora-admin-columns"><label>Submitter OP<input name="opA" type="number" min="0" max="10" required defaultValue={g.opA}/></label><label>Opponent OP<input name="opB" type="number" min="0" max="10" required defaultValue={g.opB}/></label><label>Date played<input name="date" type="date" required defaultValue={g.date}/></label><label>Location<select name="location" defaultValue={g.location}><option value="narrative">Narrative Mission</option>{AURORA_TERRITORIES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Mission<input name="mission" required defaultValue={g.mission}/></label></div>
        <button type="submit" disabled={busy||!reason.trim()}>Save correction & request confirmation</button>
      </form>
      <button type="button" disabled={busy||!reason.trim()} onClick={()=>act('approve')}>Approve result as commissioner</button>
      {g.late&&!g.lateApproved?<button type="button" disabled={busy||!reason.trim()} onClick={()=>act('approve-late')}>Authorize late result</button>:null}
      <button type="button" disabled={busy||!reason.trim()} onClick={()=>act('reject')}>Reject game / duplicate</button>
      <details><summary>Change history</summary>{g.history.map((h,i)=><p key={i}>{h.at} · {h.action} · {h.detail}</p>)}</details>
    </details>:g.status!=='rejected'?<details><summary>Submit a private secret-objective claim</summary><label>Objective title<input maxLength={200} value={objective} onChange={e=>setObjective(e.target.value)}/></label><label>Private explanation<textarea maxLength={4000} value={explanation} onChange={e=>setExplanation(e.target.value)}/></label><button type="button" disabled={busy||!objective.trim()||!explanation.trim()} onClick={()=>void mutate('claim',{id:g.id,objective,explanation})}>Send privately to Lobo</button></details>:null}
  </article>
}
function ClaimReview({claim:c,admin,busy,mutate}:{claim:Claim;admin:boolean;busy:boolean;mutate:(a:string,b:unknown)=>Promise<void>}){const [reason,setReason]=useState('');return <article className="aurora-game-review"><h4>{c.objective} · {c.status}</h4><p>{c.name} · {factionName(c.faction)}</p><p>{c.explanation}</p>{c.history.map((h,i)=><p key={i}>{h.action}: {h.detail}</p>)}{admin?<><label>Private commissioner response<textarea maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>{['approved','rejected'].map(status=><button type="button" key={status} disabled={busy||!reason.trim()} onClick={()=>void mutate('review-claim',{id:c.id,revision:c.revision,status,reason})}>{status==='approved'?'Approve claim':'Reject claim'}</button>)}</>:null}</article>}
function CampaignTotalsTable({totals}:{totals:AuroraPublicState['totals']}){return <div><h3>Confirmed submission TP / OP totals</h3>{totals.length?<div className="table-wrapper"><table><thead><tr><th scope="col">Campaign Location</th><th scope="col">Faction</th><th scope="col">TP</th><th scope="col">OP</th></tr></thead><tbody>{totals.map(t=><tr key={`${t.location}:${t.faction}`}><td>{locationName(t.location)}</td><td>{t.faction}</td><td>{t.tp}</td><td>{t.op}</td></tr>)}</tbody></table></div>:<p>No confirmed submission totals yet.</p>}<p>Pending, disputed, rejected and unapproved late games do not count. Narrative totals stay separate. Control and Campaign VP remain with Lobo.</p></div>}
export function CampaignSubmissionTotals({turn}:{turn:number}){
  const [data,setData]=useState<{turn:number;totals:AuroraPublicState['totals'];games:unknown[]}|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0)
  useEffect(()=>{let alive=true;api('totals').then(v=>{if(alive){setData(v);setError('')}},e=>{if(alive)setError(e.message)});return()=>{alive=false}},[refresh])
  return <section className="panel aurora-panel"><h2>Confirmed campaign submissions</h2>{error?<p role="alert">{error}</p>:data&&data.turn===turn?<><p>{data.games.length} confirmed games this Turn.</p><CampaignTotalsTable totals={data.totals}/></>:<p>Loading the active Turn’s confirmed results…</p>}<button type="button" onClick={()=>setRefresh(n=>n+1)}>Refresh confirmed totals</button></section>
}
