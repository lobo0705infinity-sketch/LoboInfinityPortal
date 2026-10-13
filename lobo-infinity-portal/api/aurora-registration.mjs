import { AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'

export async function readRegistration(fetchObject = fetch) {
  const result = await fetchObject('https://loboinfinityportal-production.up.railway.app/aurora-vii/registration', { signal: AbortSignal.timeout(8000), cache: 'no-store' })
  if (!result.ok) throw Error('Registration is unavailable.')
  const data = await result.json()
  if (!Number.isSafeInteger(data.cap) || data.cap < 5 || data.cap % 5 || !Number.isSafeInteger(data.total) || data.total < 0 || typeof data.available !== 'boolean' || !Array.isArray(data.factions) || data.factions.length !== AURORA_REGISTRATION_FACTIONS.length) throw Error('Invalid registration summary.')
  const factions = AURORA_REGISTRATION_FACTIONS.map(faction => {
    const value = data.factions.find(item => item.id === faction.id)
    if (!value || !Number.isSafeInteger(value.count) || value.count < 0 || value.count > data.cap) throw Error('Invalid faction count.')
    return { ...faction, count: value.count, locked: value.count >= data.cap }
  })
  if (factions.reduce((sum, faction) => sum + faction.count, 0) !== data.total) throw Error('Invalid registration total.')
  // Public response is a strict count-only projection. Discord identities and
  // player names remain in the bot's private volume ledger.
  return { cap: data.cap, total: data.total, available: data.available, issue: data.available ? '' : 'Registration is temporarily unavailable. Please try again shortly.', factions }
}
export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store'); response.setHeader('x-content-type-options', 'nosniff')
  if (request.method !== 'GET') { response.setHeader('allow', 'GET'); return response.status(405).json({ error: 'Method not allowed.' }) }
  try { return response.status(200).json(await readRegistration()) }
  catch { return response.status(503).json({ error: 'Live registration counts are temporarily unavailable. Please try again shortly.' }) }
}
