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
  const listExchangeCode = campaignText(input.listExchangeCode || '', 20, 'LLH game code').toUpperCase()
  if (listExchangeCode && !/^LLH-[A-F0-9]{16}$/.test(listExchangeCode)) throw Error('Enter a valid LLH game code, or leave it blank.')
  if(photos.split(/\s+/).filter(Boolean).some(v=>{try{const u=new URL(v);return u.protocol!=='https:'||Boolean(u.username||u.password)}catch{return true}})) throw Error('Photo links must be HTTPS links separated by spaces or new lines.')
  return {turn:state.turn,date,kind,location,mission,opA:input.opA,opB:input.opB,...campaignScore(input.opA,input.opB),map:campaignText(input.map||'',200,'map'),notes:campaignText(input.notes||'',3000,'battle notes'),armyA:campaignText(input.armyA||'',4000,'army code'),armyB:campaignText(input.armyB||'',4000,'army code'),photos,listExchangeCode}
}
export const BALANCED_RULES = '2026-11-balance'
export const LEGACY_RULES = 'legacy'
export const confirmedCampaignGame = g => g.status === 'confirmed' && (!g.late || g.lateApproved) && (!g.duplicateOf || g.duplicateApproved)
export function campaignContributions(games, turn, rulesRevision = LEGACY_RULES) {
  const contributions = games.filter(g => g.turn === turn && confirmedCampaignGame(g)).flatMap(g => ['A', 'B'].map(side => ({
    gameId: g.id, side, location: g.location, faction: factionName(g[`player${side}`].faction),
    playerId: g[`player${side}`].id, tp: g[`tp${side}`], op: g[`op${side}`],
    submittedAt: g.createdAt || '', counted: true, reason: 'Counted',
  })))
  if (rulesRevision !== BALANCED_RULES) return contributions
  const groups = new Map()
  for (const row of contributions) {
    if (!row.playerId) throw Error('A counted campaign result requires a stable registered player identity.')
    const key = `${row.location}:${row.faction}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0
  for (const rows of groups.values()) {
    rows.sort((a, b) => b.tp - a.tp || b.op - a.op || lexical(a.submittedAt, b.submittedAt) || lexical(a.gameId, b.gameId) || lexical(a.side, b.side))
    const players = new Map()
    let counted = 0
    for (const row of rows) {
      const personal = players.get(row.playerId) || 0
      row.counted = personal < 2 && counted < 5
      row.reason = personal >= 2 ? 'Player limit: two results at this location' : counted >= 5 ? 'Faction limit: five results at this location' : 'Counted'
      if (row.counted) { players.set(row.playerId, personal + 1); counted++ }
    }
  }
  return contributions
}
export function campaignTotals(games, turn, rulesRevision = LEGACY_RULES) {
  const rows = new Map()
  for (const c of campaignContributions(games, turn, rulesRevision)) {
    const key = `${c.location}:${c.faction}`, row = rows.get(key) || { location: c.location, faction: c.faction, tp: 0, op: 0 }
    if (c.counted) { row.tp += c.tp; row.op += c.op }
    rows.set(key, row)
  }
  return [...rows.values()]
}
// Prepared Turns always use their frozen publication, including an absent legacy revision.
export function campaignRulesForTurn(ledger, turn) {
  return (ledger.operations?.turns[turn]?.start || ledger.turns?.[turn])?.rulesRevision || LEGACY_RULES
}
