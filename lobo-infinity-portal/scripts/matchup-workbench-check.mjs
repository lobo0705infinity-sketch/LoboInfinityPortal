import assert from 'node:assert/strict'
import { mkdtemp,rm } from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {loadMatchupSource,calculateWorkbench,importedMatchup,effectDetails,prepareFighter,hackingPrograms,repeatedOrderOdds,DEFAULT_MATCHUP_SETTINGS} from '../bot/matchup-workbench.mjs'
import {startWorkbench,createWorkbenchInteractionHandler,workbenchPayload} from '../bot/matchup-interactive.mjs'
import {reportableResponse} from '../bot/bot-feedback.mjs'
const close=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`)
const source=await loadMatchupSource()
const link='https://infinitythecalculator.com/?mode=matchup&unitA=25&factionA=102&groupA=1&profileA=1&optionA=7&coverA=1&unitB=383&factionB=403&groupB=1&profileB=1&optionB=1&coverB=1&range=100'
const imported=importedMatchup(link,source)
assert.equal(imported.settings.range,'32-40');assert.equal(importedMatchup(link.replace('range=100','range=40'),source).settings.range,'8-16')
assert.throws(()=>importedMatchup(link.replace('infinitythecalculator.com','infinitythecalculator.com.evil.test'),source))
const baseline=await calculateWorkbench({...imported,source})
const da=baseline.bands.find(b=>b.range==='32-40').candidates.find(c=>c.ammo.includes('DA')&&c.aroType==='shoot')
// Independent external fixture: live Infinity the Calculator, B2 SV13 DA vs B1 SV5 AP.
close(da.roll.activeWin,81.24,0.01);close(da.effect.onePlus,0.516901943625);close(da.effect.twoPlus,0.181146819375)
close(da.effect.expectedWounds,0.7395);assert.equal(da.effect.unconscious,0);assert.ok(da.effect.continuation>0)
assert.ok(baseline.selected);assert.equal(baseline.first.fireteamSpecialDice,0)
const base={...imported,source,settings:{...imported.settings,weapon:da.id,aro:da.aro}}
const exposed=await calculateWorkbench({...base,settings:{...base.settings,cover2:false}})
assert.ok(exposed.selected.effect.onePlus>da.effect.onePlus)
const wounded=await calculateWorkbench({...base,settings:{...base.settings,wounds2:1}})
assert.ok(wounded.selected.effect.neutralize>da.effect.neutralize)
const nwi=await calculateWorkbench({...base,settings:{...base.settings,state2:'nwi'}})
assert.ok(nwi.selected.effect.dead>wounded.selected.effect.dead);assert.equal(nwi.selected.effect.unconscious,0)
const frozen=await calculateWorkbench({...base,settings:{...base.settings,weapon:'auto',aro:'auto',state2:'imm-b'}})
assert.equal(frozen.selected.aroType,'none')
const targeted=await calculateWorkbench({...base,settings:{...base.settings,state2:'targeted'}})
assert.equal(targeted.selected.attack.target,da.attack.target+3)
const linkable=source.profiles.find(p=>p.fireteamCapable)
assert.equal(prepareFighter(linkable,{...DEFAULT_MATCHUP_SETTINGS,linked1:true},1).fireteamSpecialDice,1)
assert.equal(prepareFighter(linkable,{...DEFAULT_MATCHUP_SETTINGS,linked1:true,state1:'isolated'},1).fireteamSpecialDice,0)
assert.throws(()=>prepareFighter(linkable,{...DEFAULT_MATCHUP_SETTINGS,wounds1:100},1))
// Independent damage distribution: one normal hit, PS10 vs ARM0, no cover.
const target={vitality:1,arm:0,bts:0,skills:[],equipment:[],remainingWounds:1}
const effect=effectDetails(new Map([['0:0',0.2],['1:0',0.8]]),{power:10,ammo:'N',save:'ARM',saves:1},target,false)
close(effect.onePlus,0.4);close(effect.unconscious,0.4);close(effect.dead,0);close(effect.distribution.reduce((a,b)=>a+b),1)
const critical=effectDetails(new Map([['1:1',1]]),{power:10,ammo:'N',save:'ARM',saves:1},target,false)
close(critical.onePlus,0.75);close(critical.dead,0.25)
const em=effectDetails(new Map([['1:0',1]]),{power:10,ammo:'E/M',save:'BTS',nonLethal:true}, {...target,troopType:'TAG'},false)
assert.equal(em.onePlus,0);close(em.neutralize,0.75);assert.deepEqual(em.states,['isolated','immobilized'])
const spot=effectDetails(new Map([['1:0',1]]),{power:10,ammo:'AP',save:'BTS',nonLethal:true,states:['targeted']},target,false)
assert.equal(spot.neutralize,0);assert.ok(spot.stateProbability>0)
const fake={effect:{...effect,durability:1},disposable:null};const orders=repeatedOrderOdds(fake,target);close(orders[0],0.4);close(orders[1],0.64);close(orders[2],0.784)
assert.equal(repeatedOrderOdds({...fake,disposable:2},target),null)
const attrition={...fake,roll:{},retaliation:{distribution:[0.5,0.5],durability:1}}
close(repeatedOrderOdds(attrition,target)[1],0.44)
close(repeatedOrderOdds({...attrition,roll:{simultaneous:true}},target)[1],0.52)
const khd=source.profiles.find(p=>p.equipment.includes('Killer Hacking Device')),hd=source.profiles.find(p=>p.equipment.includes('Hacking Device'))
const hacking=await calculateWorkbench({modelOne:khd.id,modelTwo:hd.id,settings:{kind:'hacking',weapon:'Trinity',aro:'Reset'},source})
assert.ok(hacking.selected);assert.equal(hacking.selected.attack.burst,3);assert.equal(hacking.selected.attack.target,khd.wip+3)
const firewall=await calculateWorkbench({modelOne:khd.id,modelTwo:hd.id,settings:{kind:'hacking',weapon:'Trinity',aro:'Reset',firewall2:6},source})
assert.equal(firewall.selected.attack.target,hacking.selected.attack.target-6);close(firewall.selected.save[0].failureProbability,hacking.selected.save[0].failureProbability-0.15)
assert.ok(firewall.selected.effect.onePlus<hacking.selected.effect.onePlus)
const upgrade=(pattern)=>source.profiles.find(p=>p.equipment.some(x=>x.includes(pattern)))
assert.equal(hackingPrograms(upgrade('Trinity (+1SD)'),source).find(p=>p.name==='Trinity').specialDice,1)
assert.equal(hackingPrograms(upgrade('Trinity (SR-2)'),source).find(p=>p.name==='Trinity').savingRollPenalty,2)
const multi=hackingPrograms(upgrade('Total Control (PS=3) UPGRADE: Trinity (PS=5)'),source)
assert.equal(multi.find(p=>p.name==='Total Control').power,3);assert.equal(multi.find(p=>p.name==='Trinity').power,5);assert.equal(multi.find(p=>p.name==='Carbonite').power,7)
const soldier=source.profiles.find(p=>p.ccWeapons.some(w=>!w.nonLethal)&&p.cc>=20)
const cc=await calculateWorkbench({modelOne:soldier.id,modelTwo:hd.id,settings:{kind:'cc'},source});assert.ok(cc.selected);assert.ok(cc.selected.attack.target>=20)
const comparison=await calculateWorkbench({...base,alternative:soldier.id,source});assert.equal(comparison.comparison.attacker.id,soldier.id)
for(const r of [baseline,wounded,nwi,hacking,firewall,cc,comparison])for(const b of r.bands)for(const c of b.candidates){for(const key of ['onePlus','twoPlus','threePlus','neutralize','unconscious','dead','stateProbability'])assert.ok(Number.isFinite(c.effect[key])&&c.effect[key]>=0&&c.effect[key]<=1.000001,`${key} bounded`);assert.ok(c.effect.onePlus>=c.effect.twoPlus);assert.ok(c.effect.twoPlus>=c.effect.threePlus);close(c.effect.distribution.reduce((a,b)=>a+b),1)}
const tmp=await mkdtemp(join(tmpdir(),'matchup-check-'));process.env.MATCHUP_STORAGE_PATH=tmp;process.env.BOT_FEEDBACK_PATH=join(tmp,'feedback')
try{
  let payload
  const interaction={user:{id:'123'},guildId:'456',options:{getString:n=>n==='model-1'?imported.modelOne:n==='model-2'?imported.modelTwo:null},deferReply:async()=>{},editReply:async p=>{payload=p}}
  await startWorkbench(interaction);assert.equal(payload.components.length,4)
  const id=payload.components[0].components[0].custom_id.split(':')[1]
  const handler=createWorkbenchInteractionHandler({logger:{error:()=>{}}})
  const control=(action,opts={})=>({customId:`lobo-matchup:${id}:${action}`,user:{id:'123'},guildId:'456',isButton:()=>true,isModalSubmit:()=>false,isStringSelectMenu:()=>false,deferUpdate:async()=>{},editReply:async p=>{payload=p},followUp:async p=>{payload=p},reply:async p=>{payload=p},showModal:async p=>{payload=p},...opts})
  await handler(control('swap'));assert.match(payload.embeds[0].title,/IGUANA/)
  await handler(control('settings'));assert.equal(payload.components.length,5);for(const row of payload.components)assert.ok(row.components[0].label.length<=45)
  await handler(control('view',{isButton:()=>false,isStringSelectMenu:()=>true,values:['explain']}));assert.ok(payload.embeds[0].fields.some(f=>f.name==='Roll and saving rolls'))
  await handler(control('save-submit',{isButton:()=>false,isModalSubmit:()=>true,fields:{getTextInputValue:()=> 'usual'}}));assert.match(payload.embeds[0].description,/Saved preset/)
  await handler(control('swap'))
  await handler(control('load-submit',{isButton:()=>false,isModalSubmit:()=>true,fields:{getTextInputValue:()=> 'usual'}}));assert.match(payload.embeds[0].title,/IGUANA/)
  const reported=await reportableResponse(workbenchPayload({id,view:'summary'},baseline),{requesterId:'123',guildId:'456',command:'combat'},{dir:join(tmp,'reports')});assert.equal(reported.components.length,5)
  await handler(control('swap',{user:{id:'789'}}));assert.equal(payload.ephemeral,true);assert.match(payload.content,/requester/)
  await handler(control('swap',{guildId:'987'}));assert.equal(payload.ephemeral,true)
  // All view payloads obey Discord component, field and option limits.
  for(const view of ['summary','ranges','ammo','aros','explain','orders']){const s={id,view,settings:baseline.settings};const p=workbenchPayload(s,baseline);assert.ok(p.components.length<=4);for(const row of p.components)for(const item of row.components){assert.ok(item.custom_id.length<=100);for(const opt of item.options||[]){assert.ok(opt.label.length<=100);assert.ok(opt.value.length<=100)}}for(const f of p.embeds[0].fields)assert.ok(f.value.length<=1024)}
}finally{await rm(tmp,{recursive:true,force:true})}
console.log('PASS - external matchup fixture, independent damage/critical probabilities, states, wounds, cover, Fireteams, hacking upgrades/Firewall, CC, repeated orders, comparisons, imports, Discord controls, presets and ownership.')
