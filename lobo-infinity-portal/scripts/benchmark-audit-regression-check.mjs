import assert from 'node:assert/strict'
import { buildAttackPool, evaluateGunfighterProfile, evaluateAroProfile, evaluateAttackCandidate, expectedEffectFromHits, benchmarkDefenderWeights, resolveFaceToFace } from '../bot/gunfighter-rating.mjs'
import { resolveOpposedPools, resolveWeaponEffect, buildCloseCombatPool } from '../bot/close-combat-benchmark.mjs'
import { buildGunfighterBenchmarkCatalog } from '../bot/gunfighter-benchmark-catalog.mjs'
import { buildAroBenchmarkCatalog, selectBenchmarkAttackers } from '../bot/aro-benchmark-catalog.mjs'
import { buildCloseCombatCatalog, lookupCloseCombatRatings, rankSubmittedCloseCombat } from '../bot/close-combat-catalog.mjs'
import { normalizeWeaponChartRow, weaponChartRecordToGunfighterWeapon, weaponChartFromArmyMetadata } from '../bot/infinity-weapon-chart.mjs'
import { buildCanonicalGunfighterProfiles } from '../bot/gunfighter-profile-canonicalizer.mjs'
import { buildCanonicalCloseCombatProfiles } from '../bot/close-combat-canonicalizer.mjs'

const mode = { name: 'Normal', burst: 3, power: 7, ammo: 'N', save: 'ARM', attackType: 'bs-attack', ranges: [{ min: 0, max: 96, modifier: 0 }] }
const weapon = { name: 'Fixture', modes: [mode] }
const p = { id: '1:1:1:1:1', sectorialId: 1, unitId: 1, groupId: 1, optionId: 1, profileId: 1, name: 'Fixture', bs: 12, cc: 20, ph: 10, wip: 12, arm: 0, bts: 0, vitality: 1, skills: [], equipment: [], weapons: [weapon] }
const range = { id: '0-8', min: 0, max: 8 }
const options = { cover: true, ranges: [range] }
const pool = (a = p, d = p, m = mode, mod = 0, aro = false, cover = true) => buildAttackPool(a, d, weapon, m, mod, 0, { cover }, { aro })
const candidate = (a = p, d = p, m = mode, extra = {}) => evaluateAttackCandidate({ attacker: a, defender: d, weapon, mode: m, range, settings: options, ...extra })
const rating = (a = p, ds = [p]) => evaluateGunfighterProfile(a, ds, options).states[0]
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-10, `${message}: ${a} != ${b}`)
const hit = new Map([['1:0', 1]])
const effect = (m = mode, d = p, extra = {}) => expectedEffectFromHits({ outcomes: hit, mode: m, defender: d, ...extra })

// Grammar invariance, including exact TTS and official-API formats.
for (const spelling of ['Mimetism(-3)', 'Mimetism (-3)', 'Mimetism -3', 'Mimetism[−3]']) assert.equal(pool(p, { ...p, skills: [spelling] }).target, 6)
assert.equal(pool({ ...p, equipment: ['Multispectral Visor L1'] }, { ...p, skills: ['Mimetism(-6)'] }).target, 6)
assert.equal(pool({ ...p, equipment: ['Multispectral Visor L2'] }, { ...p, skills: ['Mimetism(-6)'] }).target, 9)
assert.equal(pool({ ...p, skills: ['Marksmanship'] }).target, 12)
near(effect().total, effect({ ...mode, marksmanship: true }).total, 'Marksmanship never removes save cover')
assert.equal(pool(p, { ...p, skills: ['No Cover'] }).target, 12)
assert.equal(pool(p, { ...p, skills: ['Limited Cover'] }).target, 12)
near(effect(mode, { ...p, skills: ['No Cover'] }).total, .65, 'No Cover loses save bonus')
near(effect(mode, { ...p, skills: ['Limited Cover'] }).total, .5, 'Limited Cover retains save bonus')
for (const spelling of ['Immunity(Shock)', 'Immunity (Shock)']) near(effect({ ...mode, ammo: 'Shock' }, { ...p, skills: ['No Wound Incapacitation', spelling] }).total, .25, 'Shock immunity preserves NWI')

