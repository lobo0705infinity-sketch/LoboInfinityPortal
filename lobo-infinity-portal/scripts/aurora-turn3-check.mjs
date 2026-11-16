import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialAuroraState, validateAuroraPublicState } from '../shared/aurora-public-state.mjs'
import { AURORA_FACTIONS, AURORA_CONQUEST_FACTIONS } from '../shared/aurora-public.mjs'
import { campaignScore, campaignTotals } from '../shared/aurora-games.mjs'
import { emptyOperations, mutateOperations, resolveOperations, finalCampaignStandings } from '../bot/aurora-operations.mjs'
import { preparationPatch, advancePreparation, factionPreparationView, validatePreparedPublication } from '../bot/aurora-turn-preparation.mjs'
import { createCampaignGameStore } from '../bot/aurora-game-store.mjs'
import { ownerAdvantageStatus } from '../shared/aurora-campaign-policy.mjs'

let clock = new Date('2026-11-16T12:00:00Z'), serial = 0
const players = AURORA_FACTIONS.map((f, i) => ({ userId: String(i + 100), name: f, faction: f }))
const ids = ['nova-prospect', 'korin-range', 'crystal-frontier', 'echo-shores']
const game = (faction, location = ids[0], turn = 3, other = 'Combined Army', op = 10, opOther = 0) => ({ id: `audit-${++serial}`, turn, location, status: 'confirmed', createdAt: clock.toISOString(), playerA: { id: faction + serial, faction }, playerB: { id: other + serial, faction: other }, opA: op, opB: opOther, ...campaignScore(op, opOther) })
function fixture() {
  clock = new Date('2026-11-16T12:00:00Z')
  const publication = initialAuroraState(); publication.turn = 2; publication.deadline = '2026-11-30T23:00:00Z'; publication.territories.forEach((t, i) => { t.vulnerable = i < 4; t.controller = i < 4 ? 'PanOceania' : '' })
  const ledger = { version: 1, games: [], claims: [], turns: { 2: publication }, operations: emptyOperations() }
  const ops = ledger.operations
  ops.turns[2] = { start: structuredClone(publication), phase: 'resolved', offers: [], narrativeBonuses: [], resolution: { territories: structuredClone(publication.territories) } }
  for (const p of players) ops.commanders[p.faction] = { commander: p.userId, deputy: '' }
  const act = (action, values = {}, n = 3) => mutateOperations(ledger, { action, revision: ops.revision, turn: n, reason: 'Regression fixture', ...values }, players, publication, clock)
  return { ledger, ops, publication, act }
}
function prepare(f, required = []) {
  f.act('prepare-nomination', { required, excluded: [], rewardReason: 'Existing rewards recorded first' })
  const p = f.ops.preparations[3]
  if (p.status === 'nomination') f.act('nominate', { faction: p.offers.at(-1).faction, territory: ids.find(id => !required.includes(id)) })
  f.act('finalize-territories', { territories: ids, deadline: '2026-11-18T12:00:00Z' })
  Object.assign(f.publication, preparationPatch(f.ops, 3), { deadline: '2026-11-30T23:00:00Z' })
  validateAuroraPublicState(f.publication); validatePreparedPublication(f.ledger, f.publication)
  f.act('prepare'); f.act('waive-selection', { faction: 'Tohaa' }); f.act('waive-selection', { faction: 'Combined Army' })
  return f.ops.turns[3]
}
// Neutral opening, neutral INSTALL, neutral capture and ALEPH's own condition.
{
  const f = fixture(), start = initialAuroraState(); start.turn = 1; start.deadline = f.publication.deadline; start.territories.slice(0, 4).forEach(t => { t.vulnerable = true }); Object.assign(f.publication, start)
  delete f.ops.turns[2]; f.act('prepare', {}, 1)
  f.act('hidden-hand', { location: ids[0], beneficiary: 'ALEPH', outcome: 'INSTALL', sender: players.find(p => p.faction === 'Tohaa').userId }, 1)
  f.ledger.games.push(game('Tohaa', ids[0], 1))
  let r = resolveOperations(f.ledger, 1); assert.equal(r.hiddenHand.success, true); assert.equal(r.control[0].after, 'ALEPH'); assert.equal(r.doctrines.find(d => d.faction === 'ALEPH').eligible, true)
  f.ledger.games.push(game('PanOceania', ids[1], 1)); r = resolveOperations(f.ledger, 1); assert.equal(r.doctrines.find(d => d.faction === 'PanOceania').eligible, true)
  f.ops.turns[1].start.territories[0].controller = 'ALEPH'; f.ops.turns[1].tohaa.outcome = 'PRESERVE'
  assert.equal(resolveOperations(f.ledger, 1).doctrines.find(d => d.faction === 'ALEPH').eligible, true)
}
// Nomination uses earned VP + territory value, skips mandatory-filled turns, and draws persistently.
{
  const f = fixture(); f.ops.awards.push({ faction: 'Ariadna', vp: 4, category: 'narrative', source: 'prior' })
  f.ops.preparations = { 1: { turn: 1, territories: structuredClone(f.publication.territories), vulnerable: ids, selectionDeadline: '2026-11-01T00:00:00Z', standings: [], status: 'published-ready', nomination: { faction: 'Nomads', territory: ids[0] } } }
  f.act('prepare-nomination', { required: [ids[0]], excluded: [ids[2]] })
  const p = f.ops.preparations[3]; assert.equal(p.queue.at(-1).faction, 'PanOceania'); assert.equal(p.queue.find(r => r.faction === 'PanOceania').projectedVP, 11)
  assert.ok(p.queue.findIndex(r => r.faction === 'Nomads') > p.queue.findIndex(r => r.faction === 'Yu Jing'))
  assert.equal(p.offers.length, 1); const original = p.offers[0].faction
  assert.throws(() => f.act('nominate', { faction: original, territory: ids[0] }), /remaining slot/)
  assert.throws(() => f.act('nominate', { faction: original, territory: ids[2] }), /remaining slot/)
  clock = new Date(+clock + 24 * 3600000); assert.equal(advancePreparation(f.ops, clock), true)
  assert.equal(p.offers[0].status, 'expired'); assert.equal(p.offers[1].deadline, new Date(+clock + 24 * 3600000).toISOString())
  assert.throws(() => f.act('nominate', { faction: original, territory: ids[1] }), /open nomination/)
  const skipped = fixture(); skipped.act('prepare-nomination', { required: ids }); assert.equal(skipped.ops.preparations[3].skipped, true); assert.equal(skipped.ops.preparations[3].offers.length, 0)
  assert.throws(() => skipped.act('prepare-nomination', {}, 2), /3 to 6/)
}
// Owner selection: 0/1/2 automatic, 3/4 choose at most 2, VP + alphabetical defaults, immutable opening.
{
  const f = fixture(), turn = prepare(f)
  assert.equal(ownerAdvantageStatus(f.publication, ids[0]), 'pending')
  assert.throws(() => f.act('select-owner-advantages', { faction: 'PanOceania', territories: ids.slice(0, 3) }), /distinct/)
  assert.throws(() => f.act('select-owner-advantages', { faction: 'Ariadna', territories: [ids[0]] }), /owned/)
  assert.throws(() => f.act('lock-owner-advantages'), /Wait for/)
  clock = new Date('2026-11-18T12:00:00Z'); f.act('lock-owner-advantages')
  assert.deepEqual(turn.ownerAdvantages.active, ['crystal-frontier', 'korin-range'])
  assert.throws(() => f.act('begin'), /publish owner/)
  f.publication.ownerAdvantages = structuredClone(turn.ownerAdvantages); validatePreparedPublication(f.ledger, f.publication); f.act('begin')
  assert.equal(ownerAdvantageStatus(f.publication, ids[0]), 'inactive'); assert.equal(ownerAdvantageStatus(f.publication, ids[1]), 'active')
  const afterControlChanges = structuredClone(f.publication); afterControlChanges.territories.find(t => t.id === ids[1]).controller = ''; assert.equal(ownerAdvantageStatus(afterControlChanges, ids[1]), 'active')
  assert.throws(() => f.act('select-owner-advantages', { faction: 'PanOceania', territories: [] }), /locked/)
  assert.throws(() => validatePreparedPublication(f.ledger, { ...f.publication, ownerAdvantages: { status: 'locked', active: ids } }), /unchanged/)
  for (const count of [0, 1, 2, 3]) {
    const g = fixture(); g.ops.turns[2].resolution.territories.forEach((t, i) => { t.controller = i < count ? 'PanOceania' : '' }); const t = prepare(g)
    if (count > 2) g.act('select-owner-advantages', { faction: 'PanOceania', territories: [ids[0]] })
    g.act('lock-owner-advantages'); assert.equal(t.ownerAdvantages.active.length, count > 2 ? 1 : count)
  }
}
// Failed-objective choice, one remaining, completed exclusion, default, expiry and exact-Turn awards.
{
  const f = fixture(); f.ops.objectives.push({ id: 'failed', faction: 'Tohaa', title: 'Failed route', requirement: 'Old requirement', assignedTurn: 2, status: 'expired' }); const turn = prepare(f)
  const options = [{ title: 'Failed route', requirement: 'Reissued condition' }, { title: 'Different route', requirement: 'A different condition' }]
  assert.throws(() => f.act('assign-objective', { faction: 'Tohaa', ...options[0] }), /Offer the/)
  f.act('offer-objectives', { faction: 'Tohaa', options, defaultIndex: 1, eligibilityReview: 'Both achievable; different routes of comparable difficulty.' })
  assert.equal(f.ops.objectives.filter(o => o.assignedTurn === 3).length, 0)
  f.act('select-owner-advantages', { faction: 'PanOceania', territories: [] }); f.act('lock-owner-advantages'); f.publication.ownerAdvantages = turn.ownerAdvantages
  assert.throws(() => f.act('begin'), /Wait for objective/)
  const privateTohaa = factionPreparationView(f.ledger, players.find(p => p.faction === 'Tohaa')), privateAriadna = factionPreparationView(f.ledger, players.find(p => p.faction === 'Ariadna'))
  assert.equal(privateTohaa.turn.objectives.options.length, 2); assert.equal(privateAriadna.turn.objectives, null); assert.equal(JSON.stringify(privateAriadna).includes('Failed route'), false)
  clock = new Date('2026-11-18T12:00:00Z'); f.act('begin')
  const chosen = f.ops.objectives.find(o => o.assignedTurn === 3); assert.equal(chosen.title, 'Different route'); assert.equal(chosen.choiceSource, 'deadline-default')
  f.act('close'); assert.equal(chosen.status, 'review'); assert.throws(() => f.act('objective', { id: 'failed', approve: true, evidence: 'Old evidence' }), /active assigned/)
  const preview = resolveOperations(f.ledger, 3); const { createHash } = await import('node:crypto'); f.act('resolve', { previewHash: createHash('sha256').update(JSON.stringify(preview)).digest('hex'), doctrines: [] }); assert.equal(chosen.status, 'expired')
  const g = fixture(); g.ops.objectives.push({ id: 'failed', faction: 'NA2', title: 'Old', assignedTurn: 2, status: 'rejected' }, { id: 'done', faction: 'NA2', title: 'Done', assignedTurn: 1, status: 'completed' }); prepare(g)
  assert.throws(() => g.act('offer-objectives', { faction: 'NA2', options: [{ title: ' done ', requirement: 'x' }, options[1]], defaultIndex: 0, eligibilityReview: 'review' }), /not completed/)
  g.act('offer-objectives', { faction: 'NA2', options: [options[0]], onlyOneEligible: true, defaultIndex: 0, eligibilityReview: 'Only eligible objective remaining' }); assert.equal(g.ops.objectives.at(-1).status, 'assigned')
}
// Persistence, authenticated faction ownership, late rejection and fixed counted-totals tiebreak.
{
  const dir = await mkdtemp(join(tmpdir(), 'aurora-turn3-')); const path = join(dir, 'ledger.json')
  try {
    const f = fixture(); f.act('prepare-nomination'); await writeFile(path, JSON.stringify(f.ledger))
    const store = createCampaignGameStore(path, { now: () => clock }), nominated = f.ops.preparations[3].offers[0].faction, player = players.find(p => p.faction === nominated)
    const view = await store.decisions(player)
    await assert.rejects(store.choose({ action: 'nominate', turn: 3, revision: view.revision, territory: ids[0] }, { ...player, userId: 'not-representative' }, players, f.publication), /Commander/)
    await store.choose({ action: 'nominate', turn: 3, revision: view.revision, territory: ids[0], faction: 'forged' }, player, players, f.publication)
    const persisted = JSON.parse(await readFile(path, 'utf8')); assert.equal(persisted.operations.preparations[3].nomination.faction, nominated); assert.equal(persisted.operations.journal.at(-1).actor, player.userId)
    const s = initialAuroraState(); s.turn = 1; s.deadline = '2026-11-16T11:00:00Z'; s.territories.slice(0, 4).forEach(t => { t.vulnerable = true })
    const lateStore = createCampaignGameStore(join(dir, 'late.json'), { now: () => clock })
    await assert.rejects(lateStore.submit({ turn: 1, date: '2026-11-16', kind: 'territory', location: ids[0], mission: 'Claim the Frontier', opA: 8, opB: 6 }, players[0], players[1], s), /Late reports do not count/)
    const late = { ...game('Ariadna', ids[0], 1), late: true, lateApproved: true, strictDeadline: true }
    assert.equal(campaignTotals([late], 1, s.rulesRevision).length, 0)
    const l = { games: [game('Ariadna', ids[0], 1), game('Ariadna', ids[0], 1), game('Ariadna', ids[0], 1)], operations: emptyOperations() }; l.games.forEach(g => { g.playerA.id = 'one-player' }); l.operations.turns[1] = { start: s }; l.operations.turns[6] = { start: { ...s, turn: 6 } }
    const rows = finalCampaignStandings(l); assert.equal(rows.find(r => r.faction === 'Ariadna').tp, 10)
  } finally { await rm(dir, { recursive: true, force: true }) }
}
console.log('PASS: neutral INSTALL/captures, ALEPH, projected nomination ranking and priority, mandatory/excluded rewards, 24-hour rollover, owner selection/default/publication lock, failed-objective choice/default/reissue/expiry, private faction authorization and isolation, durable decisions, strict late rejection and final counted totals.')
