import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, open, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ApplicationCommandOptionType as Type, ChannelType, PermissionFlagsBits } from 'discord.js'
import { AURORA_DISCORD_GUILD_ID } from '../shared/aurora-registration.mjs'

export const TOP40_EVENT_ID = 'event-lobo-s-american-top-40'
export const TOP40_SCHEDULING_CHANNEL_ID = '1541851304228421794'
const TOP40_RESULTS_CHANNEL_ID = '1568051982114230385'
export const TOP40_REMINDER_DELAY_MS = 3 * 24 * 60 * 60 * 1000
export const TOP40_POLL_MS = 60_000
const ORIGIN = 'https://lobo-infinity-portal.vercel.app'
const normalize = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en-US')
const validId = id => /^\d{17,20}$/.test(String(id || ''))
const text = value => String(value || '').replace(/[\r\n<>@`*_]/g, ' ').trim().slice(0,200)
export const top40Key = match => createHash('sha256').update(JSON.stringify([TOP40_EVENT_ID,match.matchId,match.activatedAt,match.playerA,match.playerB])).digest('hex').slice(0,32)

export async function resolveTop40DiscordContacts(guild,contacts) {
  if(!Object.keys(contacts).length)return new Map()
  const members=[];let after,complete=false
  for(let page=0;page<10;page++) {
    const batch=[...(await guild.members.list({limit:1000,after,cache:false})).values()]
    members.push(...batch.filter(m=>!m.user?.bot))
    if(batch.length<1000){complete=true;break}
    after=batch.at(-1)?.id
  }
  if(!complete)throw Error('Discord membership coverage is incomplete.')
  const result=new Map()
  for(const [player,contact] of Object.entries(contacts)) {
    const key=normalize(contact).replace(/^@/,'')
    const found=members.filter(m=>[m.id,m.user?.username,m.user?.globalName,m.displayName,m.user?.tag].some(value=>normalize(value)===key))
    if(found.length===1)result.set(normalize(player),found[0].id)
  }
  return result
}

export function createTop40Store(path = join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data','top40-notifications.json')) {
  async function read() {
    try {
      const state = JSON.parse(await readFile(path,'utf8'))
      if (state.version !== 1 || !state.links || !state.deliveries || typeof state.links !== 'object' || typeof state.deliveries !== 'object' || Array.isArray(state.links) || Array.isArray(state.deliveries)) throw Error('Invalid Top 40 notification ledger.')
      return state
    } catch(error) {
      if (error.code === 'ENOENT') return {version:1,links:{},deliveries:{},channelId:TOP40_SCHEDULING_CHANNEL_ID}
      throw error // Never replace an unreadable existing ledger with an empty one.
    }
  }
  async function write(state) {
    await mkdir(dirname(path),{recursive:true,mode:0o700})
    const temp=`${path}.${randomUUID()}.tmp`,file=await open(temp,'wx',0o600)
    try { await file.writeFile(JSON.stringify(state)); await file.sync() } finally { await file.close() }
    await rename(temp,path)
    const dir=await open(dirname(path),'r');try{await dir.sync()}finally{await dir.close()}
  }
  return {read,write}
}

export function top40ActiveMatches(projection,now=Date.now()) {
  if (projection?.eventId !== TOP40_EVENT_ID || projection?.bracket?.eventId !== TOP40_EVENT_ID || projection?.publicData?.event?.id !== TOP40_EVENT_ID || !Array.isArray(projection.bracket.matches)) throw Error('Top 40 event source is invalid.')
  if (!projection.bracket.released || projection.bracket.tournamentComplete) return []
  const players=new Set((projection.publicData.event.participants || []).filter(p=>['registered','approved'].includes(normalize(p.status))).map(p=>p.player))
  return projection.bracket.matches.filter(m => m.eventId===TOP40_EVENT_ID && m.status==='Active' && !m.winner && !m.gameId && players.has(m.playerA) && players.has(m.playerB) && m.playerA!==m.playerB && m.mission && Number.isFinite(Date.parse(m.activatedAt)) && Date.parse(m.activatedAt)<=now && Number.isFinite(Date.parse(m.deadline)) && Date.parse(m.deadline)-Date.parse(m.activatedAt)>=7*86400000)
}

export function formatTop40Notification(match,users,kind,{catchup=false}={}) {
  if (users.length!==2 || users.some(id=>!validId(id)) || users[0]===users[1]) throw Error('Two verified Discord accounts are required.')
  const deadline=Math.floor(Date.parse(match.deadline)/1000)
  const reminder=kind==='day3' || catchup
  return {
    content:[
      `**Lobo’s Top 40 — ${kind==='day3'?'three-day scheduling check':'your match is live'}**`,
      `<@${users[0]}> vs <@${users[1]}>`,
      `**${text(match.matchId)} · ${text(match.bracket)} Bracket · Round ${Number(match.bracketRound)}**`,
      `Mission: **${text(match.mission)}**`,
      `Map: ${text(match.map) || 'Check the event overview.'}`,
      `Deadline: <t:${deadline}:F> (<t:${deadline}:R>)`,
      reminder?'Have you been able to schedule your match? Please reply with the agreed day/time, or let Lobo know now if you need help contacting your opponent.':'Please contact your opponent and arrange your game. You may change armies and lists between rounds; every list must stay within 300 points.',
      `[Open the bracket](${ORIGIN}/event/lobos-top-40/bracket) · [Submit your result](${ORIGIN}/submit-game)`,
      `-# top40:${top40Key(match)}:${kind}`,
    ].join('\n'),
    allowedMentions:{parse:[],users,roles:[],repliedUser:false},
    nonce:createHash('sha256').update(`${top40Key(match)}:${kind}`).digest('hex').slice(0,24),enforceNonce:true,
  }
}