assert.equal(pool({ ...p, skills: ['BS Attack(+1B)'] }, p, mode, 0, true).burst, 1)
assert.equal(pool({ ...p, skills: ['Neurocinetics'] }).burst, 1)
assert.equal(pool({ ...p, skills: ['Neurocinetics', 'BS Attack(+1B)'] }, p, mode, 0, true).burst, 4)
assert.equal(pool({ ...p, skills: ['Total Reaction', 'BS Attack(+1B)'] }, p, mode, 0, true).burst, 4)
assert.equal(pool(p, p, { ...mode, burst: 6, burstBonus: 2 }).burst, 6)
assert.equal(pool(p, p, { ...mode, specialDice: 1 }).burst, 3)
assert.equal(pool(p, p, { ...mode, specialDice: 1 }, 0, true).specialDice, 1)
assert.equal(pool({ ...p, skills: ['BS Attack(+1 SD)'] }).specialDice, 1)
assert.equal(pool(p, p, { ...mode, attackType: 'direct-template', specialDice: 1 }).specialDice, 0)
assert.equal(pool({ ...p, bs: 1 }).target, -2)
assert.equal(pool({ ...p, bs: 22 }, p, mode, 0, false, false).target, 22)
assert.equal(pool({ ...p, bs: 15 }, { ...p, skills: ['Mimetism(-6)'] }, mode, -6).target, 3)

const linked = { ...p, id: 'linked', fireteamSpecialDice: 1 }
assert.equal(rating(p, [linked]).rating, candidate(p, linked, mode, { defenderFireteamSpecialDice: 1 }).score)
assert.ok(rating(p, [linked]).rating < rating().rating)
const weighted = [{ id: 'a', archetype: 'one', archetypeWeight: .8, variantGroup: 'a' }, { id: 'a2', archetype: 'one', archetypeWeight: .8, variantGroup: 'a' }, { id: 'b', archetype: 'one', archetypeWeight: .8 }, { id: 'c', archetype: 'two', archetypeWeight: .2 }]
assert.deepEqual([...benchmarkDefenderWeights(weighted).values()], [.2, .2, .4, .2])
const easy = { ...p, id: 'easy', ph: 1, bs: 1, archetypeWeight: .99 }, hard = { ...p, id: 'hard', bs: 18, ph: 18, arm: 10, archetypeWeight: .01 }
assert.ok(rating(p, [easy, hard]).rating > rating(p, [{ ...easy, archetypeWeight: .01 }, { ...hard, archetypeWeight: .99 }]).rating)

