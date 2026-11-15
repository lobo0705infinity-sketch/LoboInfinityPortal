import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { campaignContributions, campaignTotals, campaignRulesForTurn, BALANCED_RULES, campaignScore } from '../shared/aurora-games.mjs'
import { AURORA_FACTIONS } from '../shared/aurora-public.mjs'
import { emptyAuroraState, validateAuroraPublicState } from '../shared/aurora-public-state.mjs'
import { emptyOperations, resolveOperations, mutateOperations } from '../bot/aurora-operations.mjs'
import { createCampaignGameStore } from '../bot/aurora-game-store.mjs'

let serial = 0
const game = (player, op = 10, location = 'nova-prospect', faction = 'Ariadna', opponentOP = 0) => ({
  id: `game-${++serial}`, turn: 2, location, kind: location === 'narrative' ? 'narrative' : 'territory', status: 'confirmed', date: '2026-11-15', createdAt: `2026-11-15T12:00:${String(serial % 60).padStart(2, '0')}Z`,
  playerA: { id: player, name: player, faction }, playerB: { id: 'opponent-' + serial, name: 'Opponent', faction: faction === 'JSA' ? 'Nomads' : 'JSA' }, opA: op, opB: opponentOP, ...campaignScore(op, opponentOP), revision: 1, history: [],
})
const fixture = (balanced = true) => {
  const start = emptyAuroraState(); start.turn = 2; start.deadline = '2026-12-01T23:59:00Z'; start.narrativeMission = { title: 'Released', briefing: 'Released', reward: '', sheetUrl: '' }
  start.territories.forEach((t, i) => { t.vulnerable = i < 4; t.controller = 'PanOceania' })
  if (balanced) { start.rulesRevision = BALANCED_RULES; start.tiePriority = [...AURORA_FACTIONS] }
  const ledger = { version: 1, games: [], claims: [], turns: { 2: start }, operations: emptyOperations() }
  ledger.operations.turns[2] = { start, phase: 'choices', offers: [], narrativeBonuses: [], startVP: Object.fromEntries(AURORA_FACTIONS.map(f => [f, 0])), startCredits: {} }
  const act = (action, values = {}) => mutateOperations(ledger, { revision: ledger.operations.revision, turn: 2, action, reason: 'Balance test', ...values }, [], start)
  return { ledger, start, turn: ledger.operations.turns[2], act }
}
// Stable identities and optimal best-five selection, independent of submission array order.
{
  const games = [game('ace'),game('ace'),game('ace'),game('regular-1',7),game('regular-1',6),game('regular-2',5),game('regular-3',4)]
  const contributions = campaignContributions(games, 2, BALANCED_RULES).filter(r => r.faction === 'Ariadna')
  assert.equal(contributions.filter(r => r.counted).length, 5)
  assert.equal(contributions.filter(r => r.counted && r.playerId === 'ace').length, 2)
  assert.equal(contributions.find(r => r.gameId === games[2].id).reason, 'Player limit: two results at this location')
  assert.equal(contributions.at(-1).reason, 'Faction limit: five results at this location')
  assert.equal(campaignTotals(games, 2, BALANCED_RULES).find(r => r.faction === 'Ariadna').tp, 25)
  assert.equal(campaignTotals(games, 2).find(r => r.faction === 'Ariadna').tp, 34)
  const selected = rows => campaignContributions(rows, 2, BALANCED_RULES).filter(r=>r.counted).map(r=>r.gameId+':'+r.side).sort()
  assert.deepEqual(selected(games), selected([...games].reverse()))
  assert.equal(campaignContributions(games,2,BALANCED_RULES).find(r=>r.gameId===games[2].id&&r.side==='B').counted,true)
  games[0].status='rejected'
  assert.equal(campaignContributions(games,2,BALANCED_RULES).find(r=>r.gameId===games[2].id&&r.side==='A').counted,true)
  const separate = [...games, game('ace',10,'korin-range'),game('ace',10,'narrative'),{...game('ace'),turn:1}]
  assert.equal(campaignTotals(separate,2,BALANCED_RULES).find(r=>r.location==='narrative'&&r.faction==='Ariadna').tp,5)
  const late=game('late'); late.late=true
  assert.equal(campaignContributions([late],2,BALANCED_RULES).length,0)
  late.lateApproved=true; assert.equal(campaignContributions([late],2,BALANCED_RULES).length,2)
  late.duplicateOf='previous'; assert.equal(campaignContributions([late],2,BALANCED_RULES).length,0)
  late.duplicateApproved=true; assert.equal(campaignContributions([late],2,BALANCED_RULES).length,2)
}
// A lone ace's twenty perfect wins contribute ten TP, while three players can fill five slots.
{
  const solo=Array.from({length:20},()=>game('ace'))
  assert.equal(campaignTotals(solo,2,BALANCED_RULES).find(r=>r.faction==='Ariadna').tp,10)
  const team=[...solo,game('second',4),game('second',4),game('third',4)]
  assert.equal(campaignTotals(team,2,BALANCED_RULES).find(r=>r.faction==='Ariadna').tp,22)
}
// Participation gates and support conversions cannot be bypassed with bonuses/mercenaries.
{
  const f=fixture(); f.turn.tohaa={location:'nova-prospect',beneficiary:'PanOceania',outcome:'PRESERVE'}
  assert.equal(resolveOperations(f.ledger,2).hiddenHand.success,false)
  f.ledger.games.push(game('tohaa',4,'nova-prospect','Tohaa'))
  assert.equal(resolveOperations(f.ledger,2).hiddenHand.success,false)
  f.ledger.games[0]={...f.ledger.games[0],opA:5,tpA:5}
  assert.equal(resolveOperations(f.ledger,2).hiddenHand.success,true)
  f.turn.ca={location:'korin-range'}; f.turn.offers=[{id:'contract',employer:'Combined Army',location:'korin-range',bid:1}];f.turn.accepted='contract'
  f.ledger.games.push(game('na2',10,'korin-range','NA2'))
  assert.equal(resolveOperations(f.ledger,2).infiltration.success,false)
  f.ledger.games.push(game('ca',0,'korin-range','Combined Army',0))
  assert.equal(resolveOperations(f.ledger,2).infiltration.success,true)
  f.turn.narrativeBonuses=[{faction:'Tohaa',tp:10}]
  assert.equal(resolveOperations(f.ledger,2).narrativeWinner,'')
  f.ledger.games.push(game('nomad',4,'narrative','Nomads'))
  assert.equal(resolveOperations(f.ledger,2).narrativeWinner,'Nomads')
  const old=fixture(false);old.turn.tohaa=f.turn.tohaa
  assert.equal(resolveOperations(old.ledger,2).hiddenHand.success,true,'Historical rule stays reproducible')
}
// No uninvolved incumbent tie victory; an involved incumbent retains; no activity preserves ownership.
{
  const f=fixture();f.ledger.games=[game('ariadna',10,'nova-prospect','Ariadna'),game('yujing',10,'nova-prospect','Yu Jing')]
  assert.equal(resolveOperations(f.ledger,2).control[0].after,'Yu Jing')
  f.start.territories[0].controller='Ariadna'
  assert.equal(resolveOperations(f.ledger,2).control[0].after,'Ariadna')
  f.ledger.games=[];assert.equal(resolveOperations(f.ledger,2).control[0].after,'Ariadna')
  f.start.territories[0].controller='PanOceania';f.ledger.games=[game('tohaa',10,'nova-prospect','Tohaa')]
  assert.equal(resolveOperations(f.ledger,2).doctrines.find(d=>d.faction==='PanOceania').eligible,false)
  f.ledger.games=[game('jsa1',4,'nova-prospect','JSA'),game('jsa2',4,'nova-prospect','JSA')]
  assert.equal(resolveOperations(f.ledger,2).doctrines.find(d=>d.faction==='JSA').eligible,true,'Eight-TP fallback works when all VP are tied')
}
// Objective enforcement: activation, activity, one completion per Turn; historical awards unchanged.
{
  const f=fixture()
  f.act('assign-objective',{faction:'Ariadna',title:'Two victories',requirement:'Two counted victories'})
  assert.throws(()=>f.act('assign-objective',{faction:'Ariadna',title:'Second',requirement:'Anything'}),/one active/)
  f.turn.phase='open';assert.throws(()=>f.act('assign-objective',{faction:'JSA',title:'Late',requirement:'Anything'}),/before choices/)
  f.turn.phase='closed';const id=f.ledger.operations.objectives[0].id
  assert.throws(()=>f.act('objective',{id,approve:true,evidence:'Claim'}),/at least one counted/)
  f.ledger.games.push(game('a'));f.act('objective',{id,approve:true,evidence:'Verified requirement and counted reports'})
  f.ledger.operations.objectives.push({id:'legacy-carry',faction:'Ariadna',status:'assigned',assignedTurn:1})
  assert.throws(()=>f.act('objective',{id:'legacy-carry',approve:true,evidence:'Second claim'}),/Only one/)
}
// Version declarations are explicit and frozen at preparation.
{
  const f=fixture();assert.equal(validateAuroraPublicState(f.start).rulesRevision,BALANCED_RULES)
  assert.throws(()=>validateAuroraPublicState({...f.start,tiePriority:[]}),/requires a published/)
  assert.throws(()=>validateAuroraPublicState({...f.start,tiePriority:Array(11).fill('Ariadna')}),/each faction/)
  assert.throws(()=>validateAuroraPublicState({...f.start,rulesRevision:'unknown'}),/Unknown/)
  assert.equal(campaignRulesForTurn(f.ledger,2),BALANCED_RULES)
  delete f.start.rulesRevision; f.ledger.turns[2]={...f.start,rulesRevision:BALANCED_RULES}
  assert.equal(campaignRulesForTurn(f.ledger,2),'legacy','A newer bulletin cannot revise a prepared legacy Turn')
}
// Durable totals and public counting decisions match resolution and never expose player IDs/private records.
{
  const dir=await mkdtemp(join(tmpdir(),'aurora-balance-'))
  try{
    const f=fixture();f.ledger.games=Array.from({length:4},()=>game('ace'))
    const {writeFile}=await import('node:fs/promises'),path=join(dir,'ledger.json')
    await writeFile(path,JSON.stringify(f.ledger));const store=createCampaignGameStore(path)
    const totals=await store.totals(2),activity=await store.activity(2),view=await store.view('ace',false,f.start)
    assert.deepEqual(totals,resolveOperations(f.ledger,2).totals)
    assert.deepEqual(activity.totals,totals);assert.deepEqual(view.totals,totals)
    assert.equal(activity.games.filter(g=>g.countedA).length,2)
    assert(!('id' in activity.games[0].playerA));assert(!('operations' in activity))
    assert.equal(JSON.parse(await readFile(path)).games.length,4)
  }finally{await rm(dir,{recursive:true,force:true})}
}
// The public API rejects mid-Turn changes and keeps adopted priority fixed.
{
  const { saveAuroraPublication } = await import('../api/aurora-campaign.mjs')
  const legacy = fixture(false).start
  let saved = { revision: 'previous', publishedAt: '', state: legacy }, writes = 0
  const getObject = async () => ({ stream: new Response(JSON.stringify(saved)).body, blob: { etag: 'test' } })
  const putObject = async (_path, body) => { saved = JSON.parse(body); writes++ }
  const revised = fixture().start
  await assert.rejects(saveAuroraPublication({ expectedRevision: 'previous', state: revised }, { getObject, putObject }), /later Turn/)
  assert.equal(writes, 0)
  revised.turn = 3
  await saveAuroraPublication({ expectedRevision: 'previous', state: revised }, { getObject, putObject })
  assert.equal(writes, 1)
  await assert.rejects(saveAuroraPublication({ expectedRevision: saved.revision, state: { ...revised, turn: 4, tiePriority: [...revised.tiePriority].reverse() } }, { getObject, putObject }), /remain fixed/)
}
// Objective withdrawal allows a prospective replacement; excluded reports cannot prove a claim.
{
  const f = fixture()
  f.act('assign-objective', { faction: 'Ariadna', title: 'Replace me', requirement: 'Old target' })
  f.act('withdraw-objective', { id: f.ledger.operations.objectives[0].id })
  f.act('assign-objective', { faction: 'Ariadna', title: 'Replace me', requirement: 'Reachable revised target' })
  f.ledger.games = [game('ace'),game('ace'),game('ace')]
  const contributions = campaignContributions(f.ledger.games,2,BALANCED_RULES)
  const excluded = contributions.find(c => c.side === 'A' && !c.counted)
  f.ledger.claims.push({ id:'claim', gameId:excluded.gameId, faction:'Ariadna', turn:2, status:'approved' })
  f.turn.phase = 'closed'
  assert.throws(() => f.act('objective', { id:f.ledger.operations.objectives.at(-1).id, approve:true, claimId:'claim', evidence:'Excluded report' }), /counted result/)
}
// The proposed next-campaign calendar gives every territory exactly one slot in each half.
{
  const amendment = await readFile(new URL('../docs/aurora-balance-amendment-20261115.md', import.meta.url),'utf8')
  const rows = amendment.split('\n').filter(line => /^\| [1-6] \|/.test(line)).map(line => line.split('|').slice(2,-1).map(s=>s.trim()))
  assert.equal(rows.length,6)
  for (const half of [rows.slice(0,3),rows.slice(3)]) { assert.equal(half.flat().length,12); assert.equal(new Set(half.flat()).size,12) }
}
console.log('PASS: best-five/two-player selection, 20-win stress case, per-side inclusion, corrections, location/Turn isolation, approval gates, version freeze, Tohaa/CA/Narrative participation, active defence, tied challengers, Doctrine fallback, objective limits, durable public/private consistency.')
