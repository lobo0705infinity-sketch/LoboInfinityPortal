import { resolve } from 'node:path'
import { readArtifact } from '../scripts/benchmark-artifacts.mjs'
import { buildOfficialCombatSource } from './official-combat-source.mjs'
import { buildCanonicalCloseCombatProfiles } from './close-combat-canonicalizer.mjs'
import { STANDARD_RANGE_BANDS, evaluateAttackCandidate, resolveFaceToFace, resolveNormalRoll, dodgePool } from './gunfighter-rating.mjs'
import { buildCloseCombatPool, resolveOpposedPools, MARTIAL_ARTS } from './close-combat-benchmark.mjs'
import { resolveSavingEffects, savingProfile, profileTraits, successValue } from './combat-rules.mjs'

export const DEFAULT_MATCHUP_SETTINGS = Object.freeze({ range:'16-24', kind:'shooting', goal:'neutralize', cover1:true, cover2:true, linked1:false, linked2:false, wounds1:null, wounds2:null, state1:'normal', state2:'normal', firewall1:0, firewall2:0, weapon:'auto', aro:'auto', direction:0 })
export const MATCHUP_STATES = ['normal','targeted','nwi','dogged','isolated','imm-b','imm-a']
let sourcePromise
export async function loadMatchupSource() {
  sourcePromise ||= readArtifact(resolve(import.meta.dirname,'..','data','infinity-army','benchmark-official-source.json.gz.b64')).then(capture=>{
    const source=buildOfficialCombatSource(capture)
    const cc=buildCanonicalCloseCombatProfiles({official:capture})
    source.profiles=source.profiles.map(p=>({...p, ccWeapons:cc.find(c=>c.id===`${p.unitId}:${p.groupId}:${p.optionId}:${p.profileId}`)?.weapons || []}))
    source.hacking=capture.metadata.hack
    return source
  })
  return sourcePromise
}
const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
export function exactProfile(source,id) {
  const p=source.profiles.find(p=>p.id===id)
  if(!p)throw Error('Choose an exact profile from autocomplete; this profile is no longer in the Army data.')
  return p
}
export function prepareFighter(profile,settings,index) {
  const state=settings[`state${index}`] || 'normal', traits=profileTraits(profile)
  if(!MATCHUP_STATES.includes(state))throw Error('Unsupported starting state.')
  if(state==='nwi'&&!traits.includes('no wound incapacitation'))throw Error(`${profile.name} does not have No Wound Incapacitation.`)
  if(state==='dogged'&&!traits.includes('dogged'))throw Error(`${profile.name} does not have Dogged.`)
  const wounds=settings[`wounds${index}`], printed=Number(profile.vitality || profile.structure || 1)
  if(wounds!=null&&(!Number.isInteger(wounds)||wounds<1||wounds>printed))throw Error(`Remaining wounds/STR must be between 1 and ${printed}.`)
  return {...profile, remainingWounds:state==='nwi'||state==='dogged'?0:wounds??printed,inNwi:state==='nwi'||state==='dogged',state,
    coverEligible:profile.coverEligible!==false&&settings[`cover${index}`]!==false,
    fireteamSpecialDice:settings[`linked${index}`]&&profile.fireteamCapable&&state!=='isolated'?1:0,
    firewall:Math.max(intrinsicFirewall(profile,state),Number(settings[`firewall${index}`]||0)),
    targeted:state==='targeted'}
}
function intrinsicFirewall(profile,state) {
  return Math.max(0,...[...(profile.skills||[]),...(profile.equipment||[])].filter(x=>state!=='isolated'||!/hacking device/i.test(x)).map(x=>Number(String(x).match(/firewall\s*[(-]*\s*-?(\d+)/i)?.[1]||0)))
}
export function importedMatchup(link,source) {
  const url=new URL(link)
  if(url.hostname!=='infinitythecalculator.com'||url.protocol!=='https:')throw Error('Use an HTTPS link from infinitythecalculator.com.')
  const p=url.searchParams
  const find=side=>source.profiles.find(x=>Number(p.get(`faction${side}`))===x.sectorialId&&Number(p.get(`unit${side}`))===x.unitId&&Number(p.get(`group${side}`))===x.groupId&&Number(p.get(`profile${side}`))===x.profileId&&Number(p.get(`option${side}`))===x.optionId)
  const a=find('A'),b=find('B');if(!a||!b)throw Error('A linked profile is not present in the current Army capture. Select its current profile instead.')
  // The site serializes centimeters (its 32–40 inch band writes range=100).
  const cm=Number(p.get('range')), inches=cm/2.54
  const range=STANDARD_RANGE_BANDS.find(r=>inches>r.min&&inches<=r.max)?.id || '16-24'
  return {modelOne:a.id,modelTwo:b.id,settings:{...DEFAULT_MATCHUP_SETTINGS,range,cover1:p.get('coverA')==='1',cover2:p.get('coverB')==='1'},note:`Imported profiles and cover; range=${cm} is interpreted as centimeters (${inches.toFixed(1)} inches). Fireteams and weapon modes must be selected explicitly.`}
}
export function effectDetails(outcomes,mode,target,cover=true) {
  if(!mode||!outcomes)return {onePlus:0,twoPlus:0,threePlus:0,unconscious:0,dead:0,neutralize:0,stateProbability:0,expectedWounds:0,distribution:[1],states:[]}
  const deadAt=(target.inNwi?1:target.remainingWounds??Number(target.vitality||target.structure||1))+(target.inNwi?0:profileTraits(target).includes('remote presence')?2:1)
  const effect=resolveSavingEffects(outcomes,mode,target,{cover,damageCap:Math.max(3,deadAt)})
  const normalized=savingProfile(mode,target,{cover}),d=effect.woundDistribution
  const totalFrom=n=>d.slice(n).reduce((a,b)=>a+b,0)
  const shockKills=normalized.shock&&Number(target.vitality)===1&&!profileTraits(target).includes('immunity shock')
  const dead=normalized.deadState||shockKills?effect.failureProbability:totalFrom(deadAt)
  const neutralize=effect.nonLethal?(effect.states.some(s=>['isolated','immobilized','stunned','possessed'].includes(s))?effect.stateProbability:0):effect.neutralizeProbability
  const hasContinuation=profileTraits(target).some(t=>['no wound incapacitation','dogged'].includes(t))
  const continuation=!target.inNwi&&hasContinuation?Math.max(0,totalFrom(target.remainingWounds)-dead):0
  return {onePlus:effect.nonLethal?0:totalFrom(1),twoPlus:effect.nonLethal?0:totalFrom(2),threePlus:effect.nonLethal?0:totalFrom(3),continuation,unconscious:effect.nonLethal||target.inNwi||hasContinuation?0:Math.max(0,totalFrom(target.remainingWounds??Number(target.vitality||target.structure||1))-dead),dead,neutralize,stateProbability:effect.stateProbability,expectedWounds:effect.expectedWounds,distribution:d,states:effect.states,nonLethal:effect.nonLethal,durability:effect.durability}
}
function poolOutcomes(response,mode) {
  if(response.roll.activeOutcomes)return response.roll.activeOutcomes
  if(mode.attackType==='direct-template')return new Map([['0:0',1-response.roll.activeWin/100],[`${response.attack.burst}:0`,response.roll.activeWin/100]])
  return resolveNormalRoll(response.attack).outcomes
}
function responseDetails(candidate,response,attacker,defender,mode) {
  const activeMode={...mode,savingRollPenalty:response.attack.savingRollPenalty,shock:mode.shock||response.attack.shock,continuousDamage:mode.continuousDamage||response.attack.continuousDamage}
  const effect=effectDetails(poolOutcomes(response,mode),activeMode,defender,true)
  const responseMode=defender.weapons.flatMap(w=>w.modes.map(m=>({w,m}))).find(({w,m})=>`${w.name}:${m.name||m.ammo||'default'}`===response.aro)?.m
  const reactive=response.roll.reactive
  let retaliation=response.returnEffect
  if(responseMode&&reactive){
    const outcomes=response.roll.reactiveOutcomes || (response.aroType==='template'?new Map([[`${reactive.burst}:0`,1]]):resolveNormalRoll(reactive).outcomes)
    retaliation=effectDetails(outcomes,{...responseMode,savingRollPenalty:reactive.savingRollPenalty,shock:responseMode.shock||reactive.shock,continuousDamage:responseMode.continuousDamage||reactive.continuousDamage},attacker,true)
  }
  return {id:`${candidate.weapon} (${candidate.mode})`,weapon:candidate.weapon,ammo:candidate.mode,aro:response.aro,aroType:response.aroType,attack:response.roll.attack,reactive:response.roll.reactive,roll:response.roll,effect,retaliation,score:response.attackerScore,save:savingProfile(activeMode,defender,{cover:true}).components,disposable:mode.disposableUses,mode:activeMode}
}
function shootingCandidates(attacker,defender,settings,range) {
  if(['imm-a','imm-b'].includes(attacker.state))return []
  const results=[]
  for(const weapon of attacker.weapons)for(const mode of weapon.modes){
    const c=evaluateAttackCandidate({attacker,defender,weapon,mode,range,fireteamSpecialDice:attacker.fireteamSpecialDice,defenderFireteamSpecialDice:defender.fireteamSpecialDice,settings:{cover:true,excludeDirectTemplates:false,includeNoAro:true}})
    if(c.status!=='evaluated')continue
    const responses=c.responses
    for(const response of responses)results.push(responseDetails(c,response,attacker,defender,mode))
  }
  return results
}
function ccCandidates(attacker,defender) {
  if(['imm-a','imm-b'].includes(attacker.state))return []
  const results=[]
  for(const weapon of attacker.ccWeapons || []){
    const active=buildCloseCombatPool(attacker,defender,weapon,{id:'normal',type:'face-to-face'})
    const responses=(defender.ccWeapons||[]).map(w=>({id:w.name,type:'cc',weapon:w,pool:buildCloseCombatPool(defender,attacker,w,{id:'reactive',type:'face-to-face'},{active:false,opponentWeapon:weapon})}))
    if(defender.state!=='imm-b'){const d=dodgePool(defender),level=Number(profileTraits(attacker).map(t=>t.match(/martial arts (?:l|level)?\s*(\d)/)?.[1]).find(Boolean)||0),ccMod=profileTraits(attacker).reduce((sum,t)=>sum-Number(t.match(/cc attack\s*-(\d+)/)?.[1]||0),0),mod=d.modifiers+(MARTIAL_ARTS[level]?.opponent||0)+ccMod+Number(weapon.opponentMod||0)+(defender.state==='imm-a'?-6:0);responses.push({id:'Dodge',type:'dodge',pool:{burst:1,specialDice:d.specialDice,successValue:successValue(d.baseTarget,mod)}})}
    responses.push({id:'No ARO',type:'none'})
    for(const response of responses){
      if(['imm-a','imm-b'].includes(defender.state)&&response.type==='cc')continue
      // Defender's weapon MODs must also affect the active CC pool.
      const pool=response.weapon?buildCloseCombatPool(attacker,defender,weapon,{id:'normal',type:'face-to-face'},{opponentWeapon:response.weapon}):active
      const roll=response.pool?resolveOpposedPools(pool,response.pool):{summary:{activeWin:resolveNormalRoll({...pool,target:pool.successValue,criticalTarget:pool.successValue}).success,reactiveWin:0,noEffect:0},activeOutcomes:resolveNormalRoll({...pool,target:pool.successValue,criticalTarget:pool.successValue}).outcomes}
      const effect=effectDetails(roll.activeOutcomes,weapon,defender,false),retaliation=response.weapon?effectDetails(roll.reactiveOutcomes,response.weapon,attacker,false):null
      results.push({id:weapon.name,weapon:weapon.name,ammo:weapon.ammo,aro:response.id,aroType:response.type,attack:{...pool,target:pool.successValue,source:weapon.name},reactive:response.pool?{...response.pool,target:response.pool.successValue,source:response.id}:null,roll:roll.summary,effect,retaliation,save:savingProfile(weapon,defender).components,mode:weapon})
    }
  }
  return results
}
export function hackingPrograms(profile,source) {
  if(profile.state==='isolated')return []
  const devices=source ? new Map([[100,'Hacking Device'],[101,'Hacking Device Plus'],[145,'Killer Hacking Device'],[182,'EVO Hacking Device']]) : new Map()
  const traits=[...(profile.skills||[]),...(profile.equipment||[])]
  return (source.hacking||[]).filter(p=>Number(p.burst)>0&&Number.isFinite(Number(p.damage))&&p.damage!=='-'&&((p.devices||[]).some(id=>traits.some(t=>t===devices.get(id)||t.startsWith(`${devices.get(id)} `)))||traits.some(t=>normalize(t).includes(normalize(p.name)))))
    .map(p=>{
      const modifiers=traits.map(t=>String(t).match(new RegExp(p.name.replace(/\s/g,'[\\s\\u00a0]+')+'\\s*\\(([^)]*)\\)','i'))?.[1]||'').filter(Boolean).join(' ')
      const ps=modifiers.match(/(?:PS\s*[=:]?\s*|\bPS\s*\+)(\d+)/i), burst=modifiers.match(/\+(\d+)\s*B\b/i),sr=modifiers.match(/SR\s*-\s*(\d+)/i)
      return {...p,specialDice:Number(modifiers.match(/\+(\d+)\s*SD/i)?.[1]||0),opponentMod:Number(modifiers.match(/^-(\d+)$/)?.[1]||0)*-1,name:p.name.replace(/\s/g,' '),power:ps?Number(ps[1]):Number(p.damage),burst:Number(p.burst)+Number(burst?.[1]||0),savingRollPenalty:Number(sr?.[1]||0),ammo:/\bAP\b/.test(modifiers)||/AP Ammo/i.test(p.special)?'AP':/DA Ammo/i.test(p.special)?'DA':'N',save:'BTS',nonLethal:/Non-Lethal/i.test(p.special),states:/ISOLATED/i.test(p.special)?['isolated']:/IMM-B/i.test(p.special)?['immobilized']:/TARGETED/i.test(p.special)?['targeted']:/POS\//i.test(p.special)?['possessed']:[]}
    })
}
function hackingCandidates(attacker,defender,source) {
  if(['isolated','imm-a'].includes(attacker.state))return []
  const traits=profileTraits(defender), hacker=traits.includes('hacker')||traits.some(t=>/hacking device/.test(t))
  const legal=(p,t)=>!p.target?.length||p.target.includes(t.troopType)||(p.target.includes('Hacker')&&profileTraits(t).some(s=>s==='hacker'||/hacking device/.test(s)))
  const pool=(p,user,target,active=true)=>{
    const ecm=Math.max(0,...[...(target.skills||[]),...(target.equipment||[])].map(x=>Number(x.match(/ECM:?\s*Hacker\s*[(-]*\s*-?(\d+)/i)?.[1]||0)))
    const mods=Number(p.attack||0)-target.firewall-ecm+(target.targeted?3:0)
    return {burst:active?p.burst:1,specialDice:p.specialDice||0,target:successValue(user.wip,mods),criticalTarget:successValue(user.wip,mods),baseTarget:user.wip,modifierSources:[`Program ${Number(p.attack||0)}`,`Firewall -${target.firewall}`,`ECM -${ecm}`,target.targeted?'Targeted +3':''].filter(Boolean),source:p.name}
  }
  const results=[]
  for(const p of hackingPrograms(attacker,source).filter(p=>legal(p,defender))){
    const responses=[{id:'Reset',type:'reset',pool:{burst:1,specialDice:0,target:successValue(defender.wip,defender.state==='isolated'?-9:defender.state==='imm-b'||defender.state==='targeted'?-3:0),source:'Reset'}} ,{id:'No ARO',type:'none'}]
    if(defender.state==='imm-a')responses.splice(0,1)
    if(hacker&&defender.state!=='imm-a')for(const q of hackingPrograms(defender,source).filter(q=>legal(q,attacker)))responses.push({id:q.name,type:'hacking',program:q,pool:pool(q,defender,attacker,false)})
    // Zero Pain is a defensive upgrade: no saving roll or damage.
    if(!['isolated','imm-a'].includes(defender.state)&&[...(defender.skills||[]),...(defender.equipment||[])].some(x=>/zero pain/i.test(x)))responses.push({id:'Zero Pain',type:'reset',pool:{burst:2,specialDice:0,target:defender.wip,source:'Zero Pain'},opponentMod:-3})
    for(const r of responses){
      const a=pool(p,attacker,defender);const opponentMod=r.program?.opponentMod||r.opponentMod||0;if(opponentMod)a.target=successValue(a.baseTarget,a.target-a.baseTarget+opponentMod);a.criticalTarget=a.target
      if(r.pool&&p.opponentMod)r.pool={...r.pool,target:successValue(r.pool.baseTarget??defender.wip,r.pool.target-(r.pool.baseTarget??defender.wip)+p.opponentMod)}
      const roll=r.pool?resolveFaceToFace(a,{...r.pool,criticalTarget:r.pool.target}):{...resolveNormalRoll(a),activeWin:resolveNormalRoll(a).success,reactiveWin:0,noEffect:100-resolveNormalRoll(a).success,activeOutcomes:resolveNormalRoll(a).outcomes}
      const mode={...p,power:p.power+(defender.firewall?3:0)}, effect=effectDetails(roll.activeOutcomes,mode,defender,false)
      const retaliation=r.program?effectDetails(roll.reactiveOutcomes,{...r.program,power:r.program.power+(attacker.firewall?3:0)},attacker,false):null
      results.push({id:p.name,weapon:p.name,ammo:p.ammo,aro:r.id,aroType:r.type,attack:a,reactive:r.pool,roll,effect,retaliation,save:savingProfile(mode,defender).components,mode})
    }
  }
  return results
}
const metric=(c,goal)=>goal==='damage'?c.effect.onePlus:goal==='kill'?c.effect.dead:goal==='state'?c.effect.stateProbability:c.effect.neutralize
export function selectCandidate(candidates,settings) {
  const matching=candidates.filter(c=>(settings.weapon==='auto'||c.id===settings.weapon)&&(settings.aro==='auto'||settings.aro===c.aro||settings.aro===c.aroType))
  const byWeapon=new Map()
  for(const c of matching){const old=byWeapon.get(c.id);if(!old||metric(c,settings.goal)<metric(old,settings.goal)||metric(c,settings.goal)===metric(old,settings.goal)&&Number(c.retaliation?.neutralizeProbability??c.retaliation?.neutralize??0)>Number(old.retaliation?.neutralizeProbability??old.retaliation?.neutralize??0))byWeapon.set(c.id,c)}
  return [...byWeapon.values()].sort((a,b)=>metric(b,settings.goal)-metric(a,settings.goal)||a.id.localeCompare(b.id))[0] || null
}
export async function calculateWorkbench({modelOne,modelTwo,alternative,settings={},source}={}) {
  source ||= await loadMatchupSource();settings={...DEFAULT_MATCHUP_SETTINGS,...settings}
  if(!STANDARD_RANGE_BANDS.some(r=>r.id===settings.range)||!['shooting','cc','hacking'].includes(settings.kind)||!['damage','neutralize','kill','state'].includes(settings.goal))throw Error('Invalid matchup settings.')
  const first=prepareFighter(exactProfile(source,modelOne),settings,1),second=prepareFighter(exactProfile(source,modelTwo),settings,2)
  const attacker=settings.direction?second:first,defender=settings.direction?first:second
  const ranges=settings.kind==='shooting'?STANDARD_RANGE_BANDS:[{id:settings.kind==='cc'?'Engaged':'Hacking Area'}]
  const bands=ranges.map(range=>{
    const candidates=settings.kind==='cc'?ccCandidates(attacker,defender):settings.kind==='hacking'?hackingCandidates(attacker,defender,source):shootingCandidates(attacker,defender,settings,range)
    return {range:range.id,candidates,selected:selectCandidate(candidates,settings)}
  })
  const selected=bands.find(b=>b.range===settings.range)?.selected || (settings.kind!=='shooting'?bands[0].selected:null)
  let comparison=null
  if(alternative){
    const alt=prepareFighter(exactProfile(source,alternative),settings,settings.direction?2:1)
    const range=ranges.find(r=>r.id===settings.range)||ranges[0]
    const candidates=settings.kind==='cc'?ccCandidates(alt,defender):settings.kind==='hacking'?hackingCandidates(alt,defender,source):shootingCandidates(alt,defender,{...settings,weapon:'auto'},range)
    comparison={attacker:alt,selected:selectCandidate(candidates,{...settings,weapon:'auto'})}
  }
  return {first,second,attacker,defender,bands,selected,settings,comparison,rulesVersion:source.rulesVersion,datasetId:source.datasetId}
}
export function repeatedOrderOdds(selected,target,orders=3) {
  if(!selected||selected.disposable!=null)return null
  // Absorbing fixed-exchange model. Damage accumulates on both models and a
  // neutralized attacker cannot spend another order. F2F damage is mutually
  // exclusive; simultaneous normal-roll damage uses independent saving rolls.
  const enemy=selected.effect,own=selected.retaliation?.distribution?selected.retaliation:null
  const thresholdEnemy=Math.ceil(enemy.durability||1),thresholdOwn=Math.ceil(own?.durability||1)
  const events=e=>{
    if(!e)return [{damage:0,probability:1}]
    if(e.nonLethal)return [{damage:0,probability:1-e.neutralize},{damage:Infinity,probability:e.neutralize}]
    return e.distribution.map((probability,damage)=>({damage,probability}))
  }
  const targetEvents=events(enemy),attackerEvents=events(own),joint=[]
  if(selected.roll?.simultaneous)for(const t of targetEvents)for(const a of attackerEvents)joint.push({target:t.damage,attacker:a.damage,p:t.probability*a.probability})
  else {
    const targetZero=targetEvents[0].probability,attackerZero=attackerEvents[0].probability
    joint.push({target:0,attacker:0,p:Math.max(0,targetZero+attackerZero-1)})
    for(const t of targetEvents.slice(1))joint.push({target:t.damage,attacker:0,p:t.probability})
    for(const a of attackerEvents.slice(1))joint.push({target:0,attacker:a.damage,p:a.probability})
  }
  let alive=new Map([['0:0',1]]),neutralized=0;const output=[]
  for(let order=1;order<=orders;order++){
    const next=new Map()
    for(const [key,probability]of alive){
      const [enemyDamage,ownDamage]=key.split(':').map(Number)
      for(const event of joint){
        const p=probability*event.p,t=enemyDamage+event.target,a=ownDamage+event.attacker
        if(t>=thresholdEnemy)neutralized+=p
        else if(a<thresholdOwn){const k=`${t}:${a}`;next.set(k,(next.get(k)||0)+p)}
      }
    }
    alive=next;output.push(Math.min(1,neutralized))
  }
  return output
}