// Two templates share ONE Dodge event, not two independent Bernoulli events.
const template = { ...mode, burst: 2, attackType: 'direct-template' }
near(candidate(p, { ...p, weapons: [] }, template).optimalResponse.effect.total, .5 * (1 - .35 ** 2), 'B2 template correlated Dodge')
assert.ok(evaluateAroProfile(p, [{ ...p, weapons: [{ ...weapon, modes: [template] }] }], options).states[0].rating > 0)
const plainAro = candidate(p, p, mode, { responseObjective: 'aro' }).optimalResponse
const srAro = candidate(p, { ...p, skills: ['BS Attack(SR-1)'] }, mode, { responseObjective: 'aro' }).optimalResponse
assert.ok(srAro.returnEffect.total > plainAro.returnEffect.total)
assert.equal(candidate(p, p, { ...mode, savingRollPenalty: 1 }).score, candidate({ ...p, skills: ['BS Attack(SR-1)'] }).score, 'Mode and skill SR-1 each apply exactly once')
const noCover = candidate(p, { ...p, weapons: [] }, mode, { settings: { ...options, cover: false } }).optimalResponse
near(noCover.effect.total, expectedEffectFromHits({ outcomes: noCover.roll.activeOutcomes, mode, defender: p, cover: false }).total, 'Exchange passes cover=false to saves')
const impact = weaponChartRecordToGunfighterWeapon(normalizeWeaponChartRow({ name: 'Blast', damage: 7, burst: 1, ammo: 'N', saving: 'ARM', traits: ['Impact Template (Circular)'] })).modes[0]
near(effect(impact).total, .65, 'Impact template ignores saving-roll cover')
assert.equal(pool(p, p, impact).target, 9, 'Impact template still applies hit-cover')
const smokeMode = { ...mode, burst: 1, power: 0, ammo: 'Smoke', smoke: true, attackAttribute: 'ph', ranges: [{ min: 0, max: 8, modifier: 3 }] }
assert.equal(pool(p, { ...p, skills: ['Mimetism (-6)'] }, smokeMode, 3, true).target, 13, 'Targetless Smoke uses PH+range; enemy cover and Mimetism do not apply')
const smokeDefender = { ...p, weapons: [{ name: 'Smoke Grenades', modes: [smokeMode] }] }
const distantSmoke = candidate(p, smokeDefender, mode, { range: { id: '40-48', min: 40, max: 48 } }).optimalResponse
assert.equal(distantSmoke.aroType, 'smoke', 'Close Smoke placement remains available against a distant attacker')
assert.equal(distantSmoke.roll.reactiveWin, resolveFaceToFace({ burst: 3, specialDice: 0, target: 9 }, { burst: 1, specialDice: 0, target: 13 }).reactiveWin)

const plasma = weaponChartRecordToGunfighterWeapon(normalizeWeaponChartRow({ name: 'Plasma', damage: 7, burst: 1, ammo: 'N', saving: 'ARM and BTS', savingRolls: '1 and 1' })).modes[0]
const armBts = { ...p, arm: 3, bts: 6 }
near(effect(plasma, armBts).total, 1 - .65 * .8, 'Plasma ordinary ARM and BTS saves')
near(effect(plasma, armBts, { outcomes: new Map([['1:1', 1]]) }).total, 1 - .65 ** 2 * .8, 'Plasma critical adds ARM, not BTS or a second pair')
near(effect({ ...mode, ammo: 'DA', saves: 2 }, { ...p, skills: ['Immunity(ARM)'] }).total, .5, 'ARM immunity normalizes DA')
near(effect({ ...mode, ammo: 'AP', saveDivisor: 2 }, { ...p, arm: 6, skills: ['Immunity(AP)'] }).total, .2, 'AP immunity uses full ARM')
near(effect(mode, { ...p, skills: ['Immunity(Critical)'] }, { outcomes: new Map([['1:1', 1]]) }).total, .5, 'Critical immunity removes extra save')
near(effect({ ...mode, ammo: 'T2' }, { ...p, vitality: 3 }, { outcomes: new Map([['1:1', 1]]) }).expectedDamage, 1.5, 'T2 critical adds a one-wound save, not another two-wound save')
const para = { ...mode, ammo: 'PARA', save: 'PH', power: 0, nonLethal: true, states: ['IMM-A'] }
const ccPara = resolveWeaponEffect(hit, para, p)
assert.equal(ccPara.stateProbability, .5)
assert.equal(ccPara.expectedWounds, 0)
assert.equal(ccPara.expectedCappedWounds, 0)
assert.equal(ccPara.neutralizeProbability, 0)
near(ccPara.utility, .5 * .65 * .5, 'Nonlethal CC scores state once, no wound utility')
const continuousMode = { ...mode, power: 10, continuousDamage: true }
near(effect(continuousMode, { ...p, vitality: 2 }, { cover: false }).expectedDamage, 1, 'Continuous Damage geometric mean at p=0.5')
near(effect(continuousMode, { ...p, vitality: 2 }, { cover: false }).damageValue, .375, 'Continuous Damage capped expectation is (0.5 + 0.25)/2')
const continuousCc = resolveWeaponEffect(hit, continuousMode, { ...p, vitality: 2 })
assert.equal(continuousCc.expectedCappedWounds, .75)
assert.equal(continuousCc.neutralizeProbability, .25)
const em = { ...mode, ammo: 'E/M', save: 'BTS', saves: 2, saveDivisor: 2, nonLethal: true }
near(effect(em, { ...p, bts: 6, troopType: 'HI' }).total, (1 - .65 ** 2) * .9, 'E/M states are correlated and not independently added')
near(effect(em, { ...p, bts: 6, troopType: 'HI', skills: ['Warhorse'] }).total, (1 - .65 ** 2) * .5, 'Warhorse blocks Isolated but not E/M immobilization on HI')
near(effect(em, { ...p, bts: 6, troopType: 'LI', skills: ['Warhorse'] }).total, 0, 'E/M does not immobilize LI')
near(effect(em, { ...p, bts: 6, troopType: 'HI', skills: ['Immunity (BTS)'] }).total, 0, 'BTS immunity blocks E/M states; nonlethal cannot become wounds')

