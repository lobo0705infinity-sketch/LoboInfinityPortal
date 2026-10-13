import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Readable} from 'node:stream'
import {createCampaignGameStore} from '../bot/aurora-game-store.mjs'
import {createCampaignGameService} from '../bot/aurora-game-service.mjs'
import {emptyAuroraState} from '../shared/aurora-public-state.mjs'
import {campaignScore} from '../shared/aurora-games.mjs'
const dir=await mkdtemp(join(tmpdir(),'aurora-check-')),path=join(dir,'games.json')
let clock=new Date('2026-11-02T12:00:00Z')
const store=createCampaignGameStore(path,{now:()=>clock}),state={...emptyAuroraState(),turn:1,deadline:'2026-11-15T23:59:00-05:00',narrativeMission:{title:'Announced mission',briefing:'Current briefing',reward:'',sheetUrl:''}}
state.territories.forEach((t,i)=>t.vulnerable=i<4)
const a={userId:'111111111111111111',name:'Jake',faction:'ariadna'},b={userId:'222222222222222222',name:'Gabe',faction:'pano'},c={userId:'333333333333333333',name:'Other',faction:'aleph'}
const input={turn:1,date:'2026-11-02',kind:'territory',location:state.territories[0].id,mission:'Claim the Frontier',opA:9,opB:3}
try{
  assert.deepEqual(campaignScore(9,3),{result:'Submitter wins',tpA:5,tpB:0});assert.deepEqual(campaignScore(7,6),{result:'Submitter wins',tpA:5,tpB:2});assert.deepEqual(campaignScore(5,5),{result:'Draw',tpA:3,tpB:3});assert.equal(campaignScore(4,2).tpB,1);assert.equal(campaignScore(4,1).tpB,0)
  for(const values of [{opA:-1},{opA:11},{opA:2.5},{date:'2026-02-30'},{date:'2026-11-03'},{location:state.territories[5].id},{mission:'Future mission'},{photos:'javascript:alert(1)'}])await assert.rejects(store.submit({...input,...values},a,b,state))
  await assert.rejects(store.submit(input,a,a,state))
  const teammate={...c,userId:'444444444444444444',faction:a.faction}
  for(const kind of ['territory','narrative'])await assert.rejects(store.submit({...input,kind,playerB:{faction:'pano'}},a,teammate,state),/Same-faction games are prohibited/)
  assert.equal((await store.view(a.userId,false,state)).games.length,0)
  const game=await store.submit({...input,tpA:999,playerA:{faction:'pano'}},a,b,state);assert.equal(game.map,'');assert.equal(game.tpA,5);assert.equal(game.playerA.faction,'ariadna');assert.equal((await store.totals(1)).length,0)
  const dup=await store.submit(input,b,a,state);assert.equal(dup.duplicateOf,game.id)
  const dupConfirmed=await store.act({id:dup.id,revision:1,action:'confirm'},a.userId,false);assert.equal(dupConfirmed.status,'awaiting_duplicate_review');assert.equal((await store.totals(1)).length,0)
  await store.act({id:dup.id,revision:dupConfirmed.revision,action:'reject',reason:'Duplicate record'},null,true)
  await assert.rejects(store.act({id:game.id,revision:1,action:'confirm'},a.userId,false),/Only the registered opponent/)
  await assert.rejects(store.act({id:game.id,revision:1,action:'confirm'},c.userId,false),/Only the two/)
  await assert.rejects(store.act({id:game.id,revision:1,action:'approve',reason:'bad'},a.userId,false),/Commissioner/)
  const confirmed=await store.act({id:game.id,revision:1,action:'confirm'},b.userId,false);assert.equal((await store.totals(1)).find(t=>t.faction==='Ariadna').tp,5)
  await assert.rejects(store.act({id:game.id,revision:1,action:'confirm'},b.userId,false),/changed/)
  const claim=await store.claim({id:game.id,objective:'PRIVATE TITLE',explanation:'PRIVATE DETAILS'},a)
  assert.equal((await store.view(b.userId,false,state)).claims.length,0);assert.equal((await store.view(a.userId,false,state)).claims.length,1)
  const publicView=JSON.stringify(await store.activity(1));assert(!publicView.includes('PRIVATE'));assert(!publicView.includes(a.userId))
  const disputed=await store.act({id:game.id,revision:confirmed.revision,action:'correction',reason:'Score was 6'},b.userId,false);assert.equal((await store.totals(1)).length,0)
  await assert.rejects(store.act({id:game.id,revision:disputed.revision,action:'confirm'},b.userId,false),/resolve/)
  const corrected=await store.act({id:game.id,revision:disputed.revision,action:'correct',reason:'Verified scores',values:{opB:6}},null,true);assert.equal(corrected.tpB,1);assert.equal(corrected.status,'awaiting_confirmation');assert(corrected.history.some(h=>h.action==='previous-result'))
  await store.act({id:game.id,revision:corrected.revision,action:'confirm'},b.userId,false);assert.equal((await createCampaignGameStore(path).totals(1)).length,2)
  const narrative=await store.submit({...input,kind:'narrative',mission:'spoof'},a,b,state);assert.equal(narrative.mission,state.narrativeMission.title);assert.equal(narrative.location,'narrative')
  await store.act({id:narrative.id,revision:1,action:'confirm'},b.userId,false);assert.equal((await store.totals(1)).filter(t=>t.location==='narrative').length,2)
  clock=new Date('2026-11-16T12:00:00Z');const late=await store.submit({...input,date:'2026-11-14'},a,b,state),pending=await store.act({id:late.id,revision:1,action:'confirm'},b.userId,false);assert.equal(pending.status,'awaiting_late_approval');assert.equal((await store.totals(1)).find(t=>t.faction==='Ariadna'&&t.location===input.location).tp,5)
  const approved=await store.act({id:late.id,revision:pending.revision,action:'approve-late',reason:'Authorized late result'},null,true);assert.equal(approved.status,'confirmed');assert.equal((await store.totals(1)).find(t=>t.faction==='Ariadna'&&t.location===input.location).tp,10)
  await store.act({id:late.id,revision:approved.revision,action:'reject',reason:'Duplicate'},null,true);assert.equal((await store.totals(1)).find(t=>t.faction==='Ariadna'&&t.location===input.location).tp,5)
  await store.reviewClaim({id:claim.id,revision:1,status:'approved',reason:'Verified'})
  // Boundary checks use the real HTTP handler and private ledger, with no external messages.
  let account=null,authorized=false
  const service=createCampaignGameService({store,registrations:{player:async id=>[a,b,c,teammate].find(p=>p.userId===id),players:async()=>[a,b,c,teammate]},identity:()=>account,notify:async()=>{throw Error('DM disabled')},fetchObject:async url=>({ok:true,json:async()=>url.includes('verify-admin')?{authorized}:{state}})})
  async function req(action,{method='GET',body,origin='https://lobo-infinity-portal.vercel.app',authorization=''}={}){const request=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(request,{url:`/aurora-vii/games?action=${action}`,method,headers:{origin,authorization,'content-type':'application/json'}});const response={code:200,text:'',setHeader(){},writeHead(code){this.code=code},end(text){this.text=text}};await service.handler(request,response);return response}
  assert.equal((await req('mine')).code,401);assert.equal((await req('admin')).code,403);assert.equal((await req('totals')).code,200);assert(!(await req('totals')).text.includes('PRIVATE'))
  account={id:b.userId};assert(!(await req('mine')).text.includes('PRIVATE DETAILS'));assert.equal((await req('act',{method:'POST',body:{},origin:'https://evil.test'})).code,403)
  account={id:a.userId};const blocked=await req('submit',{method:'POST',body:{...input,opponent:teammate.userId,playerB:{faction:'pano'}}});assert.equal(blocked.code,400);assert(blocked.text.includes('Same-faction games are prohibited'))
  authorized=true;assert((await req('admin',{authorization:'Bearer test'})).text.includes('PRIVATE DETAILS'))
  await service.deliver();assert.equal((await store.notifications()).length,0)
  await writeFile(path,'corrupt');await assert.rejects(store.totals(1))
  console.log('PASS: same-faction prohibition for territory/narrative and spoof prevention, scoring, optional map, spoof prevention, duplicates, opponent-only and stale confirmation, corrections, restart persistence, narrative isolation, late approval, rejection, private claims, public projection, CSRF, DM fallback, fail-closed ledger.')
}finally{await rm(dir,{recursive:true,force:true})}
