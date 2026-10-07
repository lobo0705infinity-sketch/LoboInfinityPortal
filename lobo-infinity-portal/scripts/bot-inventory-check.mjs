import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {PermissionFlagsBits,ApplicationCommandManager} from 'discord.js'
import {collectBotInventory,refreshBotInventory,loadBotInventory,inventoryResponse,createBotInventoryHandler,inventoryAtStartup} from '../bot/bot-inventory.mjs'
import {createGroupedCommandHandler,GROUPED_COMMAND_DEFINITIONS,helpResponse} from '../bot/grouped-commands.mjs'
const dir=await mkdtemp(join(tmpdir(),'lobo-inventory-'))
const quiet={error(){}}
const denied=Object.assign(Error('secret upstream details'),{code:50013,status:403})
const map=(items,key='id')=>new Map(items.map(x=>[x[key],x]))
const human={id:'99',user:{id:'99',bot:false,username:'private human'}}
const member=(id,name,permissions=[])=>({id,user:{id,username:name,bot:true},displayName:name,guild:{id:'123'},roles:{cache:map([{id:'123',name:'everyone'},{id:`role-${id}`,name:'bot role'}])},permissions:{has:p=>permissions.includes(p)}})
const primary=member('1','Lobo’s Little Helper'),other=member('2','Other Bot',[PermissionFlagsBits.Administrator]),hidden=member('3','No managed role bot')
let active=0,maxActive=0
const messages=(channelId)=>map([{id:`${channelId}1`,author:{id:'1',username:'Lobo',bot:true},createdTimestamp:100,content:'PRIVATE MESSAGE'}, {id:`${channelId}2`,author:{id:'9',username:'League Publisher',bot:true},webhookId:'9',createdTimestamp:200,content:'WEBHOOK PRIVATE',embeds:[{title:'private title'}]}, {id:`${channelId}3`,author:human.user,content:'PRIVATE HUMAN'}])
const channel=(id,visible=true,permitted=true)=>({id,name:`channel-${id}`,viewable:visible,isTextBased:()=>true,permissionsFor:()=>({has:()=>permitted}),messages:{fetch:async()=>{active++;maxActive=Math.max(active,maxActive);await new Promise(r=>setTimeout(r,5));active--;return messages(id)}}})
const guild={id:'123',name:'League',client:{user:{id:'1'}},members:{cache:map([primary,human]),me:primary,fetch:async({user})=>user==='2'?other:primary,list:async()=>map([primary,other,hidden,human])},roles:{fetch:async()=>map([{id:'r1',name:'Lobo',tags:{botId:'1'}},{id:'r2',name:'Other',tags:{botId:'2'}}])},fetchWebhooks:async()=>map([{id:'9',name:'League Publisher',channelId:'11',url:'https://discord.com/api/webhooks/9/SECRET',token:'SECRET',owner:human.user,applicationId:null}]),channels:{fetch:async()=>map([channel('11'),channel('12'),channel('13',false)])}}
try{
  const report=await collectBotInventory(guild)
  assert.equal(report.memberListComplete,true);assert.equal(report.bots.length,3);assert.equal(report.webhooks.length,1)
  assert.equal(report.bots.find(x=>x.id==='2').elevatedPermissions[0],'Administrator')
  assert.ok(report.bots.find(x=>x.id==='1').functions.some(x=>/three-option/.test(x)))
  assert.equal(report.bots.find(x=>x.id==='2').ownership,'unverified');assert.equal(report.webhooks[0].observations.length,2)
  assert.equal(maxActive,2);assert.equal(report.checks.find(x=>x.source==='recent message sample').complete,false)
  assert.doesNotMatch(JSON.stringify(report),/SECRET|PRIVATE MESSAGE|PRIVATE HUMAN|private title|private human|api\/webhooks/)
  assert.match(report.decision,/No other publisher is proven redundant/)
  const limited=await collectBotInventory({...guild,members:{...guild.members,list:async()=>{throw denied}},fetchWebhooks:async()=>{throw denied}})
  assert.equal(limited.memberListComplete,false);assert.equal(limited.bots.length,2);assert.equal(limited.webhooks[0].id,'9')
  assert.ok(limited.checks.some(x=>x.source==='webhooks'&&!x.complete));assert.doesNotMatch(JSON.stringify(limited),/secret upstream/)
  let called=0
  const collect=async()=>{called++;await new Promise(r=>setTimeout(r,5));return report}
  await Promise.all([refreshBotInventory(guild,{dir,collect}),refreshBotInventory(guild,{dir,collect})]);assert.equal(called,1)
  assert.deepEqual(await loadBotInventory('123',{dir}),report)
  await assert.rejects(loadBotInventory('../bad',{dir}),/Invalid guild/)
  await writeFile(join(dir,'456.json'),JSON.stringify(report));await assert.rejects(loadBotInventory('456',{dir}),/another server/)
  const payload=inventoryResponse(report);assert.ok(payload.content.length<=2000);assert.equal(payload.files[0].name,'bot-inventory.json');assert.deepEqual(payload.allowedMentions.parse,[])
  class Interaction {
    #brand=true
    constructor(allowed=true,refresh=false){this.guildId='123';this.guild=guild;this.commandName='admin';this.memberPermissions={has:p=>allowed&&p===PermissionFlagsBits.ManageGuild};this.options={getSubcommand:()=> 'bots',getBoolean:()=>refresh}}
    isChatInputCommand(){return true}
    async reply(p){assert.ok(this.#brand);this.output=p}
    async deferReply(p){assert.ok(this.#brand);assert.equal(p.flags,64);this.deferred=true}
    async editReply(p){assert.ok(this.#brand);this.output=p}
  }
  let refreshed=0
  const handler=createBotInventoryHandler({load:async()=>report,refresh:async()=>{refreshed++;return report},logger:quiet})
  const route=createGroupedCommandHandler({handlers:{'bot-inventory':handler},logger:quiet})
  const no=new Interaction(false);await route(no);assert.equal(no.output.flags,64);assert.match(no.output.content,/Server managers/);assert.equal(no.deferred,undefined)
  const yes=new Interaction();await route(yes);assert.equal(yes.deferred,true);assert.equal(yes.output.files[0].name,'bot-inventory.json');assert.equal(refreshed,0)
  const fresh=new Interaction(true,true);await route(fresh);assert.equal(refreshed,1)
  const dm=new Interaction();dm.guildId=null;await route(dm);assert.equal(dm.output.flags,64)
  const stale=createBotInventoryHandler({load:async()=>({...report,at:'2000-01-01T00:00:00Z'}),refresh:async()=>{refreshed++;return report}})
  await createGroupedCommandHandler({handlers:{'bot-inventory':stale}})(new Interaction());assert.equal(refreshed,2)
  const fail=new Interaction();await createGroupedCommandHandler({handlers:{'bot-inventory':createBotInventoryHandler({load:async()=>{throw Error('disk')},refresh:async()=>{throw Error('SECRET')},logger:quiet})}})(fail);assert.match(fail.output.content,/could not be refreshed/);assert.doesNotMatch(fail.output.content,/SECRET/)
  const logs=[];await inventoryAtStartup({guilds:{cache:map([guild])}},{refresh:async()=>report,logger:{info:x=>logs.push(x),error:x=>logs.push(x)}})
  assert.match(logs[0],/Other Bot/);assert.doesNotMatch(logs[0],/SECRET|PRIVATE|api\/webhooks/)
  const admin=ApplicationCommandManager.transformCommand(GROUPED_COMMAND_DEFINITIONS.find(x=>x.name==='admin'))
  assert.equal(admin.default_member_permissions,PermissionFlagsBits.ManageGuild.toString());assert.equal(admin.options.find(x=>x.name==='bots').options[0].type,5)
  assert.match(helpResponse('admin',true).embeds[0].description,/admin bots/)
  console.log('PASS - bot/webhook separation, permission inventory, privileged-list fallback, limited coverage, two-request scan limit, secret exclusion, disk persistence, refresh deduplication and manager-only grouped command.')
}finally{await rm(dir,{recursive:true,force:true})}
