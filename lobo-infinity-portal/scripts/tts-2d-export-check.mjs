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
assert.equal(response.files.length,2)
assert.equal(response.files[0].name,'infinity-army-list-readable.png')
assert.ok(response.files[1].name.endsWith('-tts-2d.json'))
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