// Recovery looks back to the *first send attempt*, not merely the last 100
// posts. If coverage cannot be established, delivery waits rather than repeats.
export async function findTop40Delivery(channel,marker,botId,since) {
  let before
  for(let page=0;page<25;page++) {
    const messages=[...(await channel.messages.fetch({limit:100,...(before?{before}:{})})).values()]
    const found=messages.find(m=>m.author?.id===botId && String(m.content || '').includes(marker))
    if(found)return found.id
    if(messages.length<100 || messages.some(m=>m.createdTimestamp<since-5000))return null
    const next=messages.at(-1)?.id
    if(!next || next===before)throw Error('Top 40 notification history could not be verified.')
    before=next
  }
  throw Error('Top 40 notification history coverage is incomplete.')
}

export async function assignTop40Role(guild, linked, expectedCount) {
  const ids=[...linked.values()]
  if(!Number.isInteger(expectedCount) || expectedCount<1 || linked.size!==expectedCount || ids.some(id=>!validId(id)) || new Set(ids).size!==ids.length)throw Error('The confirmed account count changed. Check /top40 status before assigning the role.')
  const members=[]
  for(const [name,id] of linked) {
    const member=await guild.members.fetch({user:id,force:true})
    if(member.user.bot)throw Error('Only confirmed human player accounts can receive this role.')
    members.push({name,member})
  }
  const matches=[...(await guild.roles.fetch()).values()].filter(role=>role.name==='Lobo top 40')
  if(matches.length>1)throw Error('More than one Lobo top 40 role exists. Resolve the duplicate roles first.')
  let role=matches[0]
  if(role && (role.managed || role.permissions.bitfield!==0n || !role.editable))throw Error('The existing role is managed, has additional permissions, or is above the helper. No assignments were changed.')
  if(!role)role=await guild.roles.create({name:'Lobo top 40',permissions:[],hoist:false,mentionable:false,reason:'Lobo requested a role for the confirmed Top 40 player accounts.'})
  let assigned=0,already=0;const failed=[]
  for(const {name,member} of members) {
    if(member.roles.cache.has(role.id)){already++;continue}
    try {
      const updated=await member.roles.add(role,'Lobo requested assignment to confirmed Top 40 players.')
      if(!updated.roles.cache.has(role.id))throw Error('Role assignment could not be verified.')
      assigned++
    } catch {failed.push(name)}
  }
  return {assigned,already,failed}
}

export const TOP40_COMMAND = {
  name:'top40',description:'Manage Top 40 matchup pings and three-day scheduling checks',dmPermission:false,defaultMemberPermissions:PermissionFlagsBits.ManageGuild.toString(),
  options:[
    {name:'status',description:'Check bracket monitoring and player account links',type:Type.Subcommand},
    {name:'role',description:'Lobo only: assign Lobo top 40 to the confirmed player accounts',type:Type.Subcommand,options:[{name:'expected_count',description:'Expected number of confirmed players; stops if the count changed',type:Type.Integer,required:true,minValue:1,maxValue:1000}]},
    {name:'link',description:'Lobo only: confirm a portal player’s Discord account',type:Type.Subcommand,options:[{name:'player',description:'Exact Top 40 portal player name',type:Type.String,required:true},{name:'account',description:'The verified Discord player',type:Type.User,required:true}]},
    {name:'channel',description:'Lobo only: choose the Top 40 scheduling channel',type:Type.Subcommand,options:[{name:'destination',description:'The event scheduling channel',type:Type.Channel,required:true,channelTypes:[ChannelType.GuildText]}]},
  ],
}