const flash = { ...weapon, modes: [{ ...mode, attackAttribute: 'wip', ammo: 'STUN', save: 'BTS', nonLethal: true, states: ['stunned'] }] }
const wips = [{ ...p, wip: 10, weapons: [flash] }, { ...p, id: '1:1:1:2:1', optionId: 2, wip: 18, weapons: [flash] }]
const catalog = buildGunfighterBenchmarkCatalog({ profiles: wips, defenders: [p], officialDataVersion: 'fixture', benchmarkVersion: 'fixture', options })
assert.deepEqual(catalog.entries.map(e => e.result.states[0].rating), wips.map(w => rating(w).rating))
assert.notEqual(catalog.entries[0].result.states[0].rating, catalog.entries[1].result.states[0].rating)
const attackers = Array.from({ length: 30 }, (_, i) => ({ profile: p, key: String(i), specialDice: 0, state: 'normal', rating: 20 }))
const aroCatalog = buildAroBenchmarkCatalog({ profiles: wips, attackers, officialDataVersion: 'fixture', options })
assert.deepEqual(aroCatalog.entries.map(e => e.result.states[0].rating), wips.map(w => evaluateAroProfile(w, attackers, options).states[0].rating))
assert.notEqual(aroCatalog.entries[0].result.states[0].rating, aroCatalog.entries[1].result.states[0].rating)
const neuro = { ...p, id: '1:2:1:1:1', unitId: 2, skills: ['Neurocinetics'] }
const attackerChoices = selectBenchmarkAttackers([p, neuro], { entries: [p, neuro].map(profile => ({ key: profile.id, result: { states: [{ id: 'normal', rating: 20 }] } })) }, { limit: 2 })
assert.equal(attackerChoices.length, 2, 'Neurocinetics changes active Burst and cannot be deduplicated as a reactive-only trait')
const camo = { ...p, skills: ['Surprise Attack (-3)'], markerState: true }
assert.equal(candidate(camo).score, candidate().score, 'Normal benchmark never silently assumes Surprise Attack')
assert.ok(candidate(camo, p, mode, { settings: { ...options, surpriseAttack: true } }).score > candidate(camo).score)
assert.equal(candidate({ ...camo, markerState: false }, p, mode, { settings: { ...options, surpriseAttack: true } }).score, candidate().score, 'Skill alone cannot activate Surprise')
const response = (attacker, defender, settings = options) => candidate(attacker, defender, mode, { settings, responseObjective: 'aro' }).optimalResponse
assert.equal(response(camo, { ...p, skills: ['Combat Instinct'] }, { ...options, surpriseAttack: true }).roll.reactiveWin, response(p, p).roll.reactiveWin)
assert.ok(response(camo, { ...p, skills: ['Sixth Sense'] }, { ...options, surpriseAttack: true }).roll.reactiveWin < response(p, p).roll.reactiveWin, 'Sixth Sense is not general Surprise immunity in N5')
const noWeapons = { ...p, weapons: [], skills: ['Sixth Sense'] }
assert.equal(candidate({ ...p, skills: ['BS Attack (-3)'] }, noWeapons).score, candidate(p, noWeapons).score, 'Sixth Sense Dodge ignores BS Attack penalties')
const sdDodge = { ...p, ph: 13, weapons: [], skills: ['Dodge (+2SD)'] }
near(candidate(p, sdDodge, template).optimalResponse.effect.total, .35 ** 3 * (1 - .35 ** 2), 'No rounded probability is fed back into template damage')

