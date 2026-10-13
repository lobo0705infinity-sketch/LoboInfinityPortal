import { AURORA_TURNS } from './aurora-public.mjs'
import { AURORA_REGISTRATION_FACTIONS } from './aurora-registration.mjs'
export const factionName = id => AURORA_REGISTRATION_FACTIONS.find(f => f.id === id)?.name || id
export function campaignScore(a,b) {
  if (![a,b].every(n=>Number.isInteger(n)&&n>=0&&n<=10)) throw Error('Objective Points must be whole numbers from 0 to 10.')
  const tp=(own,other)=>(own>other?4:own===other?2:0)+(own>=5?1:0)+(own<other&&other-own<=2?1:0)
  return { result:a===b?'Draw':a>b?'Submitter wins':'Opponent wins',tpA:tp(a,b),tpB:tp(b,a) }
}
export function campaignText(value,max,label,required=false) {
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)||(required&&!value.trim())) throw Error(`Enter a valid ${label} (up to ${max} characters).`)
  return value.trim()
}
export function validateCampaignGame(input,state,today) {
  if(!state.turn||input.turn!==state.turn) throw Error('Choose an announced Campaign Turn.')
  const date=campaignText(input.date,10,'played date',true)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today) throw Error('Choose a valid played date, no later than today.')
  const kind=input.kind
  if(!['territory','narrative'].includes(kind)) throw Error('Choose Territory Battle or Narrative Mission.')
  const location=kind==='narrative'?'narrative':campaignText(input.location,80,'territory',true)
  if(kind==='territory'&&!state.territories.some(t=>t.id===location&&t.vulnerable)) throw Error('Choose one of this Turn’s four Vulnerable Territories.')
  const mission=kind==='narrative'?state.narrativeMission?.title:campaignText(input.mission,200,'mission',true)
  if(!mission||(kind==='territory'&&!AURORA_TURNS[state.turn-1].missions.some(m=>m.name===mission))) throw Error('Choose an active mission for this Turn.')
  const photos=campaignText(input.photos||'',3000,'photo links')
  if(photos.split(/\s+/).filter(Boolean).some(v=>{try{const u=new URL(v);return u.protocol!=='https:'||Boolean(u.username||u.password)}catch{return true}})) throw Error('Photo links must be HTTPS links separated by spaces or new lines.')
  return {turn:state.turn,date,kind,location,mission,opA:input.opA,opB:input.opB,...campaignScore(input.opA,input.opB),map:campaignText(input.map||'',200,'map'),notes:campaignText(input.notes||'',3000,'battle notes'),armyA:campaignText(input.armyA||'',4000,'army code'),armyB:campaignText(input.armyB||'',4000,'army code'),photos}
}
export function campaignTotals(games,turn) {
  const rows=new Map()
  for(const g of games.filter(g=>g.turn===turn&&g.status==='confirmed'&&(!g.late||g.lateApproved)&&(!g.duplicateOf||g.duplicateApproved))) for(const side of ['A','B']) {
    const faction=factionName(g[`player${side}`].faction),key=`${g.location}:${faction}`,row=rows.get(key)||{location:g.location,faction,tp:0,op:0}
    row.tp+=g[`tp${side}`];row.op+=g[`op${side}`];rows.set(key,row)
  }
  return [...rows.values()]
}
