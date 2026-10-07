import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

export const RESPONSE_DETAILS = Symbol('response-details')
const directory = () => process.env.BOT_RESPONSE_PATH || '/data/bot-response-details'
const ttl = 7 * 86400000
const maxCacheBytes = 512 * 1024 * 1024
let cacheWrites = Promise.resolve()
const validId = id => /^[a-f0-9-]{36}$/.test(id)
const button = (id, action, label) => ({type:2,style:2,label,custom_id:`lobo-detail:${id}:${action}`})
const cleanPayload = payload => ({content:payload.content || '', embeds:(payload.embeds || []).map(x=>x.toJSON?.() || x), files:payload.files || [], allowedMentions:{parse:[]}})
function pack(payload) {
  const cleaned=cleanPayload(payload)
  return {...cleaned,files:cleaned.files.map(file=>{
    if(!Buffer.isBuffer(file.attachment)) throw Error('Unsupported detail attachment')
    return {name:file.name,base64:file.attachment.toString('base64')}
  })}
}
function unpack(payload) {return {...payload, files:payload.files.map(file=>({name:file.name,attachment:Buffer.from(file.base64,'base64')}))}}
export function withResponseDetails(payload, details) {
  Object.defineProperty(payload,RESPONSE_DETAILS,{value:details})
  return payload
}
async function prune(dir, now, reservedBytes) {
  const records=[]
  for(const name of await readdir(dir)) {
    if(!/^[a-f0-9-]{36}\.json$/.test(name))continue
    const path=join(dir,name),info=await stat(path)
    if(now-info.mtimeMs>ttl)await unlink(path)
    else records.push({path,size:info.size,time:info.mtimeMs})
  }
  let size=records.reduce((sum,x)=>sum+x.size,0)
  for(const record of records.sort((a,b)=>a.time-b.time)){
    if(size+reservedBytes<=maxCacheBytes)break
    await unlink(record.path);size-=record.size
  }
}
export async function prepareInteractiveResponse(payload, context, {dir=directory(),now=Date.now()}={}) {
  const details=payload[RESPONSE_DETAILS]
  if(!details)return payload
  const id=randomUUID()
  const snapshot={id,at:now,context,views:Object.fromEntries(Object.entries(details.views || {}).map(([key,view])=>[key,{label:view.label,payload:pack(view.payload)}])),actions:details.actions || {}}
  const encoded=JSON.stringify(snapshot)
  if(Buffer.byteLength(encoded)>20*1024*1024)throw Error('Detail snapshot exceeds storage limit')
  const entries=[...Object.entries(snapshot.views).map(([key,view])=>button(id,key,view.label)),...Object.entries(snapshot.actions).map(([key,action])=>button(id,key,action.label))]
  const components=[]
  for(let offset=0;offset<entries.length;offset+=5)components.push({type:1,components:entries.slice(offset,offset+5)})
  // Leave room for the report button appended by the feedback layer.
  if(components.length>4)throw Error('Too many detail buttons')
  const pending=cacheWrites.catch(()=>{}).then(async()=>{
    await mkdir(dir,{recursive:true})
    await prune(dir,now,Buffer.byteLength(encoded))
    await writeFile(join(dir,`${id}.json`),encoded,{mode:0o600})
  })
  cacheWrites=pending
  await pending
  return {...cleanPayload(details.initial || payload),components}
}
export async function loadResponseSnapshot(id,{dir=directory(),now=Date.now()}={}) {
  if(!validId(id))throw Error('Invalid detail reference')
  const snapshot=JSON.parse(await readFile(join(dir,`${id}.json`),'utf8'))
  if(snapshot.id!==id || now-snapshot.at>ttl)throw Error('This result has expired. Run the original command again.')
  return snapshot
}

