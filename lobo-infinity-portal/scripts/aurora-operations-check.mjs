import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { emptyAuroraState } from '../shared/aurora-public-state.mjs'
import { AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'
import { AURORA_FACTIONS, AURORA_CONQUEST_FACTIONS } from '../shared/aurora-public.mjs'
import { mutateOperations, operationsView, resolutionPreview, emptyOperations, guardCampaignGame, validOperations } from '../bot/aurora-operations.mjs'
import { createCampaignGameStore } from '../bot/aurora-game-store.mjs'
import { createCampaignGameService } from '../bot/aurora-game-service.mjs'

const at = new Date('2026-11-02T12:00:00Z')
const players = AURORA_REGISTRATION_FACTIONS.map((f, i) => ({ userId: String(100000000000000000n + BigInt(i)), name: f.name + ' commander', faction: f.id }))
const person = f => players.find(p => p.name === f + ' commander')
function state(n = 1) { const s = emptyAuroraState(); s.turn = n; s.deadline = '2026-12-01T23:59:00-05:00'; s.territories.forEach((t, i) => { t.controller = AURORA_CONQUEST_FACTIONS[i % 8]; t.vulnerable = i < 4 }); s.narrativeMission = { title: 'Released mission', briefing: 'Current public briefing', reward: '', sheetUrl: '' }; return s }
function fixture(n = 1) {
  const ledger = { games: [], claims: [], turns: {}, operations: emptyOperations() }, publication = state(n)
  function act(action, values = {}) { return mutateOperations(ledger, { revision: ledger.operations.revision, turn: n, action, reason: 'Verified private DM / commissioner ruling', ...values }, players, publication, at) }
  for (const f of AURORA_FACTIONS) act('representatives', { faction: f, commander: person(f).userId })
  if (n > 1) ledger.operations.turns[n - 1] = { phase: 'resolved', narrativeBonuses: [] }
  act('prepare')
  const dm = f => ({ sender: person(f).userId, messageUrl: 'https://discord.com/channels/@me/123456789012345678/234567890123456789', note: 'PRIVATE_SENTINEL' })
  return { ledger, publication, act, dm, turn: ledger.operations.turns[n] }
}
function add(ledger, n, location, f, tp, op, status = 'confirmed') {
  // Each fixture row represents one faction's earned result; zero-valued opponent rows are inert.
  ledger.games.push({ id: `g${ledger.games.length}`, turn: n, location, status, late: false, duplicateOf: '', playerA: { id: person(f).userId, name: 'Player', faction: person(f).faction }, playerB: { id: 'other', name: 'Other', faction: 'jsa' }, tpA: tp, opA: op, tpB: 0, opB: 0, revision: 1, history: [] })
}
const loc = i => state().territories[i].id
function defaults(f) { f.act('hidden-hand', { location: loc(0), beneficiary: 'PanOceania', outcome: 'PRESERVE', ...f.dm('Tohaa') }); f.act('infiltration', { location: loc(1), ...f.dm('Combined Army') }) }

// Authorization of representatives and secret sender, immutable snapshots, commitment and reserves.
{
  const f = fixture()
  assert.throws(() => f.act('representatives', { faction: 'PanOceania', commander: person('Yu Jing').userId }), /distinct registered/)
  assert.throws(() => f.act('hidden-hand', { location: loc(0), beneficiary: 'PanOceania', outcome: 'PRESERVE', ...f.dm('Yu Jing') }), /recorded Commander/)
  defaults(f)
  f.act('offer', { faction: 'Tohaa', location: loc(0), bid: 3, ...f.dm('Tohaa') })
  assert.throws(() => f.act('hidden-hand', { location: loc(0), beneficiary: 'PanOceania', outcome: 'PRESERVE', ...f.dm('Tohaa') }), /committed/)
  const offer = f.turn.offers[0]
  f.act('accept', { id: offer.id, ...f.dm('NA2') }); assert.equal(f.ledger.operations.credits.Tohaa, 3)
  assert.throws(() => f.act('withdraw-offer', { id: offer.id }), /accepted/)
  assert.throws(() => f.act('service', { kind: 'preparation', ...f.dm('NA2') }), /affordable/)
  f.act('begin'); assert.throws(() => f.act('infiltration', { location: loc(2), ...f.dm('Combined Army') }), /locked/)
  assert.doesNotThrow(() => guardCampaignGame(f.ledger, 1, 'submit'))
  f.act('close'); assert.throws(() => guardCampaignGame(f.ledger, 1, 'submit'), /not open/)
  f.act('reopen'); assert.equal(f.turn.phase, 'open')
}
// Conquest support, failed contract return, insurance and narrative separation.
{
  const f = fixture(); defaults(f)
  f.act('offer', { faction: 'PanOceania', location: loc(0), bid: 2, ...f.dm('PanOceania') }); f.act('accept', { id: f.turn.offers[0].id, ...f.dm('NA2') }); f.act('begin')
  add(f.ledger, 1, loc(0), 'PanOceania', 4, 9); add(f.ledger, 1, loc(0), 'Yu Jing', 6, 10); add(f.ledger, 1, loc(0), 'Tohaa', 5, 8); add(f.ledger, 1, loc(0), 'NA2', 6, 8)
  add(f.ledger, 1, 'narrative', 'NA2', 100, 100); add(f.ledger, 1, 'narrative', 'Tohaa', 3, 8)
  let p = resolutionPreview(f.ledger, 1), row = p.control[0].rows.find(r => r.faction === 'PanOceania')
  assert.equal(row.influence, 8); assert.equal(row.op, 9); assert.equal(p.hiddenHand.success, true); assert.equal(p.contract.success, true); assert.equal(p.contract.earnedTP, 6)
  assert.equal(p.narrativeWinner, 'NA2'); assert.equal(p.doctrines.find(d => d.faction === 'PanOceania').canAward, true)
  f.act('close'); const stale = p.previewHash; add(f.ledger, 1, loc(3), 'Nomads', 3, 4)
  assert.throws(() => f.act('resolve', { previewHash: stale }), /preview changed/)
  p = resolutionPreview(f.ledger, 1); f.act('resolve', { previewHash: p.previewHash, doctrines: ['PanOceania'] })
  const ops = operationsView(f.ledger); assert.equal(ops.vp.Tohaa, 2); assert.equal(ops.vp.PanOceania, 1); assert.equal(ops.vp.NA2, 3); assert.equal(ops.credits.NA2, 2); assert.equal(ops.credits.PanOceania, 4)
  assert.throws(() => f.act('resolve', { previewHash: p.previewHash }), /locked/)
  f.act('adjustment', {faction:'PanOceania',vp:-1}); assert.equal(f.turn.resolution.publicPatch.standings.find(s=>s.faction==='PanOceania').vp,0)
  assert.throws(() => guardCampaignGame(f.ledger, 1, 'act'), /resolved/)
  const patch = f.turn.resolution.publicPatch
  assert.deepEqual(Object.keys(patch).sort(), ['standings', 'territories']); assert(!JSON.stringify(patch).includes('PRIVATE_SENTINEL'))
}
// CA compares TP then own OP, excludes hired NA2 only, never changes Conquest control.
{
  const f = fixture(); defaults(f)
  f.act('offer', { faction: 'Combined Army', location: loc(1), bid: 1, ...f.dm('Combined Army') }); f.act('accept', { id: f.turn.offers[0].id, ...f.dm('NA2') }); f.act('begin')
  add(f.ledger, 1, loc(1), 'Combined Army', 8, 7); add(f.ledger, 1, loc(1), 'NA2', 6, 100); add(f.ledger, 1, loc(1), 'Yu Jing', 11, 7)
  let p = resolutionPreview(f.ledger, 1); assert.equal(p.infiltration.comparisonTP, 11); assert.equal(p.infiltration.success, false)
  f.ledger.games[2].opA = 6; p = resolutionPreview(f.ledger, 1); assert.equal(p.infiltration.success, true); assert.equal(p.territories[1].controller, 'Yu Jing'); assert.equal(p.territories[1].infiltrated, true)
  assert.equal(p.contract.success, true)
}
// Losing Conquest contract returns reserve; insurance requires >=5 earned TP and failed outcome.
{
  const f = fixture(); defaults(f); f.turn.startCredits.NA2 = f.ledger.operations.credits.NA2 = 2
  f.act('offer', { faction: 'PanOceania', location: loc(0), bid: 3, ...f.dm('PanOceania') }); f.act('accept', { id: f.turn.offers[0].id, ...f.dm('NA2') }); f.act('service', { kind: 'insurance', ...f.dm('NA2') }); f.act('begin')
  add(f.ledger, 1, loc(0), 'NA2', 5, 8); add(f.ledger, 1, loc(0), 'Yu Jing', 20, 30)
  f.act('close'); const p = resolutionPreview(f.ledger, 1); assert.equal(p.contract.insured, true)
  f.act('resolve', { previewHash: p.previewHash }); assert.equal(f.ledger.operations.credits.PanOceania, 6); assert.equal(operationsView(f.ledger).vp.NA2, 1)
}
// Logistics only changes Narrative TP; Dossier never discloses beneficiary or outcome.
{
  const f = fixture(); defaults(f); f.turn.startCredits.NA2 = f.ledger.operations.credits.NA2 = 2
  f.act('service', { kind: 'logistics', ...f.dm('NA2') }); assert.throws(() => f.act('service', { kind: 'dossier', location: loc(0), ...f.dm('NA2') }), /one NA2/)
  f.act('begin'); const p = resolutionPreview(f.ledger, 1); assert.equal(p.narrative.find(r => r.faction === 'NA2').tp, 2); assert.equal(p.control[0].rows.find(r => r.faction === 'PanOceania').influence, 0)
  const d = fixture(); defaults(d); d.turn.startCredits.NA2 = d.ledger.operations.credits.NA2 = 1
  d.act('service', { kind: 'dossier', location: loc(0), ...d.dm('NA2') }); d.act('begin'); assert.deepEqual(d.turn.dossier, { location: loc(0), tohaa: true, ca: false })
}
// Doctrine campaign cap; objectives cannot be awarded early, duplicated, over cap or against an unapproved claim.
{
  const first = fixture(); assert.throws(() => first.act('assign-objective', { faction: 'PanOceania', title: 'Objective', requirement: 'Requirement' }), /Turn 2/)
  const f = fixture(2); defaults(f); f.act('begin'); f.act('close')
  for (let i = 0; i < 3; i++) {
    f.act('assign-objective', { faction: 'PanOceania', title: `Private objective ${i}`, requirement: 'Verified requirement' })
    const id = f.ledger.operations.objectives.at(-1).id
    f.act('objective', { id, approve: true, evidence: 'Verified Discord DM' })
    assert.throws(() => f.act('objective', { id, approve: true, evidence: 'Repeat' }), /active assigned/)
  }
  assert.equal(operationsView(f.ledger).vp.PanOceania, 6)
  f.act('assign-objective', { faction: 'PanOceania', title: 'Fourth', requirement: 'Requirement' })
  assert.throws(() => f.act('objective', { id: f.ledger.operations.objectives.at(-1).id, approve: true, evidence: 'Evidence' }), /six-VP/)
  f.ledger.operations.awards.push(...[1, 2, 3].map(i => ({ faction: 'Ariadna', vp: 1, category: 'doctrine', turn: i, source: 'test' + i })))
  assert.equal(resolutionPreview(f.ledger, 2).doctrines.find(d => d.faction === 'Ariadna').canAward, false)
}
// Complete ties preserve controller; pending games block commit; final territory VP only in Turn 6.
{
  const f = fixture(6); defaults(f); f.act('begin'); add(f.ledger, 6, loc(0), 'PanOceania', 5, 8); add(f.ledger, 6, loc(0), 'Yu Jing', 5, 8)
  add(f.ledger, 6, loc(1), 'Yu Jing', 4, 6, 'awaiting_confirmation'); f.act('close')
  let p = resolutionPreview(f.ledger, 6); assert.equal(p.control[0].after, 'PanOceania'); assert.throws(() => f.act('resolve', { previewHash: p.previewHash }), /pending/)
  f.ledger.games.at(-1).status = 'rejected'; p = resolutionPreview(f.ledger, 6); assert.equal(p.awards.filter(a => a.category === 'territory').reduce((s, a) => s + a.vp, 0), 22)
}
// Real durable store serializes concurrent writes, survives restart and excludes all operations from participant/public projections.
const dir = await mkdtemp(join(tmpdir(), 'aurora-ops-'))
try {
  const path = join(dir, 'ledger.json'), store = createCampaignGameStore(path, { now: () => at }), s = state()
  await store.operate({ revision: 0, action: 'prepare', turn: 1, reason: 'Starting campaign' }, players, s)
  const inputs = ['PanOceania', 'Yu Jing'].map(f => store.operate({ revision: 1, action: 'representatives', turn: 1, faction: f, commander: person(f).userId, reason: 'Private DM' }, players, s))
  const results = await Promise.allSettled(inputs); assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const restarted = createCampaignGameStore(path); assert.equal((await restarted.operations()).revision, 2)
  assert(!('operations' in await restarted.view(person('PanOceania').userId, false, s)))
  assert(!JSON.stringify(await restarted.activity(1)).includes('commanders'))
  const service = createCampaignGameService({ store, registrations: { player: async id => players.find(p => p.userId === id), players: async () => players }, identity: () => ({ id: person('PanOceania').userId }), notify: async () => {}, fetchObject: async url => url.includes('verify-admin') ? { ok: true, json: async () => ({ authorized: false }) } : { ok: true, json: async () => ({ state: s }) } })
  for (const action of ['operations', 'operate']) { let code; const req = Readable.from([]); Object.assign(req, { url: '/aurora-vii/games?action=' + action, method: action === 'operate' ? 'POST' : 'GET', headers: {} }); await service.handler(req, { setHeader() {}, writeHead(c) { code = c }, end() {} }); assert.equal(code, 403) }
  const raw = JSON.parse(await readFile(path)); assert.equal(raw.version, 1); assert.equal(raw.operations.version, 1); assert(validOperations(raw.operations)); raw.operations.credits.NA2=-1; assert.equal(validOperations(raw.operations),false)
} finally { await rm(dir, { recursive: true, force: true }) }
console.log('PASS: private representatives/DM receipts, commitment and reserves, support order, CA ties, contract settlement, services, Narrative isolation, Doctrine/objective limits, stale previews, locked records, durable concurrency and privacy boundaries.')