// Identical names and tied scores must not merge different weapons or lose source aliases.
const ccWeapon = { name: 'CC', power: 7, burst: 1, ammo: 'N', save: 'ARM', savingRolls: 1 }
const ccFighter = { ...p, weapons: [ccWeapon], aliases: [{ key: p.id, sectorialId: 1, name: p.name }] }
const ccVariant = { ...ccFighter, id: '2:1:1:1:1', weapons: [{ ...ccWeapon, ammo: 'AP', ap: true }], aliases: [{ key: '2:1:1:1:1', sectorialId: 2, name: p.name }] }
const ccCatalog = buildCloseCombatCatalog({ profiles: [ccFighter, ccVariant], defenders: [ccFighter], officialDataVersion: 'fixture', benchmarkVersion: 'fixture' })
assert.equal(ccCatalog.entries[0].rating, ccCatalog.entries[1].rating)
assert.equal(ccCatalog.entryCount, 2)
const lookup = lookupCloseCombatRatings(ccCatalog, { sectorialId: 2, combatGroups: [{ members: [{ unitId: 1, groupId: 1, optionId: 1, profileId: 1 }] }] })
assert.equal(lookup[0].result.weapons[0].ammo, 'AP')
assert.deepEqual(rankSubmittedCloseCombat(ccCatalog, [{ combinedId: '3-1-1-1-1', unitName: p.name }], { sectorialId: 3 }), [])

// Independent exhaustive oracle: no imported rule helpers or engine rankings.
function rolls(b, sd, sv) {
  const results = []
  function walk(faces) {
    if (faces.length < b + sd) { for (let f = 1; f <= 20; f++) walk([...faces, f]); return }
    results.push(faces.map(f => ({ face: f, success: sv >= 1 && f <= sv, critical: sv <= 20 ? f === sv : f === 20 || f <= sv - 20 })).sort((a, b) => Number(b.success) - Number(a.success) || Number(b.critical) - Number(a.critical) || b.face - a.face).slice(0, b))
  }
  walk([]); return results
}
let oracleCases = 0
for (const [b, sd, rb, rs] of [[1,0,1,0],[2,0,1,0],[1,1,1,0],[2,1,1,0],[1,1,1,1]]) for (const [sv, rsv] of [[0,12],[6,9],[13,13],[22,23]]) {
  const as = rolls(b,sd,sv), bs = rolls(rb,rs,rsv), expected = [new Map(),new Map()]
  for (const a of as) for (const r of bs) for (const [side, own, other] of [[0,a,r],[1,r,a]]) {
    const winners = other.some(x => x.success && x.critical) ? [] : own.filter(x => x.success && (x.critical || x.face > Math.max(0,...other.filter(y => y.success).map(y => y.face))))
    const k = `${winners.length}:${winners.filter(x => x.critical).length}`
    expected[side].set(k, (expected[side].get(k) || 0) + 1/(as.length*bs.length))
  }
  const result = resolveFaceToFace({burst:b,specialDice:sd,target:sv,criticalTarget:sv},{burst:rb,specialDice:rs,target:rsv,criticalTarget:rsv})
  const cc = resolveOpposedPools({burst:b,specialDice:sd,successValue:sv},{burst:rb,specialDice:rs,successValue:rsv})
  for (const actual of [result,cc]) for (const [i, dist] of [actual.activeOutcomes,actual.reactiveOutcomes].entries()) for (const k of new Set([...dist.keys(),...expected[i].keys()])) near(dist.get(k)||0,expected[i].get(k)||0,`oracle ${b}/${sd}/${sv} vs ${rb}/${rs}/${rsv}, side ${i}, ${k}`)
  oracleCases++
}
const cc23 = { burst: 1, specialDice: 0, successValue: 23 }
assert.deepEqual(resolveOpposedPools(cc23,cc23).summary,{ activeWin:46,reactiveWin:46,noEffect:8 })
assert.equal(buildCloseCombatPool({...p,skills:['CC Attack(+1B)']},p,{name:'CC',burst:1},{type:'face-to-face'},{active:false}).burst,1)
assert.equal(buildCloseCombatPool({...p,skills:['Martial Arts L4']},p,{name:'CC',burst:1},{type:'face-to-face'},{active:false}).burst,2)
assert.equal(buildCloseCombatPool({ ...p, skills: ['Combat Instinct'] }, camo, ccWeapon, { type: 'face-to-face' }, { active: false, opponentState: { id: 'surprise' } }).successValue, p.cc)
assert.equal(buildCloseCombatPool({ ...p, skills: ['Sixth Sense'] }, camo, ccWeapon, { type: 'face-to-face' }, { active: false, opponentState: { id: 'surprise' } }).successValue, p.cc - 3)

