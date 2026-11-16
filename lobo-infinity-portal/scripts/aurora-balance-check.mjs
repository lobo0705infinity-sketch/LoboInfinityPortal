import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { campaignContributions, campaignTotals, campaignRulesForTurn, BALANCED_RULES, campaignScore } from '../shared/aurora-games.mjs'
import { AURORA_FACTIONS } from '../shared/aurora-public.mjs'
import { emptyAuroraState, initialAuroraState, validateAuroraPublicState } from '../shared/aurora-public-state.mjs'
import { AURORA_RULES_ADOPTION } from '../shared/aurora-rules-adoption.mjs'
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
// Adoption is visible before Turn 1; historical publications are never upgraded on read.
{
  const { readAuroraPublication, saveAuroraPublication } = await import('../api/aurora-campaign.mjs')
  const first = await readAuroraPublication(async () => null)
  assert.deepEqual(first.state, initialAuroraState())
  assert.equal(first.state.turn, 0)
  assert.equal(first.state.rulesRevision, BALANCED_RULES)
  assert.equal(first.state.territories.every(t => !t.controller && !t.vulnerable), true)
  const digest = faction => createHash('sha256').update(`${AURORA_RULES_ADOPTION.drawSeed}\n${faction}`).digest('hex')
  assert.deepEqual([...AURORA_RULES_ADOPTION.tiePriority], [...AURORA_FACTIONS].sort((a,b) => digest(a).localeCompare(digest(b))))
  first.state.tiePriority.reverse()
  assert.deepEqual(initialAuroraState().tiePriority, [...AURORA_RULES_ADOPTION.tiePriority], 'Callers cannot mutate the fixed draw')
  const legacy = { revision: 'legacy', publishedAt: '', state: fixture(false).start }
  const stored = await readAuroraPublication(async () => ({ stream: new Response(JSON.stringify(legacy)).body }))
  assert.deepEqual(stored, legacy)
  const start = initialAuroraState(); start.turn = 1; start.territories.slice(0,4).forEach(t => { t.vulnerable = true })
  let writes = 0
  const getObject = async () => null, putObject = async () => { writes++ }
  await saveAuroraPublication({ expectedRevision: '', state: start }, { getObject, putObject })
  assert.equal(writes, 1)
  await assert.rejects(saveAuroraPublication({ expectedRevision: '', state: { ...start, rulesRevision: 'legacy' } }, { getObject, putObject }), /remain fixed/)
  await assert.rejects(saveAuroraPublication({ expectedRevision: '', state: { ...start, tiePriority: [...start.tiePriority].reverse() } }, { getObject, putObject }), /remain fixed/)
  assert.equal(writes, 1)
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
  assert.equal(resolveOperations(f.ledger,2).doctrines.find(d=>d.faction==='JSA').eligible,false,'Eight TP alone cannot replace the faction-specific Doctrine')
  f.turn.startVP.PanOceania=1
  assert.equal(resolveOperations(f.ledger,2).doctrines.find(d=>d.faction==='JSA').eligible,true,'JSA still qualifies by capturing from a faction ahead at Turn start')
}
// State objectives can use earlier progress without a current game; timing and award limits still apply.
{
  const f=fixture()
  f.start.territories.slice(0,3).forEach(t=>{t.controller='Ariadna'})
  f.act('assign-objective',{faction:'Ariadna',title:'Frontier Empire',requirement:'Control at least 3 territories at Turn end'})
  assert.throws(()=>f.act('assign-objective',{faction:'Ariadna',title:'Second',requirement:'Anything'}),/one active/)
  f.turn.phase='open';assert.throws(()=>f.act('assign-objective',{faction:'JSA',title:'Late',requirement:'Anything'}),/before choices/)
  f.turn.phase='closed';const id=f.ledger.operations.objectives[0].id
  assert.equal(f.ledger.games.length,0)
  f.act('objective',{id,approve:true,evidence:'Three territories captured in prior Turns remain controlled at resolution'})
  assert.equal(f.ledger.operations.objectives[0].status,'completed')
  f.ledger.operations.objectives.push({id:'legacy-carry',faction:'Ariadna',status:'assigned',assignedTurn:1})
  assert.throws(()=>f.act('objective',{id:'legacy-carry',approve:true,evidence:'Second claim'}),/active assigned/)
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
// Objective withdrawal allows a prospective replacement; valid cap-excluded reports can prove a claim.
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
  assert.doesNotThrow(() => f.act('objective', { id:f.ledger.operations.objectives.at(-1).id, approve:true, claimId:'claim', evidence:'Confirmed game meets the written requirement; TP excluded only by cap' }))
  assert.equal(f.ledger.operations.objectives.at(-1).status,'completed')
  assert.equal(f.ledger.operations.awards.find(a=>a.category==='objective').vp,2)
}
console.log('PASS: best-five/two-player selection, 20-win stress case, per-side inclusion, corrections, location/Turn isolation, approval gates, version freeze, Tohaa/CA/Narrative participation, active defence, tied challengers, faction-specific Doctrines, objective limits, durable public/private consistency.')