// Reuse command handlers for connected actions. The original button interaction
// owns reply state and webhook methods; actions always open an ephemeral reply.
export function actionInteraction(interaction, action) {
  const values=action.values || {}
  const options={data:Object.entries(values).map(([name,value])=>({name,value})),
    getString:(name,required=false)=>{const value=values[name];if(required&&value==null)throw Error(`Missing ${name}`);return value??null},
    getBoolean:name=>values[name]??null,getInteger:name=>values[name]??null,getNumber:name=>values[name]??null}
  return new Proxy(interaction,{get(target,key){
    if(key==='commandName')return action.command
    if(key==='options')return options
    if(key==='isChatInputCommand')return ()=>true
    if(key==='deferReply')return async()=>{if(!target.deferred&&!target.replied)await target.deferReply({flags:64})}
    const value=Reflect.get(target,key,target)
    return typeof value==='function'?value.bind(target):value
  }})
}
export function createDetailInteractionHandler({handlers,report,dir=directory(),logger=console,now=()=>Date.now()}={}) {
  let active=0
  const safeReport=async(payload,context)=>{
    try{return await report(payload,context)}catch(error){logger.error?.('Detail report context could not be saved:',error.message);return payload}
  }
  return async interaction=>{
    if(!interaction.isButton?.() || !interaction.customId.startsWith('lobo-detail:'))return false
    if(interaction.message?.author?.id!==interaction.client.user.id)return false
    const parts=interaction.customId.split(':')
    if(parts.length!==3)return false
    const [,id,key]=parts
    if(!validId(id) || !/^[a-z0-9-]{1,30}$/.test(key || ''))return false
    try{
      await interaction.deferReply({flags:64})
      const snapshot=await loadResponseSnapshot(id,{dir,now:now()})
      if(snapshot.context.guildId!==interaction.guildId || (!interaction.guildId&&snapshot.context.requesterId!==interaction.user.id))throw Error('This result belongs to another conversation.')
      const context={...snapshot.context,requesterId:interaction.user.id,detail:key,sourceMessageUrl:interaction.message.url || null}
      const view=snapshot.views[key]
      if(view){
        let response=unpack(view.payload)
        if(!response.content&&!response.embeds.length&&!response.files.length)response.content='No details were available for this view.'
        await interaction.editReply(await safeReport(response,context));return true
      }
      const action=snapshot.actions[key],handler=action&&handlers[action.command]
      if(!handler)throw Error('This action is unavailable. Run the original command again.')
      if(active>=2){await interaction.editReply('Two connected actions are already running. Please try again shortly.');return true}
      const originalEdit=interaction.editReply.bind(interaction)
      const originalFollowUp=interaction.followUp.bind(interaction)
      const actionContext={...context,command:action.command,inputs:Object.entries(action.values).map(([name,value])=>({name,value}))}
      interaction.editReply=async payload=>originalEdit(await safeReport(payload,actionContext))
      interaction.followUp=async payload=>originalFollowUp(await safeReport(payload,actionContext))
      active++
      try{await handler(actionInteraction(interaction,action))}finally{active--}
      return true
    }catch(error){
      logger.error?.('Detail/action response failed:',error.message)
      const message=error.code==='ENOENT'?'This result is no longer cached. Run the original command again.':error.message.includes('expired')?error.message:'These details could not be loaded. Please run the command again.'
      try{await interaction.editReply({content:message,allowedMentions:{parse:[]}})}catch{}
      return true
    }
  }
}
export function listActions(code) {return {
  analyse:{label:'Analyse This List',command:'inf-list',values:{'army-code':code}},
  identify:{label:'Create ID Sheet',command:'inf-id',values:{'army-code':code}},
}}
export function briefSummary(analysis,classifiedCoverage) {
  const categories=analysis?.categories || {}
  const guns=(categories.gunfighters || []).slice(0,2).map(x=>`${x.unitName}: ${x.nonLinked?.grade || '—'} alone${x.fireteamLinked?.grade?` / ${x.fireteamLinked.grade} linked`:''}`)
  const lines=[]
  if(guns.length)lines.push(`**Gunfighters** ${guns.join(' · ')}`)
  const matched=[categories.gunfighters?.length || 0,(categories.valuableAro?.length || 0)+(categories.disposableAro?.length || 0),categories.closeCombat?.length || 0]
  if(matched.some(Boolean))lines.push(`**Matched rating profiles** Guns ${matched[0]} · ARO ${matched[1]} · CC ${matched[2]}. Linked grades require the appropriate Fireteam.`)
  if(classifiedCoverage?.cards)lines.push('Use **Classifieds** for every card and its qualifying models.')
  return lines.join('\n')
}