// Exact official data wins even when stale TTS supplies better stats/weapons.
const metadata = { skills: [], equips: [], extras: [{id:308,name:'+1SD'}], weapons: [{id:36,name:'Sniper',type:'WEAPON',damage:'5',burst:'2',saving:'ARM',savingNum:'1',ammunition:2,properties:[],distance:{short:{max:120,mod:'+3'},long:null}}], ammunitions:[{id:2,name:'N'}] }
const dataset = {metadata,units:[{id:1,name:'Unit',profileGroups:[{id:1,profiles:[{id:1,bs:13,cc:18,ph:12,wip:14,arm:3,bts:3,w:2,str:true}],options:[{id:1,name:'Unit',weapons:[{id:36,extra:[308]}]}]}]}]}
const chart = weaponChartFromArmyMetadata(metadata)
const official = buildCanonicalGunfighterProfiles({dataset,weaponChart:chart,sectorialId:1,ttsProfiles:[{id:p.id,bs:19,skills:['Marksmanship'],weapons:[{name:'Invented gun'}]}]})[0]
assert.equal(official.bs,13); assert.equal(official.structure,2); assert.equal(official.vitality,null); assert.deepEqual(official.skills,[])
assert.equal(official.weapons.length,1); assert.equal(official.weapons[0].modes[0].specialDice,1)
const ccSource = {metadata:{...metadata,weapons:[{id:71,name:'PARA CC Weapon',damage:'-',burst:'1',saving:'PH-6',savingNum:'1',ammunition:37,properties:['CC','Non-lethal','State: IMM-A']}],ammunitions:[{id:37,name:'PARA'}]},payloads:[{url:'https://fixture/1',filters:{extras:[]},units:[{id:2,name:'PARA unit',profileGroups:[{id:1,profiles:[{id:1,cc:18,ph:12,arm:0,bts:0,w:1,str:false}],options:[{id:1,weapons:[{id:71}]}]}]}]}]}
assert.equal(buildCanonicalCloseCombatProfiles({official:ccSource})[0].weapons[0].nonLethal,true,'PH-based PARA CC is retained despite PS dash')
console.log(`PASS: whole-benchmark audit regressions; ${oracleCases} exhaustive dice distributions verified independently in BOTH engines.`)
