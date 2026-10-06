import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readArtifact } from './benchmark-artifacts.mjs'
import { encodeArmyCode } from './infinity-army-encode.mjs'
import { appendTtsEmbed, exportTtsArmy, ttsDiscordAttachment } from '../bot/tts-2d-export.mjs'
import { createInfListResponse } from '../bot/inf-list-command.mjs'

const source = await readArtifact(fileURLToPath(new URL('../data/infinity-army/benchmark-official-source.json.gz.b64',import.meta.url)))
const payload = source.payloads.find(p=>p.url.endsWith('/502'))
const armyCode = 'gfYKY29ycmVnaWRvcgxORSBUb3VybmV5IDGBLAIBAQAJAIGlAQQAAACBpQEEAAAAh2gBCQAAAIEoAQEAAACGDwABAAAAgYsBBgAAAIGUAQEAAACBlAEDAAAAgRsBAQAAAgEABQCBqgEBAAAAgX8BAgAAAIdlAQEAAACBKAEKAAAAgZoBAQAA'
const result = exportTtsArmy({armyCode,payload,metadata:source.metadata})
assert.equal(result.modelCount,18,'duplicate Morans, Jazz/Billie, Koalas and Iguana Operator are preserved')
const saved = JSON.parse(result.file.attachment), bag = saved.ObjectStates[0]
assert.equal(bag.Name,'Bag')
assert.deepEqual(result.warnings,[])
assert.ok(result.file.attachment.length<100_000)
const models=bag.ContainedObjects
assert.equal(models.filter(o=>/^MORAN/.test(o.Nickname)).length,2)
assert.ok(models.some(o=>/BILLIE/.test(o.Nickname)))
assert.ok(models.some(o=>/IGUANA OPERATOR/.test(o.Nickname)))
const intruder=models.find(o=>/^INTRUDER/.test(o.Nickname))
assert.ok(Object.values(intruder.States).some(s=>s.Nickname==='Camouflage (-3) S2'))
const alguacil=models.find(o=>/^ALGUACIL/.test(o.Nickname))
assert.ok(Object.values(alguacil.States).some(s=>s.Nickname==='Silhouette 2'))
assert.ok(!Object.values(alguacil.States).some(s=>/Camouflage/.test(s.Nickname)))
const guids=new Set()
function verify(o) {
  assert.ok(!o.CustomAssetbundle,'no 3D sculpt bundles')
  assert.equal(o.LuaScript,''); assert.equal(o.LuaScriptState,'')
  assert.match(o.GUID,/^[a-f\d]{6}$/);assert.ok(!guids.has(o.GUID));guids.add(o.GUID)
  for(const s of Object.values(o.States||{}))verify(s)
  for(const s of o.AttachedObjects||[])verify(s)
}
models.forEach(verify)
const response=await createInfListResponse({armyCode,render:async()=>({ttsSource:{payload,metadata:source.metadata},officialArmyUrl:'https://example.test/army',readableImageBuffer:Buffer.from('png')}),withRenderSlot:fn=>fn()})
assert.equal(response.files.length,3)
assert.equal(response.files[0].name,'infinity-army-list-readable.png')
assert.ok(response.files[1].name.endsWith('-tts-2d.json'))
assert.equal(response.files[2].name,'tts-validation.txt')
assert.match(response.embeds.at(-1).description,/Saved Objects/)

// A missing art entry must retain the unit as a labelled proxy, using a
// verified silhouette size rather than dropping it or guessing its size.
const missingUnit={id:9999,name:'TEST MISSING UNIT',isc:'TEST MISSING UNIT',profileGroups:[{id:1,profiles:[{id:1,s:2,skills:[],weapons:[],equip:[]}],options:[{id:1,name:'TEST MISSING UNIT',skills:[],weapons:[],equip:[],points:10,swc:0}]}]}
const missingCode=encodeArmyCode({sectorialId:502,sectorialSlug:'corregidor',combatGroups:[{members:[{unitId:9999,groupId:1,optionId:1}]}]})
const missing=exportTtsArmy({armyCode:missingCode,payload:{units:[missingUnit]},metadata:source.metadata})
assert.equal(missing.modelCount,1)
assert.match(missing.saved.ObjectStates[0].ContainedObjects[0].Nickname,/2D silhouette proxy/)
assert.equal(missing.warnings.length,1)
assert.throws(()=>exportTtsArmy({armyCode:missingCode}),/No model or verified silhouette/)
const failed=ttsDiscordAttachment({armyCode:missingCode})
assert.deepEqual(failed.files,[]);assert.match(failed.text,/export unavailable/)

