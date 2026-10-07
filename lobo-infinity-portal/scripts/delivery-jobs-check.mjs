import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {deliveryJobReport} from '../bot/delivery-jobs.mjs'
import {checkRulesResources,resourceStatePath,DEFAULT_STATE_PATH} from '../bot/rules-resource-watcher.mjs'
import {filterUnannouncedMapChanges,filterUnannouncedWorkshopChanges,formatMapAnnouncement} from '../bot/lobos-little-helper.mjs'
const dir=await mkdtemp(join(tmpdir(),'lobo-delivery-'))
const quiet={info(){},error(){}}
try {
  assert.equal(resourceStatePath({}),DEFAULT_STATE_PATH)
  assert.equal(resourceStatePath({RAILWAY_VOLUME_MOUNT_PATH:dir}),join(dir,'rules-resource-watcher.json'))
  assert.equal(resourceStatePath({RAILWAY_VOLUME_MOUNT_PATH:dir,INFINITY_RESOURCES_STATE_PATH:'/custom/state.json'}),'/custom/state.json')
  const statePath=resourceStatePath({RAILWAY_VOLUME_MOUNT_PATH:dir})
  const now=Date.parse('2026-10-07T02:00:00Z')
  const map=(id,created)=>({id,name:`Map ${id}`,created_at:created,json:{ObjectStates:[]},images:[]})
  let maps=[map(1,'2026-01-01T00:00:00Z')],sent=[],failSecond=true
  const channel={messages:{fetch:async()=>new Map(sent.map((content,i)=>[String(i),{author:{id:'bot'},content}]))},send:async content=>{if(content.includes('Map 3')&&failSecond)throw Error('Discord temporarily unavailable');sent.push(content)}}
  const onChange=async({changes})=>{for(const change of await filterUnannouncedMapChanges(channel,changes.added.map(item=>({kind:'added',item})),'bot'))await channel.send(formatMapAnnouncement(change))}
  const options={statePath,now:()=>now,workshopItemIds:[],fetchImpl:async()=>({ok:true,json:async()=>maps}),logger:quiet,onChange}
  assert.equal((await checkRulesResources(options)).status,'BASELINED')
  maps=[...maps,map(2,'2026-10-07T01:00:00Z'),map(3,'2026-10-07T01:00:00Z')]
  const unreadable={messages:{fetch:async()=>{throw Error('Missing Read Message History')}}}
  await assert.rejects(checkRulesResources({...options,onChange:async({changes})=>{await filterUnannouncedMapChanges(unreadable,changes.added.map(item=>({item})),'bot')}}),/posts are deferred/)
  assert.equal(JSON.parse(await readFile(statePath,'utf8')).maps.length,1,'failed history cannot advance the checkpoint')
  await assert.rejects(filterUnannouncedWorkshopChanges(unreadable,[{id:'workshop',updatedAt:1}],'bot'),/posts are deferred/)
  await assert.rejects(checkRulesResources(options),/temporarily unavailable/)
  assert.equal(sent.length,1);assert.equal(JSON.parse(await readFile(statePath,'utf8')).maps.length,1)
  failSecond=false
  assert.equal((await checkRulesResources({...options})).status,'CHANGED')
  assert.equal(sent.length,2,'retry sends the remaining announcement and skips the successful first send')
  assert.equal((await checkRulesResources({...options})).status,'UNCHANGED','a restarted check reuses persistent state')
  assert.equal(sent.length,2)
  const report=await deliveryJobReport({env:{RAILWAY_VOLUME_MOUNT_PATH:dir,DISCORD_BOT_TOKEN:'SECRET',INFINITY_RESOURCES_CHECK_INTERVAL_MS:'1000',INFINITY_MATCHMAKING_DIGEST_TIME_ZONE:'America/New_York',INFINITY_MATCHMAKING_DIGEST_HOUR:'9'}})
  assert.equal(report.jobs.find(x=>x.id==='maps-workshops').checkpoint.status,'SAVED')
  assert.equal(report.jobs.find(x=>x.id==='maps-workshops').intervalMs,60000)
  const daily=report.jobs.find(x=>x.id==='daily-matchmaking');assert.equal(daily.timeZone,'America/New_York');assert.equal(daily.hour,9)
  const league=report.jobs.find(x=>x.id==='portal-league-announcements');assert.equal(league.liveScheduleVerified,false);assert.equal(league.declaredMaintenanceMinutes,30)
  assert.doesNotMatch(JSON.stringify(report),/SECRET|BOT_TOKEN/)
  const absent=await deliveryJobReport({env:{RAILWAY_VOLUME_MOUNT_PATH:join(dir,'absent'),INFINITY_RESOURCES_ANNOUNCER_ENABLED:'false'}})
  assert.equal(absent.jobs.find(x=>x.id==='maps-workshops').enabled,false);assert.equal(absent.jobs.find(x=>x.id==='maps-workshops').checkpoint.status,'NOT_YET_SAVED')
  const corrupt=await deliveryJobReport({env:{},read:async()=>'{bad json'})
  assert.equal(corrupt.jobs.find(x=>x.id==='maps-workshops').checkpoint.status,'UNREADABLE')
  console.log('PASS - persistent watcher checkpoint, defer-on-history-failure, partial-send retry without duplicate, restart reuse, job ownership/cadence and secret-free status report.')
}finally{await rm(dir,{recursive:true,force:true})}
