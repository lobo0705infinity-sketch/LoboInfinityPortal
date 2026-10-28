import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { createCampaignGameStore } from '../bot/aurora-game-store.mjs'
import { createCampaignGameService } from '../bot/aurora-game-service.mjs'
import { PRACTICE_ACTIONS, PRACTICE_PLAYERS, practicePublication } from '../bot/aurora-reporting-practice.mjs'
import { emptyAuroraState } from '../shared/aurora-public-state.mjs'
const directory = await mkdtemp(join(tmpdir(), 'aurora-practice-')), livePath = join(directory, 'live.json'), practicePath = join(directory, 'practice.json')
const live = createCampaignGameStore(livePath), practiceStore = createCampaignGameStore(practicePath, { allowPracticeReset: true })
let authorized = true, notifications = 0, registrationReads = 0, publicationReads = 0
const publication = emptyAuroraState(), sample = practicePublication()
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const input = { turn: 1, date, kind: 'territory', location: 'nova-prospect', mission: 'Claim the Frontier', opA: 8, opB: 6, opponent: PRACTICE_PLAYERS[1].userId }
await live.submit(input, {userId:'111111111111111111',name:'Live A',faction:'ariadna'}, {userId:'222222222222222222',name:'Live B',faction:'pano'}, sample)
const before = await readFile(livePath, 'utf8')
const service = createCampaignGameService({ store: live, practiceStore, registrations: { player: async () => { registrationReads++; return null }, players: async () => { registrationReads++; return [] } }, identity: () => ({ id: 'signed-in-but-not-a-commissioner' }), notify: async () => { notifications++ }, fetchObject: async url => { if (url.includes('verify-admin')) return { ok: true, json: async () => ({ authorized }) }; publicationReads++; return { ok: true, json: async () => ({ state: publication }) } } })
async function request(action, { method = 'GET', role = 'a', body, origin = 'https://lobo-infinity-portal.vercel.app' } = {}) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []); Object.assign(req, { url: `/aurora-vii/games?action=${action}&as=${role}`, method, headers: { authorization:'Bearer fixture', origin, 'content-type':'application/json' } })
  let status, raw; await service.handler(req, { setHeader() {}, writeHead(code) { status = code }, end(v) { raw = v } }); return { status, value: JSON.parse(raw) }
}
try {
  authorized = false
  for (const action of PRACTICE_ACTIONS) assert.equal((await request(action, { method: action === 'practice-mine' ? 'GET' : 'POST', body: {} })).status, 403)
  authorized = true
  assert.equal((await request('practice-reset')).status, 405)
  assert.equal((await request('practice-mine', { role: 'not-a-role' })).status, 400)
  assert.equal((await request('practice-submit', { method:'POST', body:input, origin:'https://another-site.example' })).status, 403)
  let view = (await request('practice-mine')).value
  assert.equal(view.state.turn, 1); assert.equal(publication.turn, 0); assert.equal(view.player.id, PRACTICE_PLAYERS[0].userId); assert.equal(view.games.length, 0)
  assert.equal((await request('practice-submit', { method:'POST', body:{...input,opA:11} })).status, 400)
  const saved = await request('practice-submit', { method:'POST', body:input }); assert.equal(saved.status, 200)
  const game = saved.value.game; assert.equal(game.tpA, 5); assert.equal(game.tpB, 2); assert.equal(game.status, 'awaiting_confirmation')
  assert.equal(new URL(saved.value.verificationUrl).searchParams.get('as'), 'b'); assert.equal(new URL(saved.value.verificationUrl).searchParams.get('game'), game.id)
  assert.equal((await request('practice-act', { method:'POST', body:{ id:game.id,revision:1,action:'confirm' } })).status, 400)
  assert.equal((await request('practice-admin-action', { method:'POST', role:'a', body:{id:game.id,revision:1,action:'approve',reason:'Attempted role spoof'} })).status, 400)
  let reviewed = await request('practice-act', { method:'POST', role:'b', body:{ id:game.id,revision:1,action:'correction',reason:'Score should be 5' } }); assert.equal(reviewed.value.game.status, 'correction_requested')
  let corrected = await request('practice-admin-action', { method:'POST', role:'commissioner', body:{ id:game.id,revision:reviewed.value.game.revision,action:'correct',reason:'Verified practice correction',values:{opB:5} } }); assert.equal(corrected.value.game.status, 'awaiting_confirmation')
  const confirmed = await request('practice-act', { method:'POST', role:'b', body:{id:game.id,revision:corrected.value.game.revision,action:'confirm'} }); assert.equal(confirmed.value.game.status, 'confirmed')
  assert.equal((await request('practice-act', { method:'POST', role:'b', body:{id:game.id,revision:1,action:'confirm'} })).status, 400)
  const claimed = await request('practice-claim', {method:'POST',body:{id:game.id,objective:'Practice secret',explanation:'Practice explanation'}}); assert.equal(claimed.status,200)
  assert.equal((await request('practice-mine',{role:'b'})).value.claims.length,0)
  assert.equal((await request('practice-review-claim',{role:'b',method:'POST',body:{id:claimed.value.claim.id,revision:1,status:'approved',reason:'Wrong role'}})).status,400)
  assert.equal((await request('practice-review-claim',{role:'commissioner',method:'POST',body:{id:claimed.value.claim.id,revision:1,status:'approved',reason:'Practice approval'}})).status,200)
  assert.equal((await request('practice-mine',{role:'commissioner'})).value.totals.find(t=>t.faction==='Ariadna').tp,5)
  const restarted = createCampaignGameStore(practicePath, {allowPracticeReset:true}); assert.equal((await restarted.view(PRACTICE_PLAYERS[1].userId,false,sample)).games[0].status,'confirmed')
  assert.equal((await request('totals')).value.games.length,0)
  assert.equal((await request('practice-reset',{method:'POST',body:{}})).status,200)
  assert.equal((await request('practice-mine')).value.games.length,0); assert.equal((await request('practice-mine',{role:'commissioner'})).value.claims.length,0)
  await assert.rejects(live.resetPractice(),/Only a practice ledger/)
  assert.equal(await readFile(livePath,'utf8'),before); assert.equal(notifications,0); assert.equal(registrationReads,0); assert.equal(publicationReads,1)
  const reverse = await request('practice-submit',{method:'POST',role:'b',body:{...input,opponent:PRACTICE_PLAYERS[0].userId}}); assert.equal(new URL(reverse.value.verificationUrl).searchParams.get('as'),'a')
  assert.throws(()=>createCampaignGameService({store:live,practiceStore:live}),/separate stores/)
  console.log('PASS: commissioner-only practice, real submission/scoring/link/confirmation/correction/claim paths, opponent authorization, stale revisions, restart persistence, disposable reset, bidirectional links, no Discord delivery, no registration changes, live file unchanged and zero public practice results before Turn 1.')
} finally { await rm(directory,{recursive:true,force:true}) }
