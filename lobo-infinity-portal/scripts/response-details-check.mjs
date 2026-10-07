import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile,readdir,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve,join} from 'node:path'
import {withResponseDetails,prepareInteractiveResponse,loadResponseSnapshot,createDetailInteractionHandler,listActions,briefSummary} from '../bot/response-details.mjs'
import {reportableResponse} from '../bot/bot-feedback.mjs'
import {createInfListResponse,createInfListInteractionHandler} from '../bot/inf-list-command.mjs'
import {readArtifact} from './benchmark-artifacts.mjs'
import {buildRandomListResponse} from '../bot/random-list-command.mjs'
import {generateRandomArmyList} from '../bot/random-list-generator.mjs'
import {LIVE_ROSTER_UNIT_SLUGS} from '../bot/official-army-rosters.mjs'
import {createMatchupInteractionHandler} from '../bot/matchup-command.mjs'
const dir=await mkdtemp(join(tmpdir(),'lobo-details-'))
const quiet={error(){}}
const context={guildId:'guild',requesterId:'owner',command:'list',inputs:[{name:'army-code',value:'QUJDRA=='}]}
process.env.BOT_RESPONSE_PATH=join(dir,'details');process.env.BOT_FEEDBACK_PATH=join(dir,'feedback')
class Button {
  #brand=true
  constructor(customId,guildId='guild') {this.customId=customId;this.guildId=guildId;this.user={id:'owner'};this.client={user:{id:'bot'}};this.message={author:{id:'bot'},url:'https://discord.com/channels/guild/channel/message'};this.outputs=[]}
  isButton(){return true}
  async deferReply(options){assert.ok(this.#brand);assert.equal(options.flags,64);assert.ok(!this.deferred);this.deferred=true}
  async editReply(payload){assert.ok(this.#brand);this.outputs.push(payload)}
  async followUp(payload){assert.ok(this.#brand);this.outputs.push(payload)}
}
const buttons=p=>p.components.flatMap(row=>row.components)
const find=(p,label)=>buttons(p).find(x=>x.label===label).custom_id
try {
  const classifiedCoverage={possible:1,total:20,cards:Array.from({length:20},(_,i)=>({name:`Card ${i+1}`,possible:i===0,eligible:[{unitName:'Test specialist'}],number:i+1,requirement:'Specialist'}))}
  const analysis={categories:{gunfighters:[{unitName:'Test',profileName:'Rifle',nonLinked:{grade:'A',rating:45,percentile:85,weaponsUsed:[]},fireteamLinked:{grade:'S',rating:60,percentile:97,weaponsUsed:[]}}],closeCombat:[],valuableAro:[],disposableAro:[]}}
  const render=async()=>({officialArmyUrl:'https://infinitytheuniverse.com/army',legality:{},readableImageBuffer:Buffer.from('readable'),tacticalPages:[{imageBuffer:Buffer.from('tactical')}],tacticalAnalysis:analysis,classifiedCoverage})
  const raw=await createInfListResponse({armyCode:'QUJDRA==',render})
  const compact=await reportableResponse(raw,context)
  assert.deepEqual(compact.files.map(x=>x.name),['infinity-army-list-readable.png'])
  assert.equal(compact.embeds.length,0);assert.match(compact.content,/Test: A alone \/ S linked/)
  assert.deepEqual(buttons(compact).map(x=>x.label),['Tactical Brief','Ratings','Classifieds','TTS Notes','Create ID Sheet','Report incorrect answer'])
  assert.ok(compact.components.every(row=>row.components.length<=5));assert.ok(compact.components.length<=5)
  // Reload from disk through a new handler, as happens after deployment/restart.
  const handler=createDetailInteractionHandler({handlers:{},report:reportableResponse,logger:quiet})
  for(const [label,name] of [['Tactical Brief','infinity-army-tactical-brief.png'],['Ratings','rating-explanations.txt']]) {
    const i=new Button(find(compact,label));assert.equal(await handler(i),true);assert.equal(i.outputs[0].files[0].name,name)
    const id=find(i.outputs[0],'Report incorrect answer').split(':')[1]
    const saved=JSON.parse(await readFile(join(dir,'feedback','contexts',`${id}.json`),'utf8'))
    assert.equal(saved.detail,label==='Ratings'?'ratings':'tactical');assert.equal(saved.sourceMessageUrl,i.message.url)
  }
  const cards=new Button(find(compact,'Classifieds'));await handler(cards)
  assert.equal(cards.outputs[0].embeds.flatMap(x=>x.fields||[]).length,20)
  const foreign=new Button(find(compact,'Ratings'),'other');await handler(foreign);assert.match(foreign.outputs[0].content,/could not be loaded/)
  const forged=new Button(find(compact,'Ratings'));forged.message.author.id='other';assert.equal(await handler(forged),false);assert.equal(forged.deferred,undefined)
  const key=find(compact,'Ratings').split(':')[1];const snapshot=await loadResponseSnapshot(key)
  await assert.rejects(loadResponseSnapshot(key,{now:snapshot.at+7*86400000+1}),/expired/)
  const expired=new Button(find(compact,'Ratings'));await createDetailInteractionHandler({handlers:{},report:reportableResponse,logger:quiet,now:()=>snapshot.at+7*86400000+1})(expired);assert.match(expired.outputs[0].content,/expired/)
  assert.equal(await handler(new Button(find(compact,'Ratings')+':extra')),false)
  // Connected analysis reuses its exact code and produces a private compact result.
  const generated=await prepareInteractiveResponse(withResponseDetails({content:'Option',files:[]},{actions:listActions('QUJDRA==')}),context)
  let captured
  const actions=createDetailInteractionHandler({handlers:{'inf-list':createInfListInteractionHandler({render:async args=>{captured=args.input;return render()},logger:quiet}),'inf-id':async i=>{assert.equal(i.commandName,'inf-id');assert.equal(i.options.getString('army-code',true),'QUJDRA==');await i.deferReply();await i.editReply({content:'ID sheet',files:[{name:'id.png',attachment:Buffer.from('id')}]})}},report:reportableResponse,logger:quiet})
  const analyse=new Button(find(generated,'Analyse This List'));await actions(analyse);assert.equal(captured,'QUJDRA==');assert.equal(analyse.outputs[0].files.length,1);assert.ok(find(analyse.outputs[0],'Ratings'))
  const identify=new Button(find(generated,'Create ID Sheet'));await actions(identify);assert.equal(identify.outputs[0].files[0].name,'id.png')
  const source=await readArtifact(resolve(import.meta.dirname,'..','data','infinity-army','benchmark-official-source.json.gz.b64'))
  const payload=source.payloads.find(p=>p.url?.endsWith('/units/en/502'))
  const drawn=generateRandomArmyList({payload,metadata:source.metadata,sectorialId:502,rosterSlugs:LIVE_ROSTER_UNIT_SLUGS.get(502),points:300,swc:6,pickIndex:()=>0})
  const random=await prepareInteractiveResponse(await buildRandomListResponse({faction:'502',points:300,swc:6,getSource:async()=>({payload,metadata:source.metadata,faction:{id:502}}),generate:()=>drawn}),context)
  assert.match(random.content,/300 pts/);assert.doesNotMatch(random.content,/undefined/);assert.equal(random.embeds.length,0);assert.equal(random.files.length,1)
  const randomSnapshot=await loadResponseSnapshot(find(random,'Analyse This List').split(':')[1])
  assert.equal(randomSnapshot.actions.analyse.values['army-code'],drawn.code);assert.equal(randomSnapshot.views.classifieds.payload.embeds[0].fields.length,20)
  // Independent generated options keep independent action parameters.
  const options=await Promise.all(['code1','code2','code3'].map(code=>prepareInteractiveResponse(withResponseDetails({content:code},{actions:listActions(code)}),context)))
  assert.equal(new Set(options.map(p=>find(p,'Analyse This List').split(':')[1])).size,3)
  for(let j=0;j<3;j++){const snap=await loadResponseSnapshot(find(options[j],'Analyse This List').split(':')[1]);assert.equal(snap.actions.analyse.values['army-code'],`code${j+1}`)}
  const interaction={commandName:'matchup',isChatInputCommand:()=>true,options:{getString:name=>name==='model-one'?'first':'second'},async deferReply(){this.deferred=true},async editReply(p){this.output=p}}
  await createMatchupInteractionHandler({compare:async()=>({first:{id:'1:2:3:4:5',name:'First'},second:{id:'5:4:3:2:1',name:'Second'}}),render:async()=>[{name:'matchup.png',imageBuffer:Buffer.from('matchup')}]})(interaction)
  const matchup=await prepareInteractiveResponse(interaction.output,context)
  const targets=[]
  const counters=createDetailInteractionHandler({handlers:{'aro-counter':async i=>{targets.push(i.options.getString('target',true));await i.deferReply();await i.editReply({content:'Counters'})}},report:reportableResponse,logger:quiet})
  await counters(new Button(find(matchup,'Counters: Model 1')));await counters(new Button(find(matchup,'Counters: Model 2')))
  assert.deepEqual(targets,['1:2:3:4:5','5:4:3:2:1'])
  // Active action limit is bounded; failed actions release the slot.
  let release;const gate=new Promise(r=>release=r)
  const busy=createDetailInteractionHandler({handlers:{'inf-list':async()=>{await gate;throw Error('test failure')}},report:reportableResponse,logger:quiet})
  const a=busy(new Button(find(generated,'Analyse This List'))),b=busy(new Button(find(generated,'Analyse This List')))
  await new Promise(r=>setTimeout(r,20));const third=new Button(find(generated,'Analyse This List'));await busy(third);assert.match(third.outputs[0],/already running/);release();await Promise.all([a,b])
  const recovered=new Button(find(generated,'Analyse This List'));await busy(recovered);assert.doesNotMatch(recovered.outputs[0].content,/already running/)
  const fallback=new Button(find(compact,'Ratings'));await createDetailInteractionHandler({handlers:{},report:async()=>{throw Error('disk')},logger:quiet})(fallback);assert.equal(fallback.outputs[0].files[0].name,'rating-explanations.txt')
  const before=(await readdir(process.env.BOT_RESPONSE_PATH)).length
  await assert.rejects(prepareInteractiveResponse(withResponseDetails({content:'bad'},{actions:Object.fromEntries(Array.from({length:21},(_,i)=>[`a${i}`,{label:'Action',command:'inf-list',values:{}}]))}),context),/Too many/)
  assert.equal((await readdir(process.env.BOT_RESPONSE_PATH)).length,before)
  console.log('PASS - compact responses, all classifieds, durable private downloads, exact connected action inputs, reporting, expiry, permissions and bounded concurrency.')
} finally {delete process.env.BOT_RESPONSE_PATH;delete process.env.BOT_FEEDBACK_PATH;await rm(dir,{recursive:true,force:true})}
