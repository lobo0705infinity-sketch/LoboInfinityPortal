import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { anchoredGunfighterScore, midrankPercentiles, buildMobileGunfighterCatalog, lookupMobileGunfighter } from '../bot/mobile-gunfighter.mjs'
import { loadMobileGunfighterCatalog } from '../bot/mobile-gunfighter-store.mjs'
import { loadGunfighterBenchmarkCatalog } from '../bot/gunfighter-catalog-store.mjs'
import { loadMobilityCatalog } from '../bot/mobility-catalog-store.mjs'
import { classifyTacticalBrief, renderTacticalBrief } from '../bot/inf-list-tactical.mjs'
import { createInfListResponse, createInfListInteractionHandler, INF_LIST_COMMAND_DEFINITION } from '../bot/inf-list-command.mjs'
assert.deepEqual(midrankPercentiles([4,2,1,2]), [100,50,0,50])
assert.deepEqual(midrankPercentiles([1,1,1]), [50,50,50])
assert.deepEqual(midrankPercentiles([]), [])
assert.deepEqual(midrankPercentiles([9]), [50])
assert.throws(() => midrankPercentiles([NaN]))
assert.equal(anchoredGunfighterScore(0),0)
assert.equal(anchoredGunfighterScore(25),50)
assert.equal(anchoredGunfighterScore(50),100)
assert.equal(anchoredGunfighterScore(75),100)
assert.throws(() => anchoredGunfighterScore(NaN))
const keys = ['1:2:1:1:1','1:2:1:2:1','1:2:1:3:1']
const sampleG = { entries: keys.map((key,i) => ({ key, result: { states: [{ id:'normal', rating:(i+1)*10 }, ...(i<2 ? [{ id:'fireteam', rating:100-i*10 }] : [])] } })) }
const sampleM = { version:'mobility-index-v2', keys:Object.fromEntries(keys.map((k,i)=>[k,i])), profiles:[30,20,10].map(score=>({ status:'rated',score })) }
const sample = buildMobileGunfighterCatalog(sampleG, sampleM)
assert.deepEqual(keys.map(k=>lookupMobileGunfighter(sample,k).score), [21.5,37,52.5])
assert.equal(lookupMobileGunfighter(sample,keys[0],'fireteam').score,89.5)
assert.equal(lookupMobileGunfighter(sample,keys[1],'fireteam').score,88)
assert.equal(lookupMobileGunfighter(sample,keys[2],'fireteam'),null)
assert.equal(lookupMobileGunfighter(sample,'1:2:0:1:1'),null)
assert.equal(lookupMobileGunfighter(sample,'2:2:1:1:1'),null)
assert.equal(lookupMobileGunfighter(sample,'1:2:1:1:2'),null)
const [catalog,g,m] = await Promise.all([loadMobileGunfighterCatalog(),loadGunfighterBenchmarkCatalog(),loadMobilityCatalog()])
const { fingerprint, ...unsigned } = catalog
assert.equal(fingerprint,createHash('sha256').update(JSON.stringify(unsigned)).digest('hex'))
assert.equal(catalog.gunfighterFingerprint,g.fingerprint)
assert.equal(catalog.mobilityFingerprint,m.fingerprint)
assert.ok(catalog.coverage.normal > 13000)
assert.ok(catalog.coverage.fireteam > 0 && catalog.coverage.fireteam < catalog.coverage.normal)
for(const state of ['normal','fireteam']) {
  const source = g.entries.map(e=>({e,r:lookupMobileGunfighter(catalog,e.key,state)})).filter(x=>x.r)
  assert.equal(source.length,catalog.coverage[state])
  for(const {e,r} of source) {
    assert.equal(r.gunfighter,e.result.states.find(x=>x.id===state).rating)
    assert.ok(r.score>=0&&r.score<=100)
    assert.equal(r.gunfighterNormalized,anchoredGunfighterScore(r.gunfighter))
    assert.ok(Math.abs(r.score-(.85*r.gunfighterNormalized+.15*r.mobility))<1e-10)
  }
  for(const {r} of source.filter((_,i)=>i%500===0)) for(const [field,pct] of [['gunfighter','gunfighterPercentile'],['mobility','mobilityPercentile']]) {
    const below=source.filter(x=>x.r[field]<r[field]).length,tied=source.filter(x=>x.r[field]===r[field]).length
    assert.equal(r[pct],100*(below+(tied-1)/2)/(source.length-1))
  }
}
const profile={combinedId:keys[0].replaceAll(':','-'),unitName:'Fixture',profileName:'Fixture',weapons:[],skills:[],equipment:[],bs:12,cc:10,points:10}
const plain=classifyTacticalBrief([profile])
const enabled=classifyTacticalBrief([profile],{},[],[],[],null,sample)
assert.equal(plain.categories.mobileGunfighters.length,0)
assert.equal(enabled.categories.mobileGunfighters[0].mobileRating.score,21.5)
assert.equal(enabled.categories.mobileLinked.length,0,'No legal Fireteam: no linked suggestion')
const team = classifyTacticalBrief([{...profile,fireteamTeams:['Test Duo']},{...profile,combinedId:keys[1].replaceAll(':','-'),fireteamTeams:['Test Duo']}],{},[],[],[],null,sample)
assert.equal(team.categories.mobileLinked.length,2)
assert.deepEqual(team.categories.mobileLinked.map(p=>p.mobileRating.score),[89.5,88])
for(const key of Object.keys(plain.categories).filter(k=>!k.startsWith('mobile')))assert.deepEqual(plain.categories[key],enabled.categories[key])
let html='';const png=Buffer.alloc(24);png.writeUInt32BE(1440,16);png.writeUInt32BE(1000,20)
const page={setContent:async s=>{html+=s},evaluate:async()=>{},close:async()=>{},locator:()=>({evaluateAll:async(_,blocks)=>blocks.map(b=>({...b,height:200})),screenshot:async()=>png})}
await renderTacticalBrief({analysis:enabled,browser:{newPage:async()=>page}})
assert.match(html,/85% anchored Gunfighter/);assert.match(html,/Gunfighter 10.00 \(20.0\/100 anchored\) · Mobility 30.0/)
let rendered
const render=async args=>{rendered=args;return {officialArmyUrl:'https://example.test',tacticalPages:[]}}
await createInfListResponse({armyCode:'QUJDRA==',render,withRenderSlot:fn=>fn()})
assert.equal(rendered.mobileGunfighter,undefined)
await createInfListResponse({armyCode:'QUJDRA==',mobileGunfighter:true,render,withRenderSlot:fn=>fn()})
assert.equal(rendered.mobileGunfighter,true)
const handler=createInfListInteractionHandler({render,withRenderSlot:fn=>fn()})
await handler({isChatInputCommand:()=>true,commandName:'inf-list',deferReply:async()=>{},options:{getString:()=> 'QUJDRA==',getBoolean:()=>true},editReply:async()=>{}})
assert.equal(rendered.mobileGunfighter,true)
assert.equal(INF_LIST_COMMAND_DEFINITION.options[1].required,false)
const publicSource=await readFile('src/public/SnapshotArmyIntelligence.tsx','utf8')
assert.match(publicSource,/<ArmyMobility lists=\{lists\}/)
console.log('PASS: anchored raw blend, informational percentiles, separate cohorts, all source scores, fingerprint, exact forms, opt-in command plumbing, Fireteam guard, unchanged classifications, bot markup and public route.')
