import assert from 'node:assert/strict'
import { readArtifact } from './benchmark-artifacts.mjs'
import { encodeArmyCode } from './infinity-army-encode.mjs'
import { decodeArmyCode } from './infinity-army-decode.mjs'
import { buildSubmittedProfiles, classifyTacticalBrief } from '../bot/inf-list-tactical.mjs'
import { rateSubmittedTeamOps } from '../bot/team-ops-ratings.mjs'
import { applyTeamOpsToUnit } from '../bot/team-ops-upgrades.mjs'
import { loadGunfighterBenchmarkCatalog } from '../bot/gunfighter-catalog-store.mjs'
import { loadAroBenchmarkCatalog } from '../bot/aro-catalog-store.mjs'
import { loadCloseCombatCatalog } from '../bot/close-combat-catalog-store.mjs'
import { loadMobilityCatalog } from '../bot/mobility-catalog-store.mjs'
const capture = await readArtifact('data/infinity-army/benchmark-official-source.json.gz.b64')
const payload = capture.payloads.find(p => p.url.endsWith('/205'))
const metadata = capture.metadata
const upgrade = attrs => [JSON.stringify(attrs)]
const members = [
  { unitId: 1928, groupId: 2, optionId: 2 },
  { unitId: 1928, groupId: 2, optionId: 2, modifiers: upgrade([{ type:'skill', id:156 }]) },
  { unitId: 1928, groupId: 1, optionId: 6 },
  { unitId: 1928, groupId: 1, optionId: 6, modifiers: upgrade([{ type:'stat', stat:'move0', q:15 }, { type:'stat', stat:'move1', q:10 }, { type:'skill', id:40, extra:[1] }]) },
  { unitId: 1928, groupId: 1, optionId: 6, modifiers: upgrade([{ type:'stat', stat:'cc', q:3 }, { type:'skill', id:24, extra:[1] }]) },
  { unitId: 1928, groupId: 3, optionId: 1, modifiers: upgrade([{ type:'skill', id:213 }]) },
]
let upgradeCases = 0
for (const roster of capture.payloads) for (const team of roster.units.filter(u=>u.spectables)) {
  for (const group of team.profileGroups) for (const table of Object.values(team.spectables)) for (const item of table.items || []) {
    applyTeamOpsToUnit(team, { groupId:group.id, profileId:group.profiles[0].id, modifiers:upgrade(item.attrs) }, metadata, roster)
    upgradeCases++
  }
}
assert(upgradeCases > 100)
console.log(`Resolved ${upgradeCases} official Team-Ops upgrade/form combinations`)
const armyCode = encodeArmyCode({ sectorialId:205, sectorialSlug:'white-banner', combatGroups:[{members}] })
const decoded = decodeArmyCode(armyCode)
assert.deepEqual(decoded.combatGroups[0].members.map(m=>m.modifiers),members.map(m=>m.modifiers||[]))
const profiles = buildSubmittedProfiles({ armyCode, metadata, officialPayloads:[payload] })
assert(profiles[1].skills.includes('Marksmanship'))
assert(!profiles[0].skills.includes('Marksmanship'))
assert(profiles[3].skills.includes('Dodge (+3)'))
assert.deepEqual(profiles[3].mov,[6,4])
assert.equal(profiles[4].cc,profiles[2].cc+3)
assert(profiles[5].skills.includes('Tactical Awareness'))
const unit = payload.units.find(u=>u.id===1928)
assert.throws(()=>applyTeamOpsToUnit(unit,{...decoded.combatGroups[0].members[0],modifiers:upgrade([{type:'skill',id:999999}])},metadata,payload),/Unresolved/)
assert.throws(()=>applyTeamOpsToUnit(unit,{...decoded.combatGroups[0].members[0],modifiers:['oops']},metadata,payload))
const [gunfighterCatalog,aroCatalog,closeCombatCatalog,mobilityCatalog] = await Promise.all([loadGunfighterBenchmarkCatalog(),loadAroBenchmarkCatalog(),loadCloseCombatCatalog(),loadMobilityCatalog()])
assert(gunfighterCatalog && aroCatalog && closeCombatCatalog && mobilityCatalog)
const ratings = await rateSubmittedTeamOps({ decoded,profiles,metadata,payload,gunfighterCatalog,aroCatalog,closeCombatCatalog,mobilityCatalog })
assert(ratings.aroRatings.find(r=>r.rosterPosition===2).normal > ratings.aroRatings.find(r=>r.rosterPosition===1).normal, 'Marksmanship rerates ARO too')
for (const value of Object.values(profiles[3].upgradedMobile.normal)) assert(Number.isFinite(value), 'Mobile display values are finite')
const baseOnly = profiles.filter(p=>!p.modifiers.length)
const unchanged = await rateSubmittedTeamOps({ decoded, profiles:baseOnly, metadata,payload,gunfighterCatalog,aroCatalog,closeCombatCatalog,mobilityCatalog })
assert.deepEqual(unchanged.gunfighterRatings, (await import('../bot/gunfighter-benchmark-catalog.mjs')).rankArmyGunfighters(gunfighterCatalog,decoded,{limit:4}), 'Unmodified path remains identical')
// Exercise equipment, added weapons and additive stats independently of the selection above.
for (const attrs of [[{type:'equip',id:114}], [{type:'weapon',id:150}], [{type:'stat',stat:'bs',q:1},{type:'stat',stat:'arm',q:2}]]) {
  const m={...decoded.combatGroups[0].members[0],modifiers:upgrade(attrs)}
  const patched=applyTeamOpsToUnit(unit,m,metadata,payload)
  const physical=patched.profileGroups.find(g=>g.id===2).profiles[0]
  if(attrs[0].type==='equip') assert(physical.equip.some(e=>e.id===114))
  if(attrs[0].type==='weapon') assert(physical.weapons.some(w=>w.id===150))
  if(attrs[0].type==='stat') { assert.equal(physical.bs,unit.profileGroups[1].profiles[0].bs+1); assert.equal(physical.arm,unit.profileGroups[1].profiles[0].arm+2) }
}
const heavyBase=ratings.gunfighterRatings.find(r=>r.rosterPosition===1), heavyUpgrade=ratings.gunfighterRatings.find(r=>r.rosterPosition===2)
assert(heavyUpgrade.normal>heavyBase.normal,'Marksmanship increases the Heavy gunfighter rating')
const ccBase=ratings.closeCombatRatings.find(r=>r.rosterPosition===3), ccUpgrade=ratings.closeCombatRatings.find(r=>r.rosterPosition===5)
assert(ccUpgrade.rating>ccBase.rating,'CC and Martial Arts upgrade changes CC rating')
assert(profiles[3].upgradedMobility.scenarios.normalDodge.target===profiles[2].ph+3)
assert(profiles[3].upgradedMobility.score> (await import('../bot/mobility-lookup.mjs')).lookupMobility(mobilityCatalog,profiles[2].combinedId).score)
assert.equal(profiles[5].upgradedMobility.mov[0],profiles[5].mov[0])
const analysis=classifyTacticalBrief(profiles,{},ratings.gunfighterRatings,ratings.aroRatings,ratings.closeCombatRatings,mobilityCatalog)
const heavyRows=analysis.categories.gunfighters.filter(r=>r.combinedId===profiles[0].combinedId)
assert(heavyRows.some(r=>r.skills.includes('Marksmanship') && r.normal===heavyUpgrade.normal),'Correct upgrade displayed with its rating')
assert(heavyRows.some(r=>!r.skills.includes('Marksmanship') && r.normal===heavyBase.normal),'Base duplicate remains separate')
console.log('ARO', ratings.aroRatings.map(r=>[r.rosterPosition,r.normal,r.fireteam]))
console.log(JSON.stringify({heavy:{base:heavyBase.nonLinked,marksmanship:heavyUpgrade.nonLinked},lightDodge:profiles[3].upgradedMobility.scenarios.normalDodge,cc:{base:ccBase.rating,upgraded:ccUpgrade.rating}}))
console.log('PASS Team-Ops upgrades decode, apply per model, rerate guns/ARO/CC/mobility and retain duplicate identities')
