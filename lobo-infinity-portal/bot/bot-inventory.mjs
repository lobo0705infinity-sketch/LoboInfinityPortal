import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PermissionFlagsBits } from 'discord.js'

const directory = () => process.env.BOT_INVENTORY_PATH || '/data/bot-inventory'
const ongoing = new Map()
const sensitivePermissions = ['Administrator','ManageGuild','ManageRoles','ManageChannels','ManageWebhooks','BanMembers','KickMembers','ModerateMembers','MentionEveryone']
const primaryFunctions = ['Army analysis, three-option builder, random armies, model ID sheets and TTS exports','Rules, missions, profile matchups and ARO counters','Availability, game requests and scheduled reminders','Map and workshop update monitoring','Private help, detail views and incorrect-answer reports']
const values = collection => [...(collection?.values?.() || [])]
const isId = id => /^\d+$/.test(id)
const clean = value => String(value || '').replace(/[\r\n]/g,' ').slice(0,100)
const apiFailure = error => Number(error?.code) === 50013 || Number(error?.status) === 403 ? 'Missing Discord permission.' : Number(error?.code) === 50001 ? 'Discord access is unavailable.' : 'Discord could not complete this inventory source.'
const memberRecord = (member, primaryId) => ({
  id: member.id || member.user.id, name: clean(member.displayName || member.user.username), username: clean(member.user.username),
  type: 'bot', membership: 'current', ownership: member.user.id === primaryId ? 'primary' : 'unverified',
  roles: values(member.roles?.cache).filter(role=>role.id!==member.guild?.id).map(role=>({id:role.id,name:clean(role.name)})),
  elevatedPermissions: sensitivePermissions.filter(name=>member.permissions?.has(PermissionFlagsBits[name])),
  ...(member.user.id===primaryId?{functions:primaryFunctions}:{}), observations:[],
})

