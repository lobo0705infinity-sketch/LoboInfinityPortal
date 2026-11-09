import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { calculatePortalElo, campaignEloGames, ratingBand } from '../shared/portal-elo.mjs'
import { loadRatingSnapshot, loadMetaRatings, matchRatingMembers, syncRatingRoles, createPlayerRatings } from '../bot/player-ratings.mjs'
import { createTop40Store } from '../bot/top40-notifications.mjs'
import { createCampaignGameStore } from '../bot/aurora-game-store.mjs'
import { AURORA_DISCORD_GUILD_ID } from '../shared/aurora-registration.mjs'
const g = (id,winner='A',date='2026-01-01') => ({id,player1:'A',player2:'B',winner,date})
const first = calculatePortalElo([g(1)])
assert.equal(first.leaderboard[0].elo,1516);assert.equal(first.leaderboard[1].elo,1484)
assert.equal(calculatePortalElo([g(1,'Draw')]).leaderboard[0].elo,1500)
assert.deepEqual(calculatePortalElo([g(2,'B'),g(1)]),calculatePortalElo([g(1),g(2,'B')]))
assert.deepEqual(calculatePortalElo([g(1),g(1)]),first)
assert.throws(()=>calculatePortalElo([g(1),g(1,'B')]),/Conflicting/)
assert.throws(()=>calculatePortalElo([g(1,'unknown')]),/Invalid/)
assert.throws(()=>calculatePortalElo([g(1,'A','2026-02-31')]),/Invalid/)
assert.throws(()=>calculatePortalElo([{...g(1),player2:'a'}]),/Invalid/)
assert.equal(calculatePortalElo([g(1,'B')]).leaderboard[0].player,'B')
assert.equal(calculatePortalElo([]).gameCount,0)
assert.equal(calculatePortalElo([g(1),g(2,'B')]).leaderboard.reduce((s,p)=>s+p.rating,0),3000)
const upset=calculatePortalElo([...Array.from({length:8},(_,i)=>g(i)),g(8,'B')]);assert.ok(upset.history.at(-1).change < -16)
assert.deepEqual([999,1000,1399,1400,1599,1600,2200].map(ratingBand),['Under 1000','1000–1199','1200–1399','1400–1599','1400–1599','1600–1799','2200+'])
const campaign={id:'c',date:'2026-01-02',playerA:{name:'A',id:'10000000000000001'},playerB:{name:'B',id:'10000000000000002'},opA:7,opB:1,status:'confirmed'}
assert.equal(calculatePortalElo([...first.history.map(h=>g(h.id)),...campaignEloGames([campaign])]).gameCount,2)
assert.equal(campaignEloGames(['awaiting_confirmation','rejected','correction_requested','awaiting_late_approval'].map(status=>({...campaign,status}))).length,0)
assert.equal(campaignEloGames([{...campaign,late:true}]).length,0)
assert.equal(campaignEloGames([{...campaign,duplicateOf:'x'}]).length,0)
assert.ok(!JSON.stringify(campaignEloGames([{...campaign,notes:'PRIVATE',photos:['private']}])).includes('PRIVATE'))
const response=data=>({ok:true,json:async()=>data})
await assert.rejects(loadRatingSnapshot(async url=>response(String(url).endsWith('current.json')?{snapshotId:'20261109T050305Z',basePath:'public-snapshots/20261109T050305Z/',sourceCutoff:'x'}:{snapshotId:'different',sourceCutoff:'x',data:[]})),/generations/)
await assert.rejects(loadMetaRatings(async()=>response({run:{run_id:'one'},total:2,rows:[{person_id:'a',name:'A',rating:1500},{person_id:'a',name:'B',rating:1600}]})),/incomplete/)
let calls=0
await assert.rejects(loadMetaRatings(async()=>response({run:{run_id:++calls===1?'one':'two'},total:2,rows:[{person_id:String(calls),name:'A',rating:1500}]})),/changed/)
const member=(id,name)=>({id,displayName:name,user:{username:name,globalName:name,bot:false},roles:{cache:new Map()}})
let a=member('10000000000000001','A'),b=member('10000000000000002','A')
assert.equal(matchRatingMembers([a,b],[{player:'A'}]).matches.size,0)
assert.equal(matchRatingMembers([a,b],[{player:'A'}],{a:{userId:a.id}}).matches.size,1)
assert.equal(matchRatingMembers([a],[{player:'A'},{player:'Other',displayName:'A'}]).matches.size,0)
assert.equal(matchRatingMembers([a],[{player:'AA'}]).matches.size,0)
const changes=[];const unrelated={id:'other',name:'Admin',permissions:{bitfield:8n},editable:true}
const old={id:'old',name:'Portal ELO 1400–1599',permissions:{bitfield:0n},editable:true,managed:false}
const roles=new Map([[old.id,old],[unrelated.id,unrelated]])
a.roles.cache=new Map([[old.id,old],[unrelated.id,unrelated]])
a.roles.add=async role=>{changes.push(['add',role.id]);a.roles.cache.set(role.id,role);return a}
a.roles.remove=async id=>{changes.push(['remove',id]);a.roles.cache.delete(id);return a}
const guild={members:{me:{permissions:{has:()=>true}}},roles:{fetch:async()=>roles,create:async input=>({...input,id:'new',editable:true,permissions:{bitfield:0n}})}}
const state={ratingRoles:{[old.name]:old.id}}
await syncRatingRoles(guild,[{member:a,source:'portal',rating:1700}],state,async()=>{})
assert.deepEqual(changes,[['add','new'],['remove','old']]);assert.ok(a.roles.cache.has('other'))
changes.length=0
await syncRatingRoles(guild,[{member:a,source:'portal',rating:1700}],state,async()=>{})
assert.deepEqual(changes,[])
await assert.rejects(syncRatingRoles({...guild,members:{me:{permissions:{has:()=>false}}}},[],state,async()=>{}),/Manage Roles/)
const dir=await mkdtemp(join(tmpdir(),'lobo-ratings-'))
try {
  const campaignStore=createCampaignGameStore(join(dir,'campaign.json'))
  assert.deepEqual(await campaignStore.ratingGames(),[])
  let failed=false
  const fakeGuild={...guild,members:{me:{permissions:{has:()=>false}},list:async()=>new Map()},commands:{fetch:async()=>({find:()=>undefined}),create:async()=>{}}}
  const service=createPlayerRatings({store:createTop40Store(join(dir,'roles.json')),loadSnapshot:async()=>{if(failed)throw Error('offline');return {snapshotId:'x',sourceCutoff:'2026-01-01',games:[g(1)],players:[]}},loadMeta:async()=>{throw Error('offline')},logger:{info(){},error(){}}})
  await service.start({guilds:{cache:new Map([[AURORA_DISCORD_GUILD_ID,fakeGuild]])}});await service.tick()
  // Discord/API failure must not prevent a valid Portal calculation.
  assert.equal(service.publicProjection().gameCount,1)
  assert.equal(service.summary().status,'attention')
  failed=true;await service.tick();assert.throws(()=>service.publicProjection(),/unavailable/)
  service.stop()
} finally {await rm(dir,{recursive:true,force:true})}
console.log('PASS player ratings: ELO outcomes, chronology, replay, corrections, deletion, campaign eligibility, source validation, identity ambiguity, permissions, role isolation/idempotence, and independent Portal availability.')