export function top40Upsets(projection) {
  const {event,games}=projection.publicData || {}
  if(event?.id!==TOP40_EVENT_ID || !Array.isArray(games))return []
  const byId=new Map(games.filter(game=>game.eventId===TOP40_EVENT_ID).map(game=>[game.id,game]))
  return (event.bracket || []).flatMap(match=>{
    const game=byId.get(Number(match.gameId))
    if(match.status!=='Completed' || normalize(match.resolution)==='forfeit' || !game || !match.winner || !match.loser)return []
    const winner=normalize(match.winner),loser=normalize(match.loser)
    const sides=[[game.player1,game.player1DisplayName],[game.player2,game.player2DisplayName]]
    const winningSide=sides.findIndex(side=>normalize(side[0])===normalize(game.winner))
    if(!game.winner || winningSide<0 || !sides[winningSide].some(name=>normalize(name)===winner) ||
      !sides[1-winningSide].some(name=>normalize(name)===loser))return []
    const aWon=winner===normalize(match.playerA)
    if(winner!==normalize(aWon?match.playerA:match.playerB) || loser!==normalize(aWon?match.playerB:match.playerA))return []
    const winningSeed=Number(aWon?match.seedA:match.seedB),losingSeed=Number(aWon?match.seedB:match.seedA)
    const gap=winningSeed-losingSeed
    if(!Number.isInteger(winningSeed) || !Number.isInteger(losingSeed) || losingSeed<1 || gap<8)return []
    const op=String(game.op || '').match(/^(\d+)\s*[-–—]\s*(\d+)$/)
    const score=op?`, ${op[1]}–${op[2]} OP`:''
    const label=gap>=15?'Major upset':'Upset'
    return [{id:game.id,line:`**${label}** · #${winningSeed} ${text(match.winner).slice(0,64)} beat #${losingSeed} ${text(match.loser).slice(0,64)}${score} (gap: ${gap}). <${ORIGIN}/games/${game.id}>`}]
  })
}

