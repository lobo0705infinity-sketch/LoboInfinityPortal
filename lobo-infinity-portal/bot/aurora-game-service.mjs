import { createCampaignGameStore } from './aurora-game-store.mjs'
import { PORTAL_ORIGIN } from './aurora-portal-registration.mjs'
import { validateAuroraPublicState } from '../shared/aurora-public-state.mjs'
import { PRACTICE_ACTIONS, reportingPractice } from './aurora-reporting-practice.mjs'
export function createCampaignGameService({registrations,identity,notify,store=createCampaignGameStore(process.env.AURORA_GAMES_PATH||'/data/aurora-vii-games.json'),practiceStore=createCampaignGameStore(`${process.env.AURORA_GAMES_PATH||'/data/aurora-vii-games.json'}.practice.json`,{allowPracticeReset:true}),fetchObject=fetch}) {
  if (store === practiceStore) throw Error('Practice and live reporting require separate stores.')
  async function publication(){const r=await fetchObject(`${PORTAL_ORIGIN}/api/aurora-campaign`,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Campaign briefing is unavailable. Try again shortly.');return validateAuroraPublicState((await r.json()).state)}
  async function admin(request){if(!request.headers.authorization)return false;const r=await fetchObject(`${PORTAL_ORIGIN}/api/aurora-games?action=verify-admin`,{headers:{authorization:request.headers.authorization},signal:AbortSignal.timeout(20000)});return r.ok&&(await r.json()).authorized===true}
  let delivery=Promise.resolve()
  const deliver=()=>{delivery=delivery.catch(()=>{}).then(async()=>{for(const g of await store.notifications()){let success=false;try{await notify(g);success=true}catch{/* Copyable link is always available. */}await store.notified(g.id,success)}});return delivery}
  async function handler(request,response){
    const query=new URL(request.url,PORTAL_ORIGIN).searchParams,action=query.get('action'),practice=PRACTICE_ACTIONS.includes(action),practiceRole=query.get('as')||'a',json=(status,value)=>{response.writeHead(status);response.end(JSON.stringify(value))}
    response.setHeader('cache-control','no-store')
    try{
      if(!['GET','POST'].includes(request.method))return json(405,{error:'Method not allowed.'})
      if(action==='totals'&&request.method==='GET'){const s=await publication();return json(200,await store.activity(s.turn))}
      const adminActions=['admin','admin-action','review-claim','operations','operate',...PRACTICE_ACTIONS]
      const isAdmin=adminActions.includes(action)?await admin(request):false,account=identity(request)
      if(adminActions.includes(action)&&!isAdmin)return json(403,{error:'Commissioner access is required.'})
      if(practice&&request.method==='GET')return action==='practice-mine'?json(200,await reportingPractice(practiceStore,action,practiceRole)):json(405,{error:'Use POST for practice changes.'})
      const player=!practice&&account?await registrations.player(account.id):null
      if(!isAdmin&&!player)return json(401,{error:'Sign in with the Discord account used for your campaign registration.',signedIn:Boolean(account)})
      if(request.method==='GET'){
        if(action==='operations')return json(200,{operations:await store.operations(),players:(await registrations.players()).map(p=>({id:p.userId,name:p.name,faction:p.faction}))})
        if(!['mine','admin'].includes(action))return json(404,{error:'Not found.'})
        const [s,players]=await Promise.all([publication(),registrations.players()]),view=await store.view(account?.id,isAdmin,s)
        return json(200,{...view,state:s,player:player?{id:player.userId,name:player.name,faction:player.faction}:null,players:players.map(p=>({id:p.userId,name:p.name,faction:p.faction}))})
      }
      if(request.headers.origin!==PORTAL_ORIGIN||!String(request.headers['content-type']||'').startsWith('application/json'))return json(403,{error:'Use the campaign form on the Lobo Portal.'})
      let raw='';for await(const chunk of request){raw+=chunk;if(Buffer.byteLength(raw)>20000)return json(413,{error:'Submission is too large.'})}
      let input;try{input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw Error()}catch{return json(400,{error:'Enter a valid game request.'})}
      if(practice)return action!=='practice-mine'?json(200,await reportingPractice(practiceStore,action,practiceRole,input)):json(405,{error:'Use GET to load practice games.'})
      if(action==='operate'&&isAdmin){const [s,players]=await Promise.all([publication(),registrations.players()]);return json(200,{operations:await store.operate(input,players,s)})}
      if(action==='submit'){const s=await publication(),opponent=await registrations.player(String(input.opponent||'')),game=await store.submit(input,player,opponent,s);await deliver();return json(200,{game,verificationUrl:`${PORTAL_ORIGIN}/campaign/aurora-vii/games?game=${game.id}`})}
      if(['act','admin-action'].includes(action)){const game=await store.act(input,account?.id,isAdmin);if(input.action==='correct')await deliver();return json(200,{game})}
      if(action==='claim')return json(200,{claim:await store.claim(input,player)})
      if(action==='review-claim'&&isAdmin)return json(200,{claim:await store.reviewClaim(input)})
      return json(404,{error:'Not found.'})
    }catch(e){const safe=e.code==='CAMPAIGN_RULE'||/^(Choose|Enter|Objective|Photo|This|Only|Commissioner|Game not|Claim|You already|Campaign briefing|Lobo needs)/.test(e.message);return json(safe?400:503,{error:safe?e.message:'Campaign games are temporarily unavailable. Try again shortly.'})}
  }
  return {handler,deliver}
}
