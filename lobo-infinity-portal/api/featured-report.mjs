import { selectFeaturedReport } from '../shared/featured-report.mjs'
import { readPublicDataset } from './_lib/public-snapshot.mjs'
import { readFeaturedReportPin, writeFeaturedReportPin, isValidReportId } from './_lib/featured-report-store.mjs'

export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store')
  response.setHeader('x-content-type-options', 'nosniff')
  if (request.method === 'GET') {
    try {
      return response.status(200).json({ pinnedId: await readFeaturedReportPin() })
    } catch (error) {
      console.error('Featured report read failed:', error)
      return response.status(503).json({ error: 'The featured report setting is temporarily unavailable.' })
    }
  }
  if (request.method !== 'POST') {
    response.setHeader('allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  try {
    const authorized = await verifyCommissionerSession(request.headers?.authorization)
    if (!authorized) return response.status(403).json({ error: 'Commissioner access is required.' })

    let body
    try { body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body }
    catch { return response.status(400).json({ error: 'Invalid request body.' }) }
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'pinnedId')) {
      return response.status(400).json({ error: 'Choose one report or automatic selection.' })
    }
    const pinnedId = body.pinnedId
    if (pinnedId !== null && !isValidReportId(pinnedId)) {
      return response.status(400).json({ error: 'Invalid report ID.' })
    }
    if (pinnedId !== null) {
      const games = await readPublicDataset('games')
      if (selectFeaturedReport(games, pinnedId)?.id !== pinnedId) {
        return response.status(400).json({ error: 'Choose a published battle report.' })
      }
    }
    await writeFeaturedReportPin(pinnedId)
    return response.status(200).json({ pinnedId })
  } catch (error) {
    console.error('Featured report update failed:', error)
    return response.status(503).json({ error: 'Could not save the featured report. Please try again.' })
  }
}

export async function verifyCommissionerSession(authorization, fetchObject = fetch) {
  const match = /^Bearer ([A-Za-z0-9._~=-]{20,512})$/i.exec(String(authorization || '').trim())
  if (!match) return false
  const apiUrl = new URL(String(process.env.VITE_API_URL || ''))
  if (apiUrl.protocol !== 'https:' || apiUrl.hostname !== 'script.google.com') {
    throw new Error('Commissioner session verifier is not configured')
  }
  const upstream = await fetchObject(apiUrl, {
    method: 'POST', redirect: 'follow', signal: AbortSignal.timeout(15_000),
    body: new URLSearchParams({ action: 'session', sessionToken: match[1] }),
  })
  if (!upstream.ok) throw new Error('Commissioner session verification unavailable')
  const session = await upstream.json()
  return session?.success === true && session?.authenticated === true
    && session?.user?.role === 'Commissioner' && session?.permissions?.manageSettings === true
}
