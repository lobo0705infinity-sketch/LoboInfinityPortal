import { verifyCommissionerSession } from './featured-report.mjs'
const WORKER='https://loboinfinityportal-production.up.railway.app',ORIGIN='https://lobo-infinity-portal.vercel.app'
export default async function handler(request,response){
  response.setHeader('cache-control','no-store');response.setHeader('referrer-policy','no-referrer');response.setHeader('x-content-type-options','nosniff')
  const query=new URL(request.url,ORIGIN).searchParams,action=query.get('action')
  if(action==='verify-admin'&&request.method==='GET'){try{return response.status(200).json({authorized:await verifyCommissionerSession(request.headers.authorization)})}catch{return response.status(503).json({authorized:false})}}
  if(!['totals','mine','admin','submit','act','admin-action','claim','review-claim','operations','operate'].includes(action))return response.status(404).json({error:'Not found.'})
  if(!['GET','POST'].includes(request.method))return response.status(405).json({error:'Method not allowed.'})
  if(request.method==='POST'&&(request.headers.origin!==ORIGIN||!String(request.headers['content-type']||'').startsWith('application/json')))return response.status(403).json({error:'Use the campaign form on the Lobo Portal.'})
  const body=request.method==='POST'?JSON.stringify(request.body):undefined
  if(body&&Buffer.byteLength(body)>20000)return response.status(413).json({error:'Submission is too large.'})
  try{const r=await fetch(`${WORKER}/aurora-vii/games?${query}`,{method:request.method,body,headers:{'content-type':'application/json',cookie:request.headers.cookie||'',origin:request.headers.origin||'',...(request.headers.authorization?{authorization:request.headers.authorization}:{})},signal:AbortSignal.timeout(55000)});response.setHeader('content-type','application/json; charset=utf-8');return response.status(r.status).send(await r.text())}
  catch{return response.status(503).json({error:'Campaign games are temporarily unavailable. Try again shortly.'})}
}
