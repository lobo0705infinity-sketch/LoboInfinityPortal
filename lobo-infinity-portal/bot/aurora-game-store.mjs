import { mkdir,readFile,open,rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { campaignTotals,validateCampaignGame,campaignText } from '../shared/aurora-games.mjs'
import { operationsView, mutateOperations, guardCampaignGame, validOperations } from './aurora-operations.mjs'
const fail=message=>{throw Error(message)}
export function createCampaignGameStore(path,{now=()=>new Date()}={}) {
  let queue=Promise.resolve()
  const run=action=>{const result=queue.then(action);queue=result.catch(()=>{});return result}
  async function read() {
    try{const s=JSON.parse(await readFile(path,'utf8'));if(s.version!==1||!Array.isArray(s.games)||!Array.isArray(s.claims)||!s.turns||s.operations!==undefined&&!validOperations(s.operations)) fail('Campaign ledger needs commissioner attention.');return s}
    catch(e){if(e.code==='ENOENT')return {version:1,games:[],claims:[],turns:{}};throw e}
  }
  async function write(s) {
    await mkdir(dirname(path),{recursive:true,mode:0o700})
    const temp=`${path}.${randomUUID()}.tmp`,f=await open(temp,'wx',0o600)
    try{await f.writeFile(JSON.stringify(s));await f.sync()}finally{await f.close()}
    await rename(temp,path)
    const d=await open(dirname(path),'r');try{await d.sync()}finally{await d.close()}
  }
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
  const audit=(record,action,actor,detail='')=>{record.history.push({at:now().toISOString(),action,actor,detail});record.revision++}
  const duplicate=(s,g)=>s.games.find(v=>v.id!==g.id&&v.status!=='rejected'&&v.turn===g.turn&&v.date===g.date&&v.location===g.location&&v.mission===g.mission&&[v.playerA.id,v.playerB.id].sort().join()===[g.playerA.id,g.playerB.id].sort().join())
  function setDuplicate(s,g){const d=duplicate(s,g);if(d){g.duplicateOf=d.id;g.duplicateApproved=false}else{delete g.duplicateOf;delete g.duplicateApproved}}
  const confirmedStatus=g=>g.late&&!g.lateApproved?'awaiting_late_approval':g.duplicateOf&&!g.duplicateApproved?'awaiting_duplicate_review':'confirmed'
  return {
    operations:()=>run(async()=>operationsView(await read())),
    operate:(input,players,publication)=>run(async()=>{const s=await read();const result=mutateOperations(s,input,players,publication,now());await write(s);return result}),
    view:(userId,admin,publication)=>run(async()=>{const s=await read();if(publication.turn&&JSON.stringify(s.turns[publication.turn])!==JSON.stringify(publication)){s.turns[publication.turn]=publication;await write(s)}return {games:s.games.filter(g=>admin||g.playerA.id===userId||g.playerB.id===userId),claims:s.claims.filter(c=>admin||c.userId===userId),turns:Object.values(s.turns),totals:campaignTotals(s.games,publication.turn),reporting:s.operations?{turn:publication.turn,phase:s.operations.turns[publication.turn]?.phase||'unprepared'}:null}}),
    totals:turn=>run(async()=>campaignTotals((await read()).games,turn)),
    activity:turn=>run(async()=>{const s=await read(),games=s.games.filter(g=>g.turn===turn&&g.status==='confirmed'&&(!g.late||g.lateApproved)&&(!g.duplicateOf||g.duplicateApproved));return {turn,totals:campaignTotals(games,turn),games:games.map(({id,turn,date,location,mission,playerA,playerB,opA,opB,tpA,tpB})=>({id,turn,date,location,mission,playerA:{name:playerA.name,faction:playerA.faction},playerB:{name:playerB.name,faction:playerB.faction},opA,opB,tpA,tpB}))}}),
    submit:(input,player,opponent,publication)=>run(async()=>{
      const s=await read();if(!player||!opponent||player.userId===opponent.userId)fail('Choose another registered campaign player.')
      guardCampaignGame(s,input.turn,'submit')
      if(player.faction===opponent.faction)fail('Choose an opponent from a different campaign faction. Same-faction games are prohibited.')
      if(publication.turn)s.turns[publication.turn]=publication
      const state=input.turn===publication.turn?publication:s.turns[input.turn];if(!state)fail('This Turn has not been announced.')
      const late=input.turn!==publication.turn||Boolean(state.deadline&&now().getTime()>Date.parse(state.deadline)),project=p=>({id:p.userId,name:p.name,faction:p.faction})
      const g={...validateCampaignGame(input,state,today()),id:randomUUID(),playerA:project(player),playerB:project(opponent),status:'awaiting_confirmation',revision:1,late,lateApproved:false,createdAt:now().toISOString(),history:[],notification:'pending'}
      setDuplicate(s,g);s.games.push(g);await write(s);return g
    }),
    act:(input,userId,admin)=>run(async()=>{
      const s=await read(),g=s.games.find(g=>g.id===input.id);if(!g)fail('Game not found.')
      guardCampaignGame(s,g.turn,'act')
      if(input.revision!==g.revision)fail('This game changed. Reload it before reviewing the result.')
      if(!admin&&![g.playerA.id,g.playerB.id].includes(userId))fail('Only the two registered players can review this game.')
      if(!admin&&g.status==='rejected')fail('This game was rejected. Contact Lobo.')
      if(g.playerA.faction===g.playerB.faction&&!['reject','correction'].includes(input.action))fail('Choose an opponent from a different campaign faction. Same-faction games are prohibited.')
      let reason=''
      if(input.action==='confirm'){
        if(!admin&&g.playerB.id!==userId)fail('Only the registered opponent or Lobo can confirm this game.')
        if(!admin&&g.status!=='awaiting_confirmation')fail('Lobo needs to resolve this game first.')
        g.opponentConfirmed=true;g.status=confirmedStatus(g)
      }else if(input.action==='correction'){
        reason=campaignText(input.reason,2000,'correction explanation',true);g.status='correction_requested';g.correction={by:admin?'commissioner':userId,reason}
      }else{
        if(!admin)fail('Commissioner access is required.')
        reason=campaignText(input.reason,2000,'commissioner explanation',true)
        if(input.action==='approve-late'){if(!g.late)fail('This game is not late.');g.lateApproved=true;if(g.status==='awaiting_late_approval')g.status=g.opponentConfirmed?confirmedStatus(g):'awaiting_confirmation'}
        else if(input.action==='approve'){g.status='confirmed';g.duplicateApproved=true;if(g.late)g.lateApproved=true}
        else if(input.action==='reject')g.status='rejected'
        else if(input.action==='correct'){
          const old={opA:g.opA,opB:g.opB,date:g.date,location:g.location,mission:g.mission}
          Object.assign(g,validateCampaignGame({...g,...input.values,turn:g.turn},s.turns[g.turn],today()))
          g.status='awaiting_confirmation';g.opponentConfirmed=false;delete g.correction;setDuplicate(s,g);g.notification='pending';audit(g,'previous-result','commissioner',JSON.stringify(old))
        }else fail('Choose a valid commissioner action.')
      }
      audit(g,input.action,admin?'commissioner':userId,reason);await write(s);return g
    }),
    claim:(input,player)=>run(async()=>{
      const s=await read(),g=s.games.find(g=>g.id===input.id);if(!g||![g.playerA.id,g.playerB.id].includes(player.userId)||g.status==='rejected')fail('Choose one of your accepted campaign games.')
      const objective=campaignText(input.objective,200,'private objective',true),explanation=campaignText(input.explanation,4000,'private explanation',true)
      if(s.claims.some(c=>c.gameId===g.id&&c.userId===player.userId&&c.objective===objective&&c.status!=='rejected'))fail('You already submitted this claim.')
      const c={id:randomUUID(),gameId:g.id,turn:g.turn,userId:player.userId,name:player.name,faction:g.playerA.id===player.userId?g.playerA.faction:g.playerB.faction,objective,explanation,status:'pending',revision:1,history:[]}
      s.claims.push(c);await write(s);return c
    }),
    reviewClaim:input=>run(async()=>{const s=await read(),c=s.claims.find(c=>c.id===input.id);if(!c||input.revision!==c.revision)fail('Claim changed. Reload before reviewing.');if(!['approved','rejected'].includes(input.status))fail('Choose a claim decision.');const reason=campaignText(input.reason,2000,'private commissioner response',true);c.status=input.status;audit(c,input.status,'commissioner',reason);await write(s);return c}),
    notifications:()=>run(async()=>(await read()).games.filter(g=>g.notification==='pending'&&g.status==='awaiting_confirmation')),
    notified:(id,success)=>run(async()=>{const s=await read(),g=s.games.find(g=>g.id===id);if(g){g.notification=success?'sent':'unavailable';await write(s)}}),
  }
}
