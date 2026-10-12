import assert from 'node:assert/strict'
import { BlobPreconditionFailedError } from '@vercel/blob'
import { readFile, readdir } from 'node:fs/promises'
import { AURORA_TERRITORIES, AURORA_TURNS, AURORA_FACTIONS } from '../shared/aurora-public.mjs'
import { emptyAuroraState, validateAuroraPublicState } from '../shared/aurora-public-state.mjs'
import handler, { saveAuroraPublication } from '../api/aurora-campaign.mjs'

assert.equal(AURORA_TERRITORIES.length, 12)
assert.equal(new Set(AURORA_TERRITORIES.map(item => item.id)).size, 12)
assert.equal(AURORA_TERRITORIES.reduce((sum, item) => sum + item.vp, 0), 22)
assert.equal(AURORA_TURNS.length, 6)
assert.ok(AURORA_TURNS.every(item => item.missions.length === 2))
assert.equal(AURORA_FACTIONS.length, 11)
assert.equal(AURORA_TERRITORIES.flatMap(item => item.layouts).length, 24)
assert.equal((await readdir('public/assets/aurora-vii/v1')).length, 25)
assert.deepEqual(validateAuroraPublicState(emptyAuroraState()), emptyAuroraState())
const active = emptyAuroraState()
active.turn = 1
active.deadline = '2026-11-15T23:59:00-05:00'
active.territories.slice(0, 4).forEach(item => { item.vulnerable = true })
active.story = [{ turn: 1, title: 'Published chapter', body: 'Approved current player-facing story.' }]
active.totals = [{ location: 'narrative', faction: 'Tohaa', tp: 5, op: 8 }]
assert.equal(validateAuroraPublicState(active).totals[0].location, 'narrative')
for (const field of ['secretObjectives', 'na2Contract', 'tohaaChoice', 'caTarget', 'futureEvents', 'privateBriefings']) {
  assert.throws(() => validateAuroraPublicState({ ...active, [field]: 'PRIVATE TEST DATA' }), /unsupported fields/)
}
assert.throws(() => validateAuroraPublicState({ ...active, story: [{ turn: 2, title: 'Future', body: 'Not released.' }] }), /published chapter Turn/)
assert.throws(() => validateAuroraPublicState({ ...active, territories: active.territories.map((item, index) => index === 0 ? { ...item, secretTarget: true } : item) }), /unsupported fields/)
assert.throws(() => validateAuroraPublicState({ ...active, territories: active.territories.map(item => ({ ...item, vulnerable: false })) }), /four Vulnerable/)
assert.throws(() => validateAuroraPublicState({ ...active, totals: [{ location: active.territories[5].id, faction: 'Tohaa', tp: 2, op: 3 }] }), /current Vulnerable/)
assert.throws(() => validateAuroraPublicState({ ...active, reportUrl: 'javascript:alert(1)' }), /HTTPS/)
assert.throws(() => validateAuroraPublicState({ ...active, deadline: '2026-11-15T23:59:00' }), /timezone/)
assert.throws(() => validateAuroraPublicState({ ...active, territories: active.territories.map((item, index) => index === 0 ? { ...item, controller: 'Tohaa' } : item) }), /Conquest/)

let saved = null, writes = 0
const getObject = async () => saved ? { stream: new Response(JSON.stringify(saved)).body, blob: { etag: 'current-etag' } } : null
const putObject = async (path, data) => { assert.equal(path, 'portal-config/aurora-vii-public.json'); saved = JSON.parse(data); writes++; return {} }
const publication = await saveAuroraPublication({ expectedRevision: '', state: active }, { getObject, putObject })
assert.equal(writes, 1)
assert.equal(publication.state.turn, 1)
assert.ok(!JSON.stringify(publication).includes('PRIVATE TEST DATA'))
assert.deepEqual(publication.state.territories.map(item => item.controller), Array(12).fill(''), 'Displaying totals does not resolve territorial control')
await assert.rejects(saveAuroraPublication({ expectedRevision: '', state: active }, { getObject, putObject }), /changed/)
await assert.rejects(saveAuroraPublication({ expectedRevision: publication.revision, state: { ...active, privateBriefings: [] } }, { getObject, putObject }), /unsupported/)
assert.equal(writes, 1, 'Rejected or stale publications must never write')
await assert.rejects(saveAuroraPublication({ expectedRevision: publication.revision, state: active }, { getObject, putObject: async (_path, _data, options) => { assert.equal(options.ifMatch, 'current-etag'); throw new BlobPreconditionFailedError() } }), error => error.code === 'REVISION_CONFLICT')
await assert.rejects(saveAuroraPublication({ expectedRevision: publication.revision, state: { ...active, eventId: 'event-current-league' } }, { getObject, putObject, readEvents: async () => [{ id: 'event-current-league', type: 'League' }] }), /Narrative Campaign/)
let status
const response = { setHeader() {}, status(code) { status = code; return this }, json(value) { return value } }
await handler({ method: 'POST', headers: {}, body: { state: active } }, response)
assert.equal(status, 403, 'Anonymous users cannot publish campaign state')
const source = await readFile('src/campaign/AuroraCampaign.tsx', 'utf8')
assert.match(source, /game\.eventId === eventId/)
assert.match(source, /Narrative Mission TP and OP count only/)
console.log('PASS: 12 territories, 24 public terrain references, source scoring, publication whitelist, spoiler boundaries, authentication, stale revisions and event isolation.')