// Mercenary aliases use native catalogue IDs, without changing the code.
const mercCode=encodeArmyCode({sectorialId:502,sectorialSlug:'corregidor',combatGroups:[{members:[{unitId:10283,groupId:1,optionId:1}]}]})
const merc=exportTtsArmy({armyCode:mercCode})
assert.ok(merc.modelCount>=1)
assert.match(merc.saved.ObjectStates[0].ContainedObjects[0].Nickname,/McMURROUGH/)
console.log('PASS - TTS 2D export: bag import structure, repeats, composites, peripherals, markers, aliases, proxies and /inf-list attachment.')

const crowded=appendTtsEmbed([{description:'x'.repeat(5800)}],{text:'y'.repeat(1000)})
assert.equal(crowded.reduce((n,e)=>n+e.description.length,0),6000)
for (const [unitId,groupId,optionId,expected] of [[602,1,3,'Camouflage (0) S2'],[597,2,1,'Camouflage (-6) S2']]) {
  const code=encodeArmyCode({sectorialId:701,sectorialSlug:'aleph',combatGroups:[{members:[{unitId,groupId,optionId}]}]})
  const army=exportTtsArmy({armyCode:code})
  assert.ok(Object.values(army.saved.ObjectStates[0].ContainedObjects[0].States).some(state=>state.Nickname===expected))
}
const transformCode=encodeArmyCode({sectorialId:1001,sectorialSlug:'kosmoflot',combatGroups:[{members:[{unitId:1940,groupId:1,optionId:1}]}]})
const transform=exportTtsArmy({armyCode:transformCode})
assert.ok(Object.values(transform.saved.ObjectStates[0].ContainedObjects[0].States).some(state=>/IOANN BANN - DOG-WARRIOR/.test(state.Nickname)))

// Draw without replacement; every object and state keeps its owner's tint.
const drawSizes=[]
const colored=exportTtsArmy({armyCode,payload,metadata:source.metadata,pickColorIndex:length=>{drawSizes.push(length);return 0}})
assert.deepEqual(drawSizes,[8,7])
assert.deepEqual(colored.groupColors.map(group=>[group.combatGroup,group.name]),[[1,'Red'],[2,'Blue']])
function verifyTint(object,color) {
  assert.deepEqual(object.ColorDiffuse,color)
  for(const state of [...Object.values(object.States||{}),...(object.AttachedObjects||[]),...(object.ContainedObjects||[])])verifyTint(state,color)
}
for(const object of colored.saved.ObjectStates[0].ContainedObjects) {
  const combatGroup=Number(object.Nickname.match(/Group (\d+)/)[1])
  verifyTint(object,colored.groupColors.find(group=>group.combatGroup===combatGroup).color)
}
assert.match(colored.saved.ObjectStates[0].Description,/Group 1: Red · Group 2: Blue/)
const different=exportTtsArmy({armyCode,payload,metadata:source.metadata,pickColorIndex:length=>length-1})
assert.deepEqual(different.groupColors.map(group=>group.name),['Pink','Purple'])
const oneGroup=exportTtsArmy({armyCode:mercCode,pickColorIndex:()=>0})
assert.equal(oneGroup.groupColors.length,1)
const colorResponse=ttsDiscordAttachment({armyCode,payload,metadata:source.metadata,pickColorIndex:()=>0})
assert.match(colorResponse.text,/Group 1: Red · Group 2: Blue/)
console.log('PASS - randomized, distinct combat-group colors cover all models, peripherals, deployables and alternate states.')

