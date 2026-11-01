import assert from 'node:assert/strict'
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ChannelType } from 'discord.js'
import { createTop40Store,createTop40Notifications,TOP40_EVENT_ID,TOP40_SCHEDULING_CHANNEL_ID,TOP40_REMINDER_DELAY_MS,top40ActiveMatches,formatTop40Notification,resolveTop40DiscordContacts } from '../bot/top40-notifications.mjs'
import { AURORA_DISCORD_GUILD_ID } from '../shared/aurora-registration.mjs'

const dir=await mkdtemp(join(tmpdir(),'top40-notifications-'))
try {
  let clock=Date.parse('2026-11-01T14:00:00Z'),historyUnavailable=false,failAfterSend=false,missing=false
  const ids=['111111111111111111','222222222222222222'],botId='333333333333333333',messages=new Map(),sent=[]
  let projection={eventId:TOP40_EVENT_ID,bracket:{eventId:TOP40_EVENT_ID,released:false,matches:[]},publicData:{event:{id:TOP40_EVENT_ID,participants:[{player:'Alpha',status:'Registered'},{player:'Beta',status:'Registered'}]}}}
  const match={eventId:TOP40_EVENT_ID,matchId:'W1-M2',bracket:'Winners',bracketRound:1,playerA:'Alpha',playerB:'Beta',status:'Active',mission:'Corporate Appropriation',map:'Map 1',activatedAt:new Date(clock).toISOString(),deadline:new Date(clock+7*86400000).toISOString()}
  projection.bracket.matches=[match]
  const channel={id:TOP40_SCHEDULING_CHANNEL_ID,name:'scheduling',guildId:AURORA_DISCORD_GUILD_ID,type:ChannelType.GuildText,isTextBased:()=>true,permissionsFor:()=>({has:()=>true}),messages:{fetch:async()=>{if(historyUnavailable)throw Error('History unavailable');return messages}},send:async p=>{sent.push(p);const message={id:String(sent.length),author:{id:botId},content:p.content,createdTimestamp:clock};messages.set(message.id,message);if(failAfterSend){failAfterSend=false;throw Error('Unknown network outcome')}return message}}
  const guild={ownerId:ids[0],members:{me:{},fetch:async id=>({user:{id,bot:false}})},commands:{fetch:async()=>({find:()=>null}),create:async()=>{}}}
  const client={user:{id:botId},channels:{fetch:async()=>channel},guilds:{cache:new Map([[AURORA_DISCORD_GUILD_ID,guild]])}}
  const store=createTop40Store(join(dir,'state.json'))
  const options={store,loadProjection:async()=>structuredClone(projection),resolveAccounts:async()=>new Map(missing?[['Alpha',ids[0]]]:[['Alpha',ids[0]],['Beta',ids[1]]]),now:()=>clock,logger:{info(){},error(){}}}
  let service=createTop40Notifications(options);await service.start(client,{schedule:false})
  assert.equal(sent.length,0,'Unreleased bracket must not send')
  projection.bracket.released=true;await Promise.all([service.tick(),service.tick(),service.tick()]);assert.equal(sent.length,1,'Concurrent polls send one launch notice')
  assert.deepEqual(sent[0].allowedMentions,{parse:[],users:ids,roles:[],repliedUser:false})
  assert.match(sent[0].content,/Corporate Appropriation/);assert.match(sent[0].content,/Map 1/);assert.match(sent[0].content,/<t:\d+:F>/)
  clock+=TOP40_REMINDER_DELAY_MS-1;await service.tick();assert.equal(sent.length,1,'Never remind before 72 hours')
  clock++;await service.tick();assert.equal(sent.length,2);assert.match(sent[1].content,/Have you been able to schedule/)
  await service.tick();assert.equal(sent.length,2)
  service=createTop40Notifications(options);await service.start(client,{schedule:false});assert.equal(sent.length,2,'Restart retains both delivery receipts')
  projection.bracket.matches=[{...match,matchId:'W2-M1',status:'Completed',winner:'Alpha'}];await service.tick();assert.equal(sent.length,2,'Completed game suppressed')
  projection.bracket.matches=[{...match,matchId:'W2-M2',status:'Pending'},{...match,matchId:'W2-M3',playerB:'BYE'},{...match,matchId:'W2-M4',status:'Conditional'}];await service.tick();assert.equal(sent.length,2,'Pending, byes and conditional reset suppressed')
  projection.bracket.matches=[{...match,matchId:'W2-M5',activatedAt:new Date(clock).toISOString(),deadline:new Date(clock+7*86400000).toISOString()}];missing=true;await service.tick();assert.equal(sent.length,2,'Unverified recipient blocks ping')
  missing=false;historyUnavailable=true;await service.tick();assert.equal(sent.length,2,'Unreadable history blocks send')
  historyUnavailable=false;failAfterSend=true;await service.tick();assert.equal(sent.length,3)
  await service.tick();assert.equal(sent.length,3,'Recovery finds the accepted message after uncertain send')
  projection.bracket.matches=[{...match,matchId:'W2-M6'}];await service.tick();assert.equal(sent.length,4,'Late first notice is one combined check')
  await service.tick();assert.equal(sent.length,4,'Combined late notice prevents duplicate day-three ping')
  const corruptPath=join(dir,'corrupt.json');await writeFile(corruptPath,'broken');await assert.rejects(createTop40Store(corruptPath).read());assert.equal(await readFile(corruptPath,'utf8'),'broken')
  assert.throws(()=>top40ActiveMatches({...projection,eventId:'other'},clock),/invalid/)
  assert.throws(()=>formatTop40Notification(match,[ids[0],ids[0]],'live'),/verified/)
  const replies=[];await service.handler({isChatInputCommand:()=>true,commandName:'top40',guildId:AURORA_DISCORD_GUILD_ID,user:{id:ids[1]},deferReply:async()=>{},editReply:async p=>replies.push(p.content)})
  assert.match(replies[0],/Only Lobo/)
  const memberA={id:ids[0],displayName:'Player A',user:{username:'alpha_exact',bot:false}},memberB={id:ids[1],displayName:'Player B',user:{username:'beta_exact',bot:false}}
  const contactGuild={members:{list:async()=>new Map([[ids[0],memberA],[ids[1],memberB]])}}
  const resolved=await resolveTop40DiscordContacts(contactGuild,{Alpha:'@ALPHA_EXACT',Beta:'Player B',Unknown:'alpha'})
  assert.equal(resolved.get('alpha'),ids[0]);assert.equal(resolved.get('beta'),ids[1]);assert(!resolved.has('unknown'),'No substring/fuzzy matching')
  const duplicateGuild={members:{list:async()=>new Map([[ids[0],{...memberA,displayName:'Same'}],[ids[1],{...memberB,displayName:'Same'}]])}}
  assert.equal((await resolveTop40DiscordContacts(duplicateGuild,{Alpha:'Same'})).size,0,'Ambiguous registered contacts are not guessed')
  // Identity evidence: nicknames alone cannot resolve an account.
  const identityService=createTop40Notifications({...options,store:createTop40Store(join(dir,'identity.json')),resolveAccounts:undefined,registeredPlayers:async()=>[]})
  await identityService.start(client,{schedule:false});assert.equal(identityService.summary().linked,0)
  service.stop();identityService.stop()
  console.log('PASS Top 40 launch pings, 72-hour checks, completed/pending/bye suppression, exact recipient scope, restart and concurrent deduplication, uncertain-send recovery, corrupt-ledger safety and owner-only account management.')
} finally {await rm(dir,{recursive:true,force:true})}
