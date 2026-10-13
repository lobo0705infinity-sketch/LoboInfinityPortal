import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'

export const PORTAL_ORIGIN = 'https://lobo-infinity-portal.vercel.app'
export const PORTAL_CALLBACK = `${PORTAL_ORIGIN}/api/aurora-signup?action=callback`
const RETURN_PATH = '/campaign/aurora-vii/register'
const cookie = (name, value, seconds) => `${name}=${value}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`
const cookies = request => Object.fromEntries(String(request.headers.cookie || '').split(';').map(value => value.trim().split('=')))
const safeError = error => /^(You are already|Choose one|Enter a player|That player|That faction|Registration is temporarily|Join Lobo)/.test(error.message) ? error.message : 'Registration could not be completed. Please try again or contact Lobo.'
const project = player => player ? { name: player.name, faction: player.faction, roleStatus: player.roleStatus } : null

export function createPortalRegistration({ clientId, secret = process.env.DISCORD_CLIENT_SECRET, register, joinServer, player, summary, fetchObject = fetch, now = Date.now }) {
  const pending = new Map()
  const sign = value => createHmac('sha256', secret).update(value).digest('base64url')
  function session(request) {
    const token = cookies(request).aurora_session_v2 || cookies(request).aurora_session || ''
    const [payload, signature] = token.split('.')
    if (!payload || !signature || !secret) return null
    const expected = sign(payload)
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
      return /^\d{17,20}$/.test(data.id) && data.expires > now() ? data : null
    } catch { return null }
  }
  function issueSession(user, draft) {
    const payload = Buffer.from(JSON.stringify({ id: user.id, displayName: user.global_name || user.username, draft, expires: now() + 3600000 })).toString('base64url')
    return `${payload}.${sign(payload)}`
  }
  async function body(request) {
    if (!String(request.headers['content-type'] || '').startsWith('application/json')) throw Error('Invalid request.')
    let value = ''
    for await (const chunk of request) { value += chunk; if (Buffer.byteLength(value) > 2048) throw Error('Invalid request.') }
    return JSON.parse(value)
  }
  function validate(input) {
    if (!AURORA_REGISTRATION_FACTIONS.some(faction => faction.id === input.faction)) throw Error('Choose an eligible campaign faction.')
    const name = String(input.name || '').normalize('NFKC').trim()
    if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw Error('Enter a player name between 1 and 80 characters.')
    return { faction: input.faction, name }
  }
  const handle = async function handle(request, response) {
    const url = new URL(request.url, PORTAL_ORIGIN), action = url.searchParams.get('action')
    const json = (status, value) => { response.writeHead(status); response.end(JSON.stringify(value)) }
    const redirect = (result, returnPath = RETURN_PATH) => { response.writeHead(303, { location: `${PORTAL_ORIGIN}${returnPath}${returnPath.includes('?') ? '&' : '?'}signup=${result}` }); response.end() }
    response.setHeader('cache-control', 'no-store')
    response.setHeader('referrer-policy', 'no-referrer')
    for (const [key, value] of pending) if (value.expires <= now()) pending.delete(key)
    if (action === 'config' && request.method === 'GET') return json(200, { ready: Boolean(secret && clientId) })
    if (!secret || !clientId) return json(503, { error: 'Portal registration is awaiting Discord account verification setup. Please contact Lobo.' })
    if (action === 'callback' && request.method === 'GET') {
      const state = url.searchParams.get('state'), intent = pending.get(state)
      if (!state || cookies(request).aurora_state !== state || !intent) return redirect('expired')
      pending.delete(state)
      response.setHeader('set-cookie', cookie('aurora_state', '', 0))
      if (url.searchParams.has('error') || !url.searchParams.get('code')) return redirect('cancelled', intent.login ? intent.returnPath : RETURN_PATH)
      try {
        const result = await fetchObject('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: PORTAL_CALLBACK }), signal: AbortSignal.timeout(10000) })
        if (!result.ok) throw Error('Discord verification failed.')
        const token = await result.json()
        if (!['identify', 'guilds.join'].every(scope => String(token.scope || '').split(' ').includes(scope))) throw Error('Discord verification failed.')
        const identity = await fetchObject('https://discord.com/api/v10/users/@me', { headers: { authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10000) })
        if (!identity.ok) throw Error('Discord verification failed.')
        const user = await identity.json()
        if (!/^\d{17,20}$/.test(user.id) || user.bot) throw Error('Discord verification failed.')
        // Tokens are never sent to the browser or retained. Only a signed, short-lived identity cookie remains.
        response.setHeader('set-cookie', [cookie('aurora_state', '', 0), cookie('aurora_session_v2', issueSession(user, intent.input), 3600)])
        if (intent.login) return redirect('verified', intent.returnPath)
        try { await joinServer(user.id, token.access_token); await register({ ...intent.input, userId: user.id }); return redirect('complete') }
        catch { return redirect('retry') }
      } catch { return redirect('verification-failed', intent.login ? intent.returnPath : RETURN_PATH) }
    }
    const identity = session(request)
    if (action === 'status' && request.method === 'GET') return json(200, { ready: true, account: identity ? { displayName: identity.displayName } : null, registration: identity ? project(await player(identity.id)) : null, draft: identity?.draft || null })
    if (!['start', 'register', 'login'].includes(action) || request.method !== 'POST') return json(405, { error: 'Method not allowed.' })
    if (request.headers.origin !== PORTAL_ORIGIN) return json(403, { error: 'Open registration on the Lobo Portal.' })
    try {
      const raw = await body(request)
      const login = action === 'login'
      const input = login ? null : validate(raw)
      const returnPath = login && /^\/campaign\/aurora-vii\/(submit|games)(\?game=[a-f0-9-]{36})?$/.test(raw.returnPath || '') ? raw.returnPath : '/campaign/aurora-vii/submit'
      if (identity && !login) return json(200, { registration: project(await register({ ...input, userId: identity.id })) })
      if (action === 'register') return json(401, { error: 'Confirm your Discord account before registering.' })
      const counts = await summary()
      if (!login && counts.factions.find(faction => faction.id === input.faction)?.locked) throw Error('That faction is full. Choose another available faction.')
      if (pending.size >= 1000) return json(429, { error: 'Registration is busy. Please try again shortly.' })
      const state = randomBytes(32).toString('base64url')
      pending.set(state, { input, login, returnPath, expires: now() + 600000 })
      response.setHeader('set-cookie', cookie('aurora_state', state, 600))
      const authorize = new URL('https://discord.com/oauth2/authorize')
      authorize.search = new URLSearchParams({ client_id: clientId, response_type: 'code', scope: 'identify guilds.join', redirect_uri: PORTAL_CALLBACK, state }).toString()
      return json(200, { authorizeUrl: authorize.href })
    } catch (error) { return json(400, { error: safeError(error) }) }
  }
  return Object.assign(handle, { session })
}
