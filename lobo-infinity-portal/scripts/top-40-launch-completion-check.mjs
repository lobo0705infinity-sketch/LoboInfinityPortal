import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { getTop40LivePublicData, mergeTop40LiveDataset } from '../src/services/top40LivePublicData.ts'
const plan=JSON.parse(fs.readFileSync('shared/top40-launch-plan.json','utf8'))
assert.equal(plan.plannedOpening,'2026-11-01T09:00:00-05:00')
assert.equal(new Date(plan.plannedOpening).toISOString(),'2026-11-01T14:00:00.000Z')
assert.equal(plan.releaseMode,'manual')
assert.equal(plan.rounds.length,14)
assert.ok(plan.rounds.every(r=>r.missionGeistId.startsWith('s18_')&&r.map))
const id='event-lobo-s-american-top-40', other={id:'other',name:'Untouched'}
const live={generatedAt:'2026-11-01T01:00:00Z',event:{id,name:'Released'},games:[{id:9,eventId:id}],armyLists:[]}
assert.deepEqual(mergeTop40LiveDataset('events',[other,{id,name:'Old'}],live),[other,live.event])
assert.deepEqual(mergeTop40LiveDataset('games',[{id:1,eventId:'other'},{id:8,eventId:id}],live),[{id:1,eventId:'other'},live.games[0]])
let calls=0
const originalFetch=globalThis.fetch
globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({success:true,projection:{eventId:id,generatedAt:live.generatedAt,publicData:live}})}}
await Promise.all([getTop40LivePublicData(true),getTop40LivePublicData()])
assert.equal(calls,1)
globalThis.fetch=async()=>({ok:true,json:async()=>({success:true,projection:{eventId:id,publicData:{...live,event:{id:'wrong'}}}})})
await assert.rejects(()=>getTop40LivePublicData(true),/event isolation/)
globalThis.fetch=originalFetch
let released=false, accepting, choices={}
const items=['Player','Opponent'].map(title=>({getTitle:()=>title,getType:()=> 'LIST',asListItem(){return this},setChoiceValues(values){choices[title]=values;return this},setRequired(){return this}}))
const form={setTitle(){return this},setDescription(){return this},getItems:()=>items,setAcceptingResponses(v){accepting=v},getId:()=> 'fixture',getPublishedUrl:()=> 'https://example.test',getTitle:()=> 'Top40',collectsEmail:()=>false,isAcceptingResponses:()=>accepting,getDestinationId:()=> 'fixture',getResponses:()=> []}
const formCtx=vm.createContext({FormApp:{openById:()=>form,ItemType:{LIST:'LIST'}},LIF_FORMS:{PROPERTIES:{TOP40_FORM_ID:'fixture'},FORM_TITLES:{TOP40:'Top40'},FIELDS:{PLAYER:'Player',OPPONENT:'Opponent'}},lifRequireProperty_:()=> 'fixture',getEventRegistrationRows:()=>Array.from({length:25},(_,i)=>({status:'Registered',player:`Player ${i+1}`})),readEventBracketMatches_:()=>released?[{activatedAt:'2026-11-01T14:00:00Z'}]:[]})
vm.runInContext(fs.readFileSync('backend/Top40Form.gs','utf8'),formCtx)
formCtx.refreshTop40GameSubmissionForm();assert.equal(accepting,false);assert.equal(choices.Player.length,25);assert.equal(choices.Opponent.length,25)
formCtx.refreshTop40GameSubmissionForm(true);assert.equal(accepting,true)
released=true;formCtx.refreshTop40GameSubmissionForm();assert.equal(accepting,true)
let unlocked=false
const seedCtx=vm.createContext({getEventById:()=>({type:'Individual Double Elimination'}),LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){unlocked=true}})},readEventBracketMatches_:()=>[{}]})
vm.runInContext(fs.readFileSync('backend/EventManagerApi.gs','utf8'),seedCtx)
assert.throws(()=>seedCtx.saveEventManagerSeeding_(id,'[]',{}),/Seeding is locked/);assert.equal(unlocked,true)
console.log('PASS launch: 9am EST, complete ITS18 pool, event isolation/coherent results, deduplicated polling, 25-player form release gate, prepared seed lock.')
