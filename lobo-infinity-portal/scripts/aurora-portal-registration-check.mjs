import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createPortalRegistration, PORTAL_ORIGIN, PORTAL_CALLBACK } from '../bot/aurora-portal-registration.mjs'
let time = 1000, registration = null, joined = 0, calls = 0, locked = false, failJoin = false
const id = '123456789012345678'
const handler = createPortalRegistration({ clientId: '987654321098765432', secret: 'test-secret', now: () => time,
  summary: async () => ({ factions: [{ id: 'ariadna', locked }, { id: 'nomads', locked }] }), player: async () => registration,
  joinServer: async (userId, token) => { assert.equal(userId, id); assert.equal(token, 'private-token'); if (failJoin) throw Error('Join failed'); joined++ },
  register: async input => { assert.equal(input.userId, id); assert.equal(joined > 0, true); calls++; if (locked) throw Error('That faction is full.'); registration = { ...input, roleStatus: 'assigned' }; return registration },
  fetchObject: async (url, options) => {
    if (url.endsWith('/token')) { assert.equal(options.body.get('redirect_uri'), PORTAL_CALLBACK); return { ok: true, json: async () => ({ access_token: 'private-token', scope: 'identify guilds.join' }) } }
    return { ok: true, json: async () => ({ id, username: 'Tester' }) }
  },
})
async function request(action, { method = 'GET', body, cookie = '', origin = PORTAL_ORIGIN, query = '' } = {}) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []); req.url = `/aurora-vii/portal?action=${action}${query}`; req.method = method; req.headers = { origin, cookie, 'content-type': 'application/json' }
  const result = { headers: {}, code: 200, text: '' }
  const res = { setHeader: (k,v) => result.headers[k] = v, writeHead: (code, headers = {}) => { result.code = code; Object.assign(result.headers, headers) }, end: text => result.text = text || '' }
  await handler(req, res); return result
}
const input = { faction: 'ariadna', name: 'Player', userId: '999999999999999999' }
assert.equal((await request('start', { method: 'POST', body: input, origin: 'https://evil.example' })).code, 403)
assert.equal((await request('register', { method: 'POST', body: input })).code, 401)
assert.equal((await request('start', { method: 'POST', body: { ...input, faction: 'invalid-faction' } })).code, 400)
assert.equal((await request('start', { method: 'POST', body: { ...input, faction: 'nomads' } })).code, 200)
locked = true
assert.equal((await request('start', { method: 'POST', body: input })).code, 400)
locked = false
const start = await request('start', { method: 'POST', body: input })
const authorize = new URL(JSON.parse(start.text).authorizeUrl), state = authorize.searchParams.get('state')
assert.equal(authorize.searchParams.get('scope'), 'identify guilds.join')
const query = `&state=${state}&code=test`
assert.match((await request('callback', { query })).headers.location, /expired/)
assert.equal(calls, 0)
const complete = await request('callback', { query, cookie: `aurora_state=${state}` })
assert.match(complete.headers.location, /complete/); assert.equal(calls, 1); assert.equal(joined, 1)
assert(!complete.text.includes('private-token'))
const cookie = complete.headers['set-cookie'][1].split(';')[0]
assert.match(cookie, /aurora_session_v2=/)
const status = await request('status', { cookie })
assert.equal(JSON.parse(status.text).registration.faction, 'ariadna'); assert(!status.text.includes(id))
assert.equal(JSON.parse((await request('status', { cookie: `${cookie}tamper` })).text).account, null)
assert.match((await request('callback', { query, cookie: `aurora_state=${state}` })).headers.location, /expired/)
locked = true
assert.equal((await request('register', { method: 'POST', body: input, cookie })).code, 400)
locked = false
failJoin = true
const next = await request('start', { method: 'POST', body: input })
const nextState = new URL(JSON.parse(next.text).authorizeUrl).searchParams.get('state')
const countBefore = calls
assert.match((await request('callback', { query: `&state=${nextState}&code=test`, cookie: `aurora_state=${nextState}` })).headers.location, /retry/)
assert.equal(calls, countBefore)
time += 3600001
assert.equal(JSON.parse((await request('status', { cookie })).text).account, null)
console.log('PASS: browser-bound OAuth state, identify+join consent, automatic join before registration, spoofed identity ignored, closed factions, post-confirmation capacity check, join failure, callback replay, tampered/expired session, private token and identity projection.')
time=1000;failJoin=false
const returnPath='/campaign/aurora-vii/games?game=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const login=await request('login',{method:'POST',body:{returnPath}}),loginState=new URL(JSON.parse(login.text).authorizeUrl).searchParams.get('state'),before=calls,joinedBefore=joined
const verified=await request('callback',{query:`&state=${loginState}&code=test`,cookie:`aurora_state=${loginState}`})
assert.equal(verified.headers.location,`${PORTAL_ORIGIN}${returnPath}&signup=verified`);assert.equal(calls,before);assert.equal(joined,joinedBefore)
assert.match(verified.headers['set-cookie'][1],/Path=\/api;/)
assert.equal(handler.session({headers:{cookie:verified.headers['set-cookie'][1].split(';')[0]}}).id,id)
console.log('PASS: verification link survives login; API-wide signed session; verification never registers or changes factions.')

registration = null
const nomadsStart = await request('start', { method: 'POST', body: { ...input, faction: 'nomads' } })
const nomadsState = new URL(JSON.parse(nomadsStart.text).authorizeUrl).searchParams.get('state')
const nomadsComplete = await request('callback', { query: `&state=${nomadsState}&code=test`, cookie: `aurora_state=${nomadsState}` })
assert.match(nomadsComplete.headers.location, /complete/)
assert.equal(registration.faction, 'nomads')
assert.equal(registration.roleStatus, 'assigned')
const nomadsCookie = nomadsComplete.headers['set-cookie'][1].split(';')[0]
assert.equal(JSON.parse((await request('status', { cookie: nomadsCookie })).text).registration.faction, 'nomads')
console.log('PASS: Nomads OAuth signup completes and returns the assigned campaign faction.')
