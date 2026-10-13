import { reportableResponse } from './bot-feedback.mjs'
import { randomUUID } from 'node:crypto'
import { mkdir,readFile,writeFile,rename,readdir,stat,unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { calculateWorkbench, loadMatchupSource, importedMatchup, DEFAULT_MATCHUP_SETTINGS, MATCHUP_STATES, repeatedOrderOdds, selectCandidate } from './matchup-workbench.mjs'
const sessions=new Map(),locks=new Set(),ttl=7*86400000
const directory=()=>process.env.MATCHUP_STORAGE_PATH||'/data/matchup'
const pct=v=>`${(100*Number(v||0)).toFixed(1)}%`
const short=s=>String(s).split('—').at(-1).trim().slice(0,100)
const row=components=>({type:1,components})
const button=(id,key,label)=>({type:2,style:2,custom_id:`lobo-matchup:${id}:${key}`,label})
const menu=(id,key,placeholder,options)=>row([{type:3,custom_id:`lobo-matchup:${id}:${key}`,placeholder,options:options.slice(0,25).map(o=>({label:o.label.slice(0,100),value:o.value,default:!!o.default}))}])
const text=(id,label,value,placeholder)=>({type:1,components:[{type:4,custom_id:id,label:label.slice(0,45),style:1,required:false,value:String(value??''),placeholder}]})
async function writeJson(path,value){await mkdir(directory(),{recursive:true});const tmp=path+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,path)}
async function prune(){
  const entries=await readdir(directory()),records=[]
  for(const name of entries.filter(n=>/^[a-f0-9-]{36}\.json$/.test(n))){const path=join(directory(),name),info=await stat(path);if(Date.now()-info.mtimeMs>ttl)await unlink(path);else records.push({path,time:info.mtimeMs})}
  for(const r of records.sort((a,b)=>b.time-a.time).slice(2000))await unlink(r.path)
  for(const [id,s]of sessions)if(Date.now()-s.at>ttl)sessions.delete(id)
}
export async function saveSession(s){sessions.set(s.id,s);await writeJson(join(directory(),s.id+'.json'),s)}
async function loadSession(id){if(!/^[a-f0-9-]{36}$/.test(id))return null;let s=sessions.get(id);if(!s){try{s=JSON.parse(await readFile(join(directory(),id+'.json'),'utf8'))}catch{return null}}return Date.now()-s.at<=ttl?s:null}
function pool(p){return p?`B${p.burst}${p.specialDice?` +${p.specialDice}SD`:''} · target ${p.target} · ${(p.modifierSources||[]).join(', ')||'no listed MODs'}`:'No roll'}
function risk(c){return c?.retaliation?.neutralizeProbability??c?.retaliation?.neutralize??0}
function resultText(c){if(!c)return 'No supported legal attack for these choices.';return `**${c.id} → ${c.aro}**\n${c.effect.nonLethal?`Inflict ${c.effect.states.join(' / ')||'state'}: **${pct(c.effect.stateProbability)}**`:`1+ wounds: **${pct(c.effect.onePlus)}** · 2+: ${pct(c.effect.twoPlus)} · 3+: ${pct(c.effect.threePlus)}\nUnconscious: ${pct(c.effect.unconscious)} · Dead: ${pct(c.effect.dead)}${c.effect.continuation?` · Enter NWI/Dogged: ${pct(c.effect.continuation)}`:''}`}${!c.effect.nonLethal?`\nExpected wounds/order: ${c.effect.expectedWounds.toFixed(2)}`:''}\nNeutralize / disable: **${pct(c.effect.neutralize)}** · Attacker neutralized: **${pct(risk(c))}**\n${c.roll.simultaneous?'Independent rolls; both can take damage':'Win opposed/attack roll'}: ${Number(c.roll.activeWin||0).toFixed(1)}%`}
export function workbenchPayload(s,result){
  const settings=result.settings,c=result.selected,band=result.bands.find(b=>b.range===settings.range)||result.bands[0]
  const field=[], options=[{label:'Auto: best for selected goal',value:'auto',default:settings.weapon==='auto'},...new Map(band.candidates.map(c=>[c.id,{label:c.id,value:c.id,default:settings.weapon===c.id}])).values()]
  // Tokens keep component values below Discord's 100-character limit.
  s.weapons=options.map(o=>o.value);s.aros=['auto',...new Set(band.candidates.filter(x=>!c||x.id===c.id).map(x=>x.aro))]
  if(s.view==='ranges')field.push({name:'Range comparison · selected goal',value:result.bands.map(b=>`${b.range}: ${b.selected?`${b.selected.id} · ${pct(b.selected.effect[settings.goal==='damage'?'onePlus':settings.goal==='kill'?'dead':settings.goal==='state'?'stateProbability':'neutralize'])}`:'No legal attack'}`).join('\n').slice(0,1024)})
  if(s.view==='ammo')field.push({name:'Weapons / ammunition · same goal and ARO policy',value:[...new Set(band.candidates.map(x=>x.id))].map(id=>{const x=selectCandidate(band.candidates,{...settings,weapon:id});if(!x)return `${id}: no legal selected ARO`;return `${id}: 1+ ${pct(x.effect.onePlus)} · neutralize ${pct(x.effect.neutralize)} · dead ${pct(x.effect.dead)} · state ${pct(x.effect.stateProbability)}`}).join('\n').slice(0,1024)})
  if(s.view==='aros'&&c)field.push({name:'ARO comparison against this attack',value:band.candidates.filter(x=>x.id===c.id).map(x=>`${x.aro}: defender neutralized ${pct(x.effect.neutralize)} · attacker neutralized ${pct(risk(x))}`).join('\n').slice(0,1024)})
  if(s.view==='explain'&&c)field.push({name:'Roll and saving rolls',value:`Attacker: ${pool(c.attack)}\nDefender: ${pool(c.reactive)}\nTarget saves: ${c.save.map(x=>`${x.attribute}: ${x.saves} save(s)/hit; ${(100*x.failureProbability).toFixed(1)}% failure per save`).join('; ')}\nSpecial dice are extra rolled dice; they are not extra retained hits.\nFireteam setting represents eligible +1SD only.\nRules: ${result.rulesVersion}\nArmy capture: ${result.datasetId}`.slice(0,1024)})
  if(s.view==='orders'&&c){const odds=repeatedOrderOdds(c,result.defender);field.push({name:'Repeated orders · conditional planning estimate',value:odds?`${odds.map((p,i)=>`By order ${i+1}: ${pct(p)} neutralized`).join('\n')}\nAccumulates wounds on both models; a neutralized attacker cannot act again. Assumes the same ARO, weapon, pools and position. Does not model movement, changing forms, state cancellation, new state MODs or resource use.`:'Not estimated for disposable weapons.'})}
  if(result.comparison)field.push({name:'Alternative attacker · same defender and conditions',value:`${short(result.comparison.attacker.name)}\n${resultText(result.comparison.selected)}`.slice(0,1024)})
  let description=`${resultText(c)}\n\nCover: 1 ${settings.cover1?'on':'off'} / 2 ${settings.cover2?'on':'off'} · +1SD Fireteams: 1 ${result.first.fireteamSpecialDice?'on':'off'} / 2 ${result.second.fireteamSpecialDice?'on':'off'}\nStates: 1 ${settings.state1} / 2 ${settings.state2} · Remaining W/STR: 1 ${result.first.inNwi?'NWI/Dogged':result.first.remainingWounds} / 2 ${result.second.inNwi?'NWI/Dogged':result.second.remainingWounds}`
  if(s.note)description+='\n'+s.note
  if((settings.linked1&&!result.first.fireteamSpecialDice)||(settings.linked2&&!result.second.fireteamSpecialDice))description+='\nA requested Fireteam bonus was not applied: the selected profile or starting state is ineligible.'
  if(c?.effect.continuation||result.first.inNwi||result.second.inNwi)description+='\nNWI/Dogged models are assumed to continue acting until their next incapacitating wound.'
  if(settings.kind==='hacking')description+='\nAssumes both targets are in the relevant Hacking Area and in model form. Cover and BS Fireteam bonuses do not apply.'
  if(!c)description+='\nChoose another weapon/ARO or combat type. Hacking requires a legal device/program and target; CC requires a CC weapon.'
  const best=result.bands.filter(b=>b.selected).sort((a,b)=>b.selected.effect.neutralize-a.selected.effect.neutralize)[0]
  if(best&&settings.kind==='shooting'&&s.view==='summary')field.push({name:'Range guidance',value:`Highest neutralization chance under these choices: ${best.range} inches (${pct(best.selected.effect.neutralize)}).`})
  return {content:'',embeds:[{title:`${short(result.attacker.name)} → ${short(result.defender.name)}`.slice(0,256),description:description.slice(0,4096),color:0x29b6cf,fields:field,footer:{text:`${settings.kind} · ${settings.kind==='shooting'?settings.range+' inches':band.range} · goal: ${settings.goal} · controls belong to the requester`}}],components:[
    menu(s.id,'view','Choose view',[['summary','Summary'],['ranges','All ranges'],['ammo','Weapons / ammunition'],['aros','Compare AROs'],['explain','Explain calculation'],['orders','Repeated orders']].map(([value,label])=>({value,label,default:s.view===value}))),
    menu(s.id,'weapon','Weapon / ammunition',options.map((o,i)=>({...o,value:String(i)}))),
    menu(s.id,'aro','Defender response',s.aros.map((value,i)=>({label:value==='auto'?'Auto: minimize selected goal':value,value:String(i),default:settings.aro===value}))),
    row([button(s.id,'swap','Swap turns'),button(s.id,'settings','Conditions'),button(s.id,'range','Range / combat / goal'),button(s.id,'save','Save preset'),button(s.id,'load','Load preset')])],allowedMentions:{parse:[]}}
}
export async function startWorkbench(interaction,{calculate=calculateWorkbench}={}){
  await interaction.deferReply()
  try{
    const source=await loadMatchupSource(),link=interaction.options.getString('calculator-link')
    const imported=link?importedMatchup(link,source):null
    const modelOne=interaction.options.getString('model-1')||imported?.modelOne,modelTwo=interaction.options.getString('model-2')||imported?.modelTwo
    if(!modelOne||!modelTwo)throw Error('Select both model profiles, or provide a calculator-link.')
    const s={id:randomUUID(),owner:interaction.user.id,guild:interaction.guildId,at:Date.now(),modelOne,modelTwo,alternative:interaction.options.getString('alternative'),settings:{...DEFAULT_MATCHUP_SETTINGS,...imported?.settings,range:interaction.options.getString('range')||imported?.settings.range||DEFAULT_MATCHUP_SETTINGS.range,kind:interaction.options.getString('combat-type')||'shooting',goal:interaction.options.getString('goal')||'neutralize'},view:'summary',note:imported?.note}
    const result=await calculate({...s,source}),payload=workbenchPayload(s,result);await saveSession(s);await prune();await interaction.editReply(payload)
  }catch(e){await interaction.editReply({content:e.message,allowedMentions:{parse:[]}})}
  return true
}
export function createWorkbenchInteractionHandler({calculate=calculateWorkbench,logger=console}={}){return async interaction=>{
  if(!(interaction.isButton?.()||interaction.isStringSelectMenu?.()||interaction.isModalSubmit?.())||!interaction.customId?.startsWith('lobo-matchup:'))return false
  const [,id,action]=interaction.customId.split(':'),stored=await loadSession(id)
  if(!stored){await interaction.reply({content:'This matchup expired. Run /combat matchup again.',ephemeral:true});return true}
  if(stored.owner!==interaction.user.id||stored.guild!==interaction.guildId){await interaction.reply({content:'These controls belong to the requester. Run /combat matchup for your own comparison.',ephemeral:true});return true}
  if(locks.has(id)){await interaction.reply({content:'A calculation is in progress. Try again in a moment.',ephemeral:true});return true}
  const s=structuredClone(stored)
  if(action==='settings'){
    await interaction.showModal({custom_id:`lobo-matchup:${id}:conditions-submit`,title:'Matchup conditions (models 1,2)',components:[text('cover','Cover: two values on/off',`${s.settings.cover1?'on':'off'},${s.settings.cover2?'on':'off'}`,'on,off'),text('linked','Fireteam +1SD: two values on/off',`${s.settings.linked1?'on':'off'},${s.settings.linked2?'on':'off'}`,'off,on'),text('wounds','Remaining W/STR: two values or full',`${s.settings.wounds1??'full'},${s.settings.wounds2??'full'}`,'full,1'),text('states','States: normal,targeted,nwi,dogged,isolated,imm-a/b',`${s.settings.state1},${s.settings.state2}`,'normal,targeted'),text('firewalls','External Firewall: two values 0/3/6',`${s.settings.firewall1},${s.settings.firewall2}`,'0,3')]});return true
  }
  if(action==='range'){
    await interaction.showModal({custom_id:`lobo-matchup:${id}:range-submit`,title:'Range, combat and comparison',components:[text('range','Range band',s.settings.range,'0-8,8-16,16-24,24-32,32-40,40-48,48-96'),text('kind','Combat: shooting / cc / hacking',s.settings.kind,'shooting'),text('goal','Goal: damage / neutralize / kill / state',s.settings.goal,'neutralize'),text('alternative','Alternative attacker profile ID (optional)',s.alternative,'Use an autocomplete profile ID')]});return true
  }
  if(action==='save'||action==='load'){
    await interaction.showModal({custom_id:`lobo-matchup:${id}:${action}-submit`,title:action==='save'?'Save matchup preset':'Load matchup preset',components:[text('name','Preset name (1–40 letters, digits, spaces)',null,'My usual Fireteam')]});return true
  }
  locks.add(id)
  try{
    await interaction.deferUpdate()
    if(action==='swap'){s.settings.direction=1-s.settings.direction;s.settings.weapon='auto';s.settings.aro='auto'}
    else if(action==='view')s.view=interaction.values[0]
    else if(action==='weapon'){const value=s.weapons[Number(interaction.values[0])];if(value==null)throw Error('Weapon choice expired.');s.settings.weapon=value;s.settings.aro='auto'}
    else if(action==='aro'){const value=s.aros[Number(interaction.values[0])];if(value==null)throw Error('ARO choice expired.');s.settings.aro=value}
    else if(action==='conditions-submit'){
      const pair=key=>interaction.fields.getTextInputValue(key).toLowerCase().split(',').map(x=>x.trim())
      for(const [field,key]of [['cover','cover'],['linked','linked'],['wounds','wounds'],['states','state'],['firewalls','firewall']]){
        const values=pair(field);if(values.length!==2)throw Error(`${field}: enter two values separated by a comma.`)
        values.forEach((value,i)=>{if(key==='cover'||key==='linked'){if(!['on','off'].includes(value))throw Error('Cover and Fireteam values must be on or off.');s.settings[key+(i+1)]=value==='on'}else if(key==='wounds')s.settings[key+(i+1)]=value==='full'?null:Number(value);else if(key==='state'){if(!MATCHUP_STATES.includes(value))throw Error('Invalid state.');s.settings[key+(i+1)]=value}else{if(!['0','3','6'].includes(value))throw Error('Firewall must be 0,3 or 6.');s.settings[key+(i+1)]=Number(value)}})
      }
    } else if(action==='range-submit'){
      for(const key of ['range','kind','goal'])s.settings[key]=interaction.fields.getTextInputValue(key).trim().toLowerCase()
      s.alternative=interaction.fields.getTextInputValue('alternative').trim()||null;s.settings.weapon='auto';s.settings.aro='auto'
    } else if(action==='save-submit'||action==='load-submit'){
      const name=interaction.fields.getTextInputValue('name').trim().toLowerCase();if(['__proto__','constructor','prototype'].includes(name)||!/^[a-z0-9 _-]{1,40}$/.test(name))throw Error('Preset name must use 1–40 letters, digits, spaces, underscores or hyphens.')
      const owner=`${interaction.guildId||'dm'}-${interaction.user.id}`;if(!/^[\w-]+$/.test(owner))throw Error('Invalid owner.')
      const path=join(directory(),`presets-${owner}.json`);let presets={};try{presets=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
      if(action==='save-submit'){if(!Object.hasOwn(presets,name)&&Object.keys(presets).length>=20)throw Error('You can save up to 20 presets. Reuse a name to replace one.');presets[name]={modelOne:s.modelOne,modelTwo:s.modelTwo,alternative:s.alternative,settings:s.settings};await writeJson(path,presets);s.note=`Saved preset: ${name}.`}
      else {if(!Object.hasOwn(presets,name))throw Error(`Preset not found. Your presets: ${Object.keys(presets).join(', ')||'none'}`);Object.assign(s,presets[name]);s.note=`Loaded preset: ${name}.`}
    } else throw Error('Unknown matchup control.')
    const result=await calculate(s),payload=workbenchPayload(s,result);s.at=Date.now();await saveSession(s);await interaction.editReply({...await reportableResponse(payload,{command:'combat matchup',requesterId:s.owner,guildId:s.guild,inputs:[{name:'model-1',value:s.modelOne},{name:'model-2',value:s.modelTwo},{name:'conditions',value:JSON.stringify(s.settings)}]}),attachments:[]})
  }catch(e){logger.error?.('Matchup control:',e.message);await interaction.followUp({content:e.message,ephemeral:true,allowedMentions:{parse:[]}})}finally{locks.delete(id)}
  return true
}}
