// Public confirmed records only. Never forward identity, claims or private game fields.
export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store')
  response.setHeader('Vercel-CDN-Cache-Control', 'no-store')
  if (request.method !== 'GET') return response.status(405).json({error:'Method not allowed.'})
  try {
    const upstream = await fetch('https://loboinfinityportal-production.up.railway.app/aurora-vii/games?action=totals', {signal:AbortSignal.timeout(15000)})
    if (!upstream.ok) throw Error('Unavailable')
    const data = await upstream.json()
    if (!Number.isInteger(data.turn) || !Array.isArray(data.games) || !Array.isArray(data.totals)) throw Error('Invalid activity')
    const publicActivity = {turn:data.turn, totals:data.totals.map(({location,faction,tp,op})=>({location,faction,tp,op})), games:data.games.map(({id,turn,date,location,mission,playerA,playerB,opA,opB,tpA,tpB})=>({id,turn,date,location,mission,playerA:{name:playerA.name,faction:playerA.faction},playerB:{name:playerB.name,faction:playerB.faction},opA,opB,tpA,tpB}))}
    const manual = new URL(request.url || '/api/aurora-activity', 'https://lobo-infinity-portal.vercel.app').searchParams.get('refresh') === '1'
    if (!manual) {
      response.setHeader('cache-control', 'public, max-age=0, must-revalidate')
      response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=60')
    }
    return response.status(200).json(publicActivity)
  } catch { return response.status(503).json({error:'Confirmed battle activity is not available yet.'}) }
}
