import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ApplicationCommandManager, CommandInteractionOptionResolver, Collection, PermissionFlagsBits } from 'discord.js'
import { GROUPED_COMMAND_DEFINITIONS, createGroupedCommandHandler, createHelpInteractionHandler, ensureGroupedCommands, helpResponse } from '../bot/grouped-commands.mjs'
import { createInfIdInteractionHandler } from '../bot/inf-id-command.mjs'
import { createBuildListInteractionHandler, createBuildListAutocompleteHandler } from '../bot/build-list-command.mjs'
import { createMatchmakingInteractionHandler, createMatchmakingAutocompleteHandler } from '../bot/matchmaking-command.mjs'
import { createBotFeedbackHandler, installFeedbackCapture } from '../bot/bot-feedback.mjs'
const quiet = {error() {}}
const leaf = (name, value, focused=false) => ({name,type:typeof value==='number'?4:3,value,...(focused?{focused:true}:{})})
const nested = (sub, values=[], group=null) => group ? [{name:group,type:2,options:[{name:sub,type:1,options:values}]}] : [{name:sub,type:1,options:values}]
class Interaction {
  #owner = true
  constructor(commandName, sub, values=[], group=null, autocomplete=false) {
    this.commandName=commandName; this.guildId='guild'; this.user={id:'user'}; this.client={user:{id:'bot'}}
    this.options=new CommandInteractionOptionResolver(this.client,nested(sub,values,group),{})
    this.autocomplete=autocomplete;this.responses=[];this.memberPermissions={has:()=>false}
  }
  isChatInputCommand() {return !this.autocomplete}
  isAutocomplete() {return this.autocomplete}
  async deferReply() {assert.ok(this.#owner);this.deferred=true}
  async editReply(payload) {assert.ok(this.#owner);this.responses.push(payload)}
  async followUp(payload) {assert.ok(this.#owner);this.responses.push(payload)}
  async reply(payload) {assert.ok(this.#owner);this.replied=true;this.responses.push(payload)}
  async respond(choices) {assert.ok(this.#owner);this.choices=choices}
}
// Validate the actual SDK-transformed API shape and every inherited input.
for(const definition of GROUPED_COMMAND_DEFINITIONS) {
  const api=ApplicationCommandManager.transformCommand(definition)
  assert.equal(api.name,definition.name)
  const check = options => {for(const o of options||[]){assert.ok(o.name.length<=32);assert.ok(o.description.length<=100);assert.ok((o.options||[]).length<=25);check(o.options)}}
  assert.ok(api.description.length<=100);check(api.options)
  if(api.name==='admin')assert.equal(api.default_member_permissions,PermissionFlagsBits.ManageGuild.toString())
}
const calls=[]
const aliases=['inf-list','build-list','random-list','inf-id','matchup','aro-counter','availability','find-game','bot-reports']
const spy=alias=>async i=>{assert.equal(i.commandName,alias);await i.deferReply();await i.editReply({content:alias});calls.push(alias);return true}
const route=createGroupedCommandHandler({handlers:Object.fromEntries(aliases.map(alias=>[alias,spy(alias)])),autocompleteHandlers:Object.fromEntries(aliases.map(alias=>[alias,async i=>{assert.equal(i.commandName,alias);await i.respond([{name:alias,value:alias}]);return true}])),logger:quiet})
for(const [command,sub,group,alias] of [
  ['list','analyse',null,'inf-list'],['list','build',null,'build-list'],['list','random',null,'random-list'],['list','identify',null,'inf-id'],
  ['combat','matchup',null,'matchup'],['combat','counters',null,'aro-counter'],
  ['play','set','availability','availability'],['play','show','availability','availability'],['play','clear','availability','availability'],
  ['play','now','find','find-game'],['play','close','find','find-game'],['admin','reports',null,'bot-reports'],
]){
  const i=new Interaction(command,sub,[],group);assert.equal(await route(i),true);assert.equal(i.responses[0].content,alias);assert.equal(i.deferred,true)
  if(!['analyse','identify','reports','show','clear','close'].includes(sub)){const a=new Interaction(command,sub,[],group,true);assert.equal(await route(a),true);assert.equal(a.choices[0].value,alias)}
}
assert.equal(await route(new Interaction('rules','')),false,'legacy commands are handled only by their existing listeners')
// Use real handlers with a real SDK option resolver. Generation gets exactly
// the user's selected models and returns all three responses, files intact.
let received
const output=[1,2,3].map(n=>({content:`Option ${n}`,files:[{name:`army-${n}.json`,attachment:Buffer.from('{}')}]}))
const build=createBuildListInteractionHandler({build:async opts=>{received=opts;return output},logger:quiet})
const autocomplete=createBuildListAutocompleteHandler({searchFaction:async q=>[{name:q,value:'502'}],logger:quiet})
const realRoute=createGroupedCommandHandler({handlers:{'build-list':build},autocompleteHandlers:{'build-list':autocomplete},logger:quiet})
const buildInput=new Interaction('list','build',[leaf('faction','Corregidor'),leaf('mission','Hardlock'),leaf('must-include','Jazz, Iguana'),leaf('model-2','ALGUACIL'),leaf('points',300)])
await realRoute(buildInput);assert.deepEqual(received.mustInclude,['Jazz','Iguana','ALGUACIL']);assert.equal(received.points,300);assert.deepEqual(buildInput.responses,output)
const auto=new Interaction('list','build',[leaf('faction','Cor',true)],null,true);await realRoute(auto);assert.equal(auto.choices[0].name,'Cor')
// Identification still forwards the code and returns the PNG/PDF files,
// using the same handler and cleanup path. Rendering itself is unchanged.
let idInput, cleaned
const idResult={pages:[{buffer:Buffer.from('png'),name:'identification.png'}],pdf:{buffer:Buffer.from('pdf'),name:'identification.pdf'},missingImageCount:0}
const identify=createInfIdInteractionHandler({generate:async opts=>{idInput=opts.input;return idResult},cleanup:async result=>{cleaned=result},logger:quiet})
const identifyRoute=createGroupedCommandHandler({handlers:{'inf-id':identify},logger:quiet})
const idInteraction=new Interaction('list','identify',[leaf('army-code','QUJDRA==')]);await identifyRoute(idInteraction)
assert.equal(idInput,'QUJDRA==');assert.equal(cleaned,idResult);assert.deepEqual(idInteraction.responses[0].files.map(x=>x.name),['identification.png','identification.pdf'])
// Availability mutations/read/clear remain correct through the nested group.
const records=[];let removed
const scheduling=createMatchmakingInteractionHandler({resolveChannel:async()=>({}),createStore:async()=>({upsert:async x=>records.push(x),load:async()=>records,remove:async(user,day)=>{removed={user,day};return 1}}),logger:quiet})
const schedulingRoute=createGroupedCommandHandler({handlers:{availability:scheduling},autocompleteHandlers:{availability:createMatchmakingAutocompleteHandler({zones:['America/New_York'],logger:quiet})},logger:quiet})
await schedulingRoute(new Interaction('play','set',[leaf('weekday','monday'),leaf('start','7 PM'),leaf('end','10 PM'),leaf('timezone','America/New_York')],'availability'));assert.equal(records.length,1);assert.equal(records[0].userId,'user')
const show=new Interaction('play','show',[],'availability');await schedulingRoute(show);assert.match(show.responses[0].content,/Monday/)
await schedulingRoute(new Interaction('play','clear',[leaf('weekday','monday')],'availability'));assert.deepEqual(removed,{user:'user',day:'monday'})
const zone=new Interaction('play','set',[leaf('timezone','New',true)],'availability',true);await schedulingRoute(zone);assert.ok(zone.choices.length>0)
// Feedback must keep the grouped name and nested inputs, not mutate them to
// the compatibility alias. The same user still receives three report buttons.
const dir=await mkdtemp(join(tmpdir(),'grouped-feedback-'))
try{
  process.env.BOT_FEEDBACK_PATH=dir
  const input=new Interaction('list','build',[leaf('faction','Corregidor'),leaf('mission','Hardlock')])
  installFeedbackCapture(input,{logger:quiet});await realRoute(input)
  assert.equal(input.commandName,'list');assert.equal(input.responses.length,3)
  for(const file of await readdir(join(dir,'contexts'))){const context=JSON.parse(await readFile(join(dir,'contexts',file),'utf8'));assert.equal(context.command,'list');assert.equal(context.inputs[0].name,'build');assert.equal(context.inputs[0].options[0].value,'Corregidor')}
  const adminRoute=createGroupedCommandHandler({handlers:{'bot-reports':createBotFeedbackHandler({dir,logger:quiet})},logger:quiet})
  const denied=new Interaction('admin','reports');await adminRoute(denied);assert.equal(denied.responses[0].flags,64);assert.match(denied.responses[0].content,/Server managers/)
  const allowed=new Interaction('admin','reports');allowed.memberPermissions={has:p=>p===PermissionFlagsBits.ManageGuild};await adminRoute(allowed);assert.equal(allowed.deferred,true);assert.match(allowed.responses[0].content,/0 recent reports/)
}finally{delete process.env.BOT_FEEDBACK_PATH;await rm(dir,{recursive:true,force:true})}
const help=createHelpInteractionHandler();const helpInput=new Interaction('help','');await help(helpInput);assert.equal(helpInput.responses[0].flags,64);assert.equal(helpInput.responses[0].components[0].components.length,4)
assert.equal(helpResponse('home',true).components[0].components.length,5)
let updated,denied
const button={isButton:()=>true,customId:'lobo-help:lists',message:{author:{id:'bot'}},client:{user:{id:'bot'}},guildId:'guild',memberPermissions:{has:()=>false},update:async x=>{updated=x},reply:async x=>{denied=x}}
await help(button);assert.match(updated.embeds[0].description,/\/list analyse/)
await help({...button,customId:'lobo-help:admin'});assert.equal(denied.flags,64)
assert.equal(await help({...button,message:{author:{id:'another-bot'}}}),false)
for(const topic of ['lists','combat','reference','play','admin'])assert.ok(helpResponse(topic,true).embeds[0].description.length<4096)
assert.match(helpResponse('reference').embeds[0].description,/\/mission scenario:/)
// Registration is additive and idempotent, including snake/camel API fields.
const registry=new Collection([['legacy',{name:'inf-list',id:'legacy'}]])
let creates=0,edits=0
const sdkOption=o=>{const {max_length,...rest}=o;return {...rest,...(max_length?{maxLength:max_length}:{}),options:o.options?.map(sdkOption)}}
const guild={id:'guild',commands:{fetch:async()=>registry,create:async d=>{creates++;const c={...d,id:d.name,options:d.options?.map(sdkOption),defaultMemberPermissions:d.defaultMemberPermissions?{bitfield:BigInt(d.defaultMemberPermissions)}:null,edit:async definition=>{edits++;Object.assign(c,definition);return c}};registry.set(d.name,c);return c}}}
const client={guilds:{cache:new Collection([['guild',guild]])}}
await ensureGroupedCommands(client);await ensureGroupedCommands(client);assert.equal(creates,5);assert.equal(edits,0);assert.ok(registry.has('legacy'))
registry.get('list').options[0].options[0].maxLength=1
await ensureGroupedCommands(client);assert.equal(edits,1,'input schema changes update the existing grouped command')
console.log('PASS - grouped SDK routing, autocomplete, three-list output, scheduling, help permissions, feedback and additive registration.')