// This is a read-only inventory. Permissions and recent activity are evidence,
// not proof of a bot's hosting, owner, complete functions, or redundancy.
export async function collectBotInventory(guild, {primaryId=guild.client.user.id, now=()=>Date.now(), maxChannels=30, historyLimit=50, maxMemberPages=10, budgetMs=60000}={}) {
  const started=now(), bots=new Map(), webhooks=new Map(), checks=[]
  let memberListComplete=false
  const addMember=member=>{if(member.user?.bot)bots.set(member.user.id,memberRecord(member,primaryId))}
  values(guild.members?.cache).forEach(addMember)
  try {
    const roles=await guild.roles.fetch()
    const ids=[...new Set(values(roles).map(role=>role.tags?.botId).filter(Boolean))]
    let rolesComplete=true
    for(const id of ids) {
      if(now()-started>budgetMs){rolesComplete=false;break}
      try{addMember(await guild.members.fetch({user:id,force:true}))}
      catch(error){rolesComplete=false;checks.push({source:`managed bot role ${id}`,complete:false,reason:apiFailure(error)})}
    }
    checks.push({source:'managed bot roles',complete:rolesComplete,...(!rolesComplete?{reason:'Not every managed bot role could be verified.'}:{})})
  } catch(error){checks.push({source:'managed bot roles',complete:false,reason:apiFailure(error)})}
  // REST member listing uses the existing application's permissions. No new
  // Gateway intent is requested, and a denied list falls back to roles/history.
  try {
    let after
    for(let page=0;page<maxMemberPages;page++){
      if(now()-started>budgetMs)break
      const members=await guild.members.list({limit:1000,after,cache:false})
      values(members).forEach(addMember)
      if(members.size<1000){memberListComplete=true;break}
      const next=values(members).at(-1)?.id
      if(!next || next===after)break
      after=next
    }
    checks.push({source:'member list',complete:memberListComplete,...(!memberListComplete?{reason:'Member-page or time limit reached.'}:{})})
  }catch(error){checks.push({source:'member list',complete:false,reason:apiFailure(error)})}
  try {
    const hooks=await guild.fetchWebhooks()
    for(const hook of values(hooks))webhooks.set(hook.id,{id:hook.id,name:clean(hook.name),type:'webhook',channelId:hook.channelId,ownerId:hook.owner?.id || null,applicationId:hook.applicationId || null,ownership:'unverified',observations:[]})
    checks.push({source:'webhooks',complete:true})
  }catch(error){checks.push({source:'webhooks',complete:false,reason:apiFailure(error)})}
  let channels=[],totalTextChannels=0
  try {const textChannels=values(await guild.channels.fetch()).filter(channel=>channel.isTextBased?.()&&channel.messages);totalTextChannels=textChannels.length;channels=textChannels.filter(channel=>channel.viewable!==false);checks.push({source:'channel list',complete:true})}
  catch(error){checks.push({source:'channel list',complete:false,reason:apiFailure(error)})}
  const eligible=channels.filter(channel=>channel.permissionsFor?.(guild.members.me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory]))
  const selected=eligible.slice(0,maxChannels)
  let cursor=0,scanned=0,failed=0
  const scan=async()=>{while(cursor<selected.length && now()-started<=budgetMs){
    const channel=selected[cursor++]
    try {
      const messages=await channel.messages.fetch({limit:historyLimit})
      scanned++
      for(const message of values(messages)){
        if(!message.author?.bot && !message.webhookId)continue
        const map=message.webhookId?webhooks:bots,id=message.webhookId || message.author.id
        let record=map.get(id)
        if(!record){record={id,name:clean(message.author.username),type:message.webhookId?'webhook':'bot',...(message.webhookId?{channelId:channel.id}:{membership:'observed in recent history',ownership:'unverified'}),observations:[]};map.set(id,record)}
        const timestamp=message.createdTimestamp || 0
        if(timestamp>(record.lastObservedAt || 0))record.lastObservedAt=timestamp
        let observed=record.observations.find(x=>x.channelId===channel.id)
        if(!observed){observed={channelId:channel.id,channelName:clean(channel.name),sampledMessages:0};record.observations.push(observed)}
        observed.sampledMessages++
      }
    }catch{failed++}
  }}
  await Promise.all([scan(),scan()])
  checks.push({source:'recent message sample',complete:scanned===eligible.length&&failed===0&&eligible.length===totalTextChannels,scannedChannels:scanned,totalTextChannels,readableChannels:eligible.length,failedChannels:failed,historyLimit,maxChannels,reason:'Sampled messages do not establish inactivity or all responsibilities. Threads and older history are not included.'})
  const sorted=records=>values(records).sort((a,b)=>a.name.localeCompare(b.name))
  return {version:1,guildId:guild.id,guildName:clean(guild.name),at:new Date(now()).toISOString(),primaryBotId:primaryId,memberListComplete,bots:sorted(bots),webhooks:sorted(webhooks),checks,
    production:{primaryService:'Railway / LoboInfinityPortal',repository:'lobo0705infinity-sketch/LoboInfinityPortal',portalAnnouncements:'Apps Script DiscordApi.gs webhook, delivered by the Automation Queue'},
    decision:'Keep Lobo’s Little Helper as the primary bot. No other publisher is proven redundant by this inventory. Do not retire a bot based only on its name, permissions, or an empty recent-message sample.'}
}
export async function refreshBotInventory(guild,{dir=directory(),collect=collectBotInventory}={}) {
  if(!isId(guild.id))throw Error('Invalid guild ID')
  if(ongoing.has(guild.id))return ongoing.get(guild.id)
  const pending=(async()=>{
    const inventory=await collect(guild)
    await mkdir(dir,{recursive:true})
    await writeFile(join(dir,`${guild.id}.json`),JSON.stringify(inventory,null,2),{mode:0o600})
    return inventory
  })()
  ongoing.set(guild.id,pending)
  try{return await pending}finally{ongoing.delete(guild.id)}
}
export async function loadBotInventory(guildId,{dir=directory()}={}) {
  if(!isId(guildId))throw Error('Invalid guild ID')
  const inventory=JSON.parse(await readFile(join(dir,`${guildId}.json`),'utf8'))
  if(inventory.guildId!==guildId)throw Error('Inventory belongs to another server')
  if(inventory.version!==1 || !Number.isFinite(Date.parse(inventory.at)))throw Error('Invalid saved inventory')
  return inventory
}
export function inventoryResponse(inventory) {
  const names=inventory.bots.filter(x=>x.membership==='current').map(x=>clean(x.name)).join(', ') || 'No current bot members verified'
  const incomplete=inventory.checks.filter(x=>!x.complete).length
  const content=`**Bot inventory · ${clean(inventory.guildName)}**\nPrimary bot: **Lobo’s Little Helper**\nVerified current bots: ${names}\nObserved webhook publishers: ${inventory.webhooks.length}\n\n${incomplete?`${incomplete} inventory sources have limited coverage. `:''}The attached report separates bot accounts, webhook publishers, permissions and sampled activity. It contains no message text, webhook tokens or webhook URLs.\n\nUse \`/admin bots refresh:True\` to rescan. Other publishers need verified functions and ownership before retirement.`
  return {content:content.slice(0,1950),files:[{name:'bot-inventory.json',attachment:Buffer.from(JSON.stringify(inventory,null,2))}],allowedMentions:{parse:[]}}
}
export function createBotInventoryHandler({load=loadBotInventory,refresh=refreshBotInventory,logger=console,now=()=>Date.now()}={}) {
  return async interaction=>{
    if(!interaction.isChatInputCommand?.() || interaction.commandName!=='bot-inventory')return false
    if(!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)){
      await interaction.reply({content:'Server managers can review the bot inventory.',flags:64});return true
    }
    await interaction.deferReply({flags:64})
    try{
      let inventory
      if(!interaction.options.getBoolean('refresh')){try{inventory=await load(interaction.guildId)}catch{}}
      if(!inventory || now()-Date.parse(inventory.at)>3600000)inventory=await refresh(interaction.guild)
      await interaction.editReply(inventoryResponse(inventory))
    }catch(error){logger.error?.('Bot inventory failed:',error.message);await interaction.editReply({content:'The bot inventory could not be refreshed. Please try again.',allowedMentions:{parse:[]}})}
    return true
  }
}
export async function inventoryAtStartup(client,{refresh=refreshBotInventory,logger=console}={}) {
  for(const guild of client.guilds.cache.values()){
    try {
      const inventory=await refresh(guild)
      // Never log webhook objects, raw messages or arbitrary upstream errors.
      logger.info(`Bot inventory: ${JSON.stringify({guildId:guild.id,bots:inventory.bots.map(({id,name,membership,elevatedPermissions})=>({id,name,membership,elevatedPermissions})),webhooks:inventory.webhooks.map(({id,name,channelId})=>({id,name,channelId})),memberListComplete:inventory.memberListComplete,checks:inventory.checks})}`)
    }catch{logger.error('Bot inventory could not be collected at startup.')}
  }
}