export function createTop40Notifications({store=createTop40Store(),registeredPlayers=async()=>[],fetchObject=fetch,now=Date.now,logger=console,loadProjection,resolveAccounts,registeredContacts=process.env.TOP40_REGISTERED_DISCORD_CONTACTS || '{}'}={}) {
  let client,guild,timer,queue=Promise.resolve(),last={enabled:true,checkedAt:null,issue:'Starting',registered:0,linked:0,missing:[],active:0}
  const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p}
  async function source() {
    if(loadProjection)return loadProjection()
    const r=await fetchObject(`${ORIGIN}/api/public-event-projection?eventId=${TOP40_EVENT_ID}`,{cache:'no-store',signal:AbortSignal.timeout(15_000)})
    if(!r.ok)throw Error('Top 40 bracket source is unavailable.')
    const data=await r.json();if(!data.success)throw Error('Top 40 bracket source is unavailable.')
    return data.projection
  }
  async function accounts(projection,state) {
    if(resolveAccounts)return resolveAccounts(projection,state)
    const known=await registeredPlayers(),names=projection.publicData.event.participants.filter(p=>['registered','approved'].includes(normalize(p.status))).map(p=>p.player),result=new Map()
    let contacts=new Map()
    const configured=typeof registeredContacts==='string'?JSON.parse(registeredContacts):registeredContacts
    const eligible=Object.fromEntries(Object.entries(configured).filter(([name])=>names.some(n=>normalize(n)===normalize(name))))
    if(names.some(name=>!state.links[normalize(name)] && !known.some(p=>normalize(p.name)===normalize(name)))) {
      try {contacts=await resolveTop40DiscordContacts(guild,eligible)} catch { /* Existing verified links remain usable; unresolved contacts wait. */ }
    }
    for(const name of names) {
      const explicit=state.links[normalize(name)]
      const registered=known.filter(p=>normalize(p.name)===normalize(name))
      // A self-linked campaign registration or an explicit owner-confirmed
      // account is authoritative. Display-name similarity is never sufficient.
      const id=explicit?.userId || (registered.length===1 ? registered[0].userId : null) || contacts.get(normalize(name))
      if(!validId(id))continue
      try {
        const member=await guild.members.fetch(id)
        if(!member.user.bot) {
          result.set(name,id)
          if(!explicit)state.links[normalize(name)]={userId:id,playerName:name,source:contacts.get(normalize(name))===id?'Top 40 registration Discord contact':'Self-linked campaign registration',confirmedAt:new Date(now()).toISOString()}
          else explicit.playerName=name
        }
      } catch {/* Leave this player unresolved. */}
    }
    const counts=new Map();for(const id of result.values())counts.set(id,(counts.get(id)||0)+1)
    for(const [name,id] of result)if(counts.get(id)>1)result.delete(name)
    await store.write(state)
    return result
  }
  async function publishUpsets(projection,state,names,linked) {
    const upsets=top40Upsets(projection)
    if(!upsets.length || !names.length || names.some(name=>!validId(linked.get(name))))return
    const users=[...new Set(names.map(name=>linked.get(name)))]
    if(users.length!==names.length)return

    const results=state.results ||= {sent:{}}
    const pending=upsets.filter(item=>!results.sent[item.id])
    if(!pending.length && !results.batch)return

    const channel=await client.channels.fetch(TOP40_RESULTS_CHANNEL_ID)
    if(channel?.id!==TOP40_RESULTS_CHANNEL_ID || channel.guildId!==AURORA_DISCORD_GUILD_ID || channel.type!==ChannelType.GuildText)throw Error('Top 40 results channel is unavailable.')
    const me=guild.members.me || await guild.members.fetchMe()
    if(!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]))throw Error('Top 40 results channel permissions are incomplete.')

    if(!results.batch) {
      const ids=pending.slice(0,3).map(item=>item.id)
      results.batch={ids,firstAttemptAt:now(),marker:`top40:results:${ids.join('-')}:${now()}`}
      await store.write(state)
    }
    const batch=results.batch
    const previous=await findTop40Delivery(channel,batch.marker,client.user.id,batch.firstAttemptAt)
    const current=upsets.filter(item=>batch.ids.includes(item.id))
    if(previous || current.length) {
      const content=[users.map(id=>`<@${id}>`).join(' '),'**Lobo’s Top 40 Results**',...current.map(item=>item.line),`-# ${batch.marker}`].join('\n')
      const nonce=createHash('sha256').update(batch.marker).digest('hex').slice(0,24)
      const message=previous?{id:previous}:await channel.send({content,nonce,enforceNonce:true,allowedMentions:{parse:[],users}})
      for(const id of previous?batch.ids:current.map(item=>item.id))results.sent[id]=message.id
    }
    delete results.batch
    await store.write(state)
  }
  async function tickInner() {
    const projection=await source(),matches=top40ActiveMatches(projection,now()),state=await store.read(),linked=await accounts(projection,state)
    const names=projection.publicData.event.participants.filter(p=>['registered','approved'].includes(normalize(p.status))).map(p=>p.player)
    last={enabled:true,checkedAt:new Date(now()).toISOString(),issue:'',registered:names.length,linked:linked.size,missing:names.filter(n=>!linked.has(n)),active:matches.length}
    const channel=await client.channels.fetch(state.channelId)
    if(channel?.guildId!==AURORA_DISCORD_GUILD_ID || channel.type!==ChannelType.GuildText || !channel.isTextBased())throw Error('Top 40 scheduling channel is unavailable.')
    const me=guild.members.me || await guild.members.fetchMe()
    if(!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]))throw Error('Top 40 scheduling channel needs View Channel, Send Messages and Read Message History.')
    last.channel=channel.name
    for(const match of matches) {
      const users=[linked.get(match.playerA),linked.get(match.playerB)]
      if(users.some(id=>!id))continue
      const key=top40Key(match),day3=now()-Date.parse(match.activatedAt)>=TOP40_REMINDER_DELAY_MS
      const delivery=state.deliveries[key] ||= {}
      const kind=!delivery.live?.sentAt?'live':day3&&!delivery.day3?.sentAt?'day3':null
      if(!kind)continue
      const record=delivery[kind] ||= {firstAttemptAt:now()}
      await store.write(state) // Persist intent before a network send.
      const marker=`top40:${key}:${kind}`
      const previous=await findTop40Delivery(channel,marker,client.user.id,record.firstAttemptAt)
      const message=previous?{id:previous}:await channel.send(formatTop40Notification(match,users,kind,{catchup:kind==='live'&&day3}))
      delivery[kind]={...record,messageId:message.id,sentAt:new Date(now()).toISOString()}
      // A late first notice includes the scheduling question. Avoid two pings
      // together when recovering after a long outage or a missing account link.
      if(kind==='live'&&day3)delivery.day3={...delivery.live,coveredByLiveCatchup:true}
      await store.write(state)
    }
    if(projection.publicData?.games?.length) {
      try {await publishUpsets(projection,state,names,linked)} catch {
        last.resultsIssue='Results delivery will retry.'
        logger.error?.('Top 40 results delivery failed; pending announcements are retained.')
      }
    }
    return last
  }
  const tick=()=>serial(async()=>{try{return await tickInner()}catch{last={...last,issue:'Monitoring or delivery is temporarily unavailable; pending notifications are retained.'};logger.error?.('Top 40 matchup notifications: check failed; delivery will retry without clearing state.');return last}})
  async function handler(interaction) {
    if(!interaction.isChatInputCommand?.() || interaction.commandName!=='top40')return false
    await interaction.deferReply({flags:64})
    const reply=content=>interaction.editReply({content,allowedMentions:{parse:[]}})
    if(interaction.guildId!==AURORA_DISCORD_GUILD_ID || interaction.user.id!==guild?.ownerId){await reply('Only Lobo, the server owner, can manage Top 40 notifications.');return true}
    await serial(async()=>{
      try {
        const command=interaction.options.getSubcommand(),state=await store.read()
        if(command==='link') {
          const projection=await source(),name=interaction.options.getString('player',true).trim(),roster=projection.publicData?.event?.participants || []
          if(!roster.some(p=>p.player===name&&['registered','approved'].includes(normalize(p.status)))){await reply('Enter an exact registered Top 40 player name from the bracket.');return}
          const user=interaction.options.getUser('account',true),member=await guild.members.fetch(user.id)
          if(member.user.bot){await reply('Choose the player’s human Discord account.');return}
          if(Object.entries(state.links).some(([key,value])=>key!==normalize(name)&&value.userId===user.id)){await reply('That account is already linked to another Top 40 player.');return}
          state.links[normalize(name)]={userId:user.id,playerName:name,confirmedBy:interaction.user.id,confirmedAt:new Date(now()).toISOString()};await store.write(state)
          await reply(`Confirmed the Discord account for ${text(name)}. Match notifications will use this account.`)
        } else if(command==='role') {
          const projection=await source(),linked=await accounts(projection,state)
          try {
            const result=await assignTop40Role(guild,linked,interaction.options.getInteger('expected_count',true))
            await reply(`Lobo top 40: ${result.assigned+result.already}/${linked.size} confirmed players have the role (${result.assigned} assigned, ${result.already} already assigned).${result.failed.length?` Could not assign: ${result.failed.map(text).join(', ')}. You can retry the command.`:''}`)
          } catch(error){await reply(text(error.message))}
        } else if(command==='channel') {
          const selected=interaction.options.getChannel('destination',true)
          if(selected.guildId!==AURORA_DISCORD_GUILD_ID || selected.type!==ChannelType.GuildText){await reply('Choose a text channel in this server.');return}
          state.channelId=selected.id;await store.write(state);await reply(`Top 40 notifications will use #${text(selected.name)}.`)
        } else await reply(`Top 40: ${last.linked}/${last.registered} player accounts linked; ${last.active} active matches.\nLaunch notice: when a match becomes active. Scheduling check: 72 hours after activation, only while still active.\n${last.missing.length?`Account links needed: ${last.missing.map(text).join(', ')}. Use /top40 link.`:'All current players are linked.'}\n${last.issue || 'Monitoring is running.'}`)
      } catch {await reply('The update could not be completed. Existing notification settings were retained.')}
    });return true
  }
  return {handler,tick,summary:()=>({...last,missing:undefined,unlinked:last.missing.length}),
    linkedPlayers: guildId => serial(async()=>guildId===AURORA_DISCORD_GUILD_ID ? Object.entries((await store.read()).links).filter(([,link])=>validId(link.userId)).map(([name,link])=>({userId:link.userId,name:link.playerName || name})) : []),
    async start(connected,{schedule=true}={}) {
      client=connected;guild=client.guilds.cache.get(AURORA_DISCORD_GUILD_ID)
      if(!guild)throw Error('Top 40 server is unavailable.')
      const commands=await guild.commands.fetch(),previous=commands.find(c=>c.name==='top40')
      if(previous)await previous.edit(TOP40_COMMAND);else await guild.commands.create(TOP40_COMMAND)
      await tick()
      if(schedule){timer=setInterval(()=>void tick(),TOP40_POLL_MS);timer.unref?.()}
      logger.info?.(`Top 40 notifications ready: ${last.linked}/${last.registered} accounts linked; ${last.active} active matches; activation pings and 72-hour scheduling checks enabled.`)
    },stop(){clearInterval(timer)},
  }
}
