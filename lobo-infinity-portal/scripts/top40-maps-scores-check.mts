import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { TOP40_ROUND_MAPS, TOP40_MAPS, applyTop40MapAssignments, withTop40RoundMaps } from '../shared/top40-round-maps.mjs'
import { getTop40ResultSides } from '../src/public/top40ResultsModel.ts'
import { buildPreparationAssignments, TOP40_EVENT_ID } from '../src/public/top40PreparationModel.ts'
import type { PublicEvent, PublicGame } from '../src/public/snapshotTypes.ts'
const plan=JSON.parse(readFileSync('shared/top40-launch-plan.json','utf8'))
const assignments=withTop40RoundMaps(plan.rounds)
assert.equal(assignments.filter(record=>record.map!=='TBD').length,5)
assert.equal(assignments.filter(record=>record.map==='TBD').length,9)
for(const map of TOP40_ROUND_MAPS) {
 assert.ok(existsSync('public'+map.download),map.download)
 const save=JSON.parse(readFileSync('public'+map.download,'utf8'))
 assert.equal(save.ObjectStates[0].Nickname,'SET_'+map.workshopLabel)
 assert.equal(assignments.find(r=>r.bracket===map.bracket&&r.bracketRound===map.round)?.map,map.workshopLabel)
}
assert.equal(TOP40_MAPS.length,5)
assert.ok(TOP40_MAPS.every(map=>map.round && map.mission!=='Data Harvest' && map.key!=='kestrel'),'Top 40 contains only assigned tournament maps')
assert.equal(assignments.find(r=>r.bracket==='Winners'&&r.bracketRound===3)?.map,"Lobo's Top 40 Winners Round 3 Map")
const event={id:TOP40_EVENT_ID,bracketMissions:plan.rounds,bracket:[]} as unknown as PublicEvent
const original=structuredClone(event)
const projection={eventId:TOP40_EVENT_ID,home:{event},bracket:{eventId:TOP40_EVENT_ID,missions:plan.rounds,matches:[{bracket:'Winners',bracketRound:2,status:'Active',playerA:'A',playerB:'B',deadline:'2026-11-08'}]},publicData:{event,games:[],armyLists:[]}}
const mapped=applyTop40MapAssignments(projection)
assert.deepEqual(event,original,'map display does not mutate the stored event')
assert.deepEqual(mapped.publicData.games,[])
assert.equal(mapped.bracket.matches[0].map,TOP40_ROUND_MAPS[1].workshopLabel)
assert.equal(mapped.bracket.matches[0].deadline,'2026-11-08')
assert.equal(buildPreparationAssignments(event,[]).filter(r=>r.maps[0]==='TBD').length,9,'fixed snapshot fallback uses TBD too')
const other={eventId:'other',publicData:{event:{id:'other'}}};assert.equal(applyTop40MapAssignments(other),other)
const game={player1:'Zhukov2',player1DisplayName:'Zhukov2',player1Faction:'Tohaa',player2:'Snakes / Lucas',player2DisplayName:'Snakes / Lucas',player2Faction:'Yu Jing',winner:'Snakes / Lucas',tp:'5–1',op:'5–4',vp:'150–93'} as PublicGame
assert.deepEqual(getTop40ResultSides(game),[
 {player:'Snakes / Lucas',name:'Snakes / Lucas',faction:'Yu Jing',result:'Winner',tp:'5',op:'5',vp:'150'},
 {player:'Zhukov2',name:'Zhukov2',faction:'Tohaa',result:'Defeated',tp:'1',op:'4',vp:'93'},
])
assert.equal(getTop40ResultSides({...game,winner:'Zhukov2'})[0].player,'Zhukov2')
assert.deepEqual(getTop40ResultSides({...game,winner:'Draw',tp:'2-2',op:'5—5',vp:'90–100'}).map(s=>[s.player,s.result,s.tp,s.vp]),[['Zhukov2','Draw','2','90'],['Snakes / Lucas','Draw','2','100']])
assert.ok(getTop40ResultSides({...game,winner:'Unknown'}).every(s=>s.result==='Result unavailable'&&s.tp==='—'))
assert.ok(getTop40ResultSides({...game,tp:'bad'}).every(s=>s.tp==='—'))
console.log('PASS: five assigned round maps, nine TBD slots, exact bag downloads, unchanged event progression, winner-first score ownership, draws and invalid scores.')

// Exercise the deployed GET handler: the API must agree with the UI and leave scores intact.
const { default: handler } = await import('../api/public-event-projection.mjs')
const oldFetch=globalThis.fetch
const oldFileId=process.env.TOP40_PUBLIC_PROJECTION_FILE_ID
process.env.TOP40_PUBLIC_PROJECTION_FILE_ID='test-public-projection'
const sourceProjection={...projection,publicData:{event,games:[game],armyLists:[]},generatedAt:'2026-11-01T19:00:00Z'}
globalThis.fetch=async()=>({ok:true,json:async()=>sourceProjection}) as unknown as Response
let body:any, status=0
const response={setHeader(){},status(code:number){status=code;return this},send(value:string){body=JSON.parse(value)},json(value:unknown){body=value}}
try {
 await handler({method:'GET',url:'/api/public-event-projection?eventId='+TOP40_EVENT_ID},response)
 assert.equal(status,200)
 assert.equal(body.projection.publicData.event.bracketMissions.filter((r:any)=>r.map==='TBD').length,9)
 assert.deepEqual(body.projection.publicData.games,[game],'map publication must not alter any score or result')
} finally {
 globalThis.fetch=oldFetch
 if(oldFileId===undefined)delete process.env.TOP40_PUBLIC_PROJECTION_FILE_ID
 else process.env.TOP40_PUBLIC_PROJECTION_FILE_ID=oldFileId
}
console.log('PASS: public event API publishes the same five/TBD assignments without changing scores.')
