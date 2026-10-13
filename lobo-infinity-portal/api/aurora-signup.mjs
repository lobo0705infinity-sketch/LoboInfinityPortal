const WORKER = 'https://loboinfinityportal-production.up.railway.app'
const ORIGIN = 'https://lobo-infinity-portal.vercel.app'
export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store')
  response.setHeader('referrer-policy', 'no-referrer')
  response.setHeader('x-content-type-options', 'nosniff')
  const query = new URL(request.url, ORIGIN).searchParams
  const action = query.get('action')
  if (!['config', 'status', 'start', 'register', 'callback', 'login'].includes(action)) return response.status(404).json({ error: 'Not found.' })
  if (!['GET', 'POST'].includes(request.method)) return response.status(405).json({ error: 'Method not allowed.' })
  if (request.method === 'POST' && (request.headers.origin !== ORIGIN || !String(request.headers['content-type'] || '').startsWith('application/json'))) return response.status(403).json({ error: 'Open registration on the Lobo Portal.' })
  const body = request.method === 'POST' ? JSON.stringify(request.body) : undefined
  if (body && Buffer.byteLength(body) > 2048) return response.status(413).json({ error: 'Request too large.' })
  try {
    const upstream = await fetch(`${WORKER}/aurora-vii/portal?${query}`, { method: request.method, body, headers: { 'content-type': 'application/json', cookie: request.headers.cookie || '', origin: request.headers.origin || '' }, redirect: 'manual', signal: AbortSignal.timeout(25000) })
    const cookies = upstream.headers.getSetCookie()
    if (cookies.length) response.setHeader('set-cookie', cookies)
    const location = upstream.headers.get('location')
    if (location) {
      const destination = new URL(location)
      if (destination.origin !== ORIGIN || !['/campaign/aurora-vii/register', '/campaign/aurora-vii/submit', '/campaign/aurora-vii/games'].includes(destination.pathname)) throw Error('Invalid destination.')
      response.setHeader('location', destination.href)
    }
    response.setHeader('content-type', 'application/json; charset=utf-8')
    return response.status(upstream.status).send(await upstream.text())
  } catch { return response.status(503).json({ error: 'Registration is temporarily unavailable. Please try again shortly.' }) }
}
