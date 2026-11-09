export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' })
  response.setHeader('cache-control', 'public, max-age=0, s-maxage=30')
  response.setHeader('x-content-type-options', 'nosniff')
  try {
    const upstream = await fetch('https://loboinfinityportal-production.up.railway.app/ratings', { signal: AbortSignal.timeout(15000) })
    if (!upstream.ok) throw Error('Ratings are unavailable.')
    const value = await upstream.json()
    if (value.version !== 1 || !Array.isArray(value.leaderboard)) throw Error('Invalid ratings response.')
    return response.status(200).json(value)
  } catch { response.setHeader('cache-control', 'no-store'); return response.status(503).json({ error: 'Player ratings are temporarily unavailable. Please try again shortly.' }) }
}