// Representation copies retain artwork, states and group tint, with fresh GUIDs.
function representationArmy(unitId,optionId=1,quantity=1,extra={}) {
  const code=encodeArmyCode({sectorialId:701,sectorialSlug:'aleph',combatGroups:[{members:Array.from({length:quantity},()=>({unitId,groupId:1,optionId}))}]})
  return exportTtsArmy({armyCode:code,pickColorIndex:()=>0,...extra})
}
for (const [unitId,optionId,count] of [[615,1,1],[1901,3,2]]) {
  const army=representationArmy(unitId,optionId)
  assert.equal(army.decoyCount,count)
  assert.equal(army.modelCount,count+1)
  const objects=army.saved.ObjectStates[0].ContainedObjects
  for(let n=1;n<=count;n++)assert.ok(objects.some(o=>o.Nickname.endsWith(`Decoy ${n}`)))
  for(const object of objects){verify(object);verifyTint(object,army.groupColors[0].color)}
}
const holo=representationArmy(198,1,2)
assert.equal(holo.modelCount,6)
assert.equal(holo.hologramCount,4)
const sets=new Map()
for(const object of holo.saved.ObjectStates[0].ContainedObjects) {
  verify(object);verifyTint(object,holo.groupColors[0].color)
  const notes=JSON.parse(object.GMNotes)
  assert.equal(notes.representation,'holoprojector')
  assert.ok(object.Nickname.endsWith(` · ${notes.copy}`))
  for(const state of Object.values(object.States||{}))assert.ok(state.Nickname.endsWith(` · ${notes.copy}`))
  const copies=sets.get(notes.setId)||[];copies.push(object);sets.set(notes.setId,copies)
}
assert.equal(sets.size,2,'duplicate purchases have separate numbered sets')
for(const copies of sets.values()) {
  assert.deepEqual(copies.map(o=>JSON.parse(o.GMNotes).copy),[1,2,3])
  function artwork(object) {
    const {GUID,Nickname,GMNotes,...rest}=object
    if(rest.States)rest.States=Object.fromEntries(Object.entries(rest.States).map(([key,state])=>[key,artwork(state)]))
    if(rest.AttachedObjects)rest.AttachedObjects=rest.AttachedObjects.map(artwork)
    return rest
  }
  assert.deepEqual(artwork(copies[0]),artwork(copies[1]))
  assert.deepEqual(artwork(copies[0]),artwork(copies[2]))
}
// Official profiles override the artwork catalogue's old special rules.
const currentSforza={...missingUnit,id:198,name:'SFORZA',isc:'SFORZA'}
const ordinary=representationArmy(198,1,1,{payload:{units:[currentSforza]},metadata:source.metadata})
assert.equal(ordinary.modelCount,1)
assert.equal(ordinary.hologramCount,0)
const ruleMetadata={...source.metadata,
  skills:[...source.metadata.skills,{id:99001,name:'Decoy (2)'}],
  equips:[...source.metadata.equips,{id:99002,name:'Holoprojector'},{id:99003,name:'Holomask'}]}
function currentRules(skills,equip) {
  const unit=structuredClone(currentSforza)
  Object.assign(unit.profileGroups[0].profiles[0],{skills:skills.map(id=>({id})),equip:equip.map(id=>({id}))})
  return representationArmy(198,1,1,{payload:{units:[unit]},metadata:ruleMetadata})
}
const combined=currentRules([99001],[99002])
assert.equal(combined.modelCount,5)
assert.equal(combined.decoyCount,2)
assert.equal(combined.hologramCount,2)
assert.equal(currentRules([],[99003]).modelCount,1,'Holomask alone does not create holograms')
const extrasResponse=ttsDiscordAttachment({armyCode:encodeArmyCode({sectorialId:701,sectorialSlug:'aleph',combatGroups:[{members:[{unitId:198,groupId:1,optionId:1},{unitId:1901,groupId:1,optionId:3}]}]})})
assert.match(extrasResponse.text,/2 decoys · 2 Holoprojector copies/)
console.log('PASS - Decoy 1/2 counts, numbered Holoprojector sets, independent repeats, inherited artwork/tints, fresh GUIDs and current-rule overrides.')
