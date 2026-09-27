import assert from 'node:assert/strict'
import sharp from 'sharp'
import { verifyCommissionerSession } from '../api/featured-report.mjs'
import { isValidReportId, readFeaturedReportPin, writeFeaturedReportPin } from '../api/_lib/featured-report-store.mjs'
import { createReportPreview } from '../api/report-preview.mjs'

assert.equal(isValidReportId(117), true)
assert.equal(isValidReportId('117'), false)
assert.equal(isValidReportId(-1), false)
assert.equal(await readFeaturedReportPin({ getObject: async () => null }), null)
assert.equal(await readFeaturedReportPin({ getObject: async () => ({ stream: new Response(JSON.stringify({ version: 1, pinnedId: 109 })).body }) }), 109)
await assert.rejects(readFeaturedReportPin({ getObject: async () => ({ stream: new Response(JSON.stringify({ version: 1, pinnedId: '109' })).body }) }))
let stored
await writeFeaturedReportPin(109, { putObject: async (path, body, options) => { stored = { path, body: JSON.parse(body), options } } })
assert.equal(stored.path, 'portal-config/featured-report.json')
assert.deepEqual(stored.body, { version: 1, pinnedId: 109 })
assert.equal(stored.options.allowOverwrite, true)
await writeFeaturedReportPin(null, { putObject: async (_, body) => { stored = JSON.parse(body) } })
assert.equal(stored.pinnedId, null)

assert.equal(await verifyCommissionerSession(''), false)
const originalApiUrl = process.env.VITE_API_URL
process.env.VITE_API_URL = 'https://script.google.com/macros/s/deployment/exec'
const sessionToken = `${'a'.repeat(43)}=`
let called = false
const verify = async (_url, options) => {
  called = true
  assert.equal(options.body.get('action'), 'session')
  assert.equal(options.body.get('sessionToken'), sessionToken)
  return { ok: true, json: async () => ({ success: true, authenticated: true, user: { role: 'Commissioner' }, permissions: { manageSettings: true } }) }
}
assert.equal(await verifyCommissionerSession(`Bearer ${sessionToken}`, verify), true)
assert.equal(called, true)
assert.equal(await verifyCommissionerSession(`Bearer ${sessionToken}`, async () => ({ ok: true, json: async () => ({ success: true, authenticated: true, user: { role: 'Guest' }, permissions: { manageSettings: true } }) })), false)
if (originalApiUrl === undefined) delete process.env.VITE_API_URL
else process.env.VITE_API_URL = originalApiUrl

const image = await createReportPreview({ id: 117, mission: 'The Dig', player1Faction: 'Operations Subsection', player2Faction: 'Ramah Taskforce', tp: '5–1' })
assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
const { width, height } = await sharp(image).metadata()
assert.deepEqual({ width, height }, { width: 1200, height: 630 })
console.log('Featured report control validates permissions and pins; report previews render as PNG.')
