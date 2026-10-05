import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import automationWorker from '../api/automation-queue-worker.mjs'

const canonical = readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
const automation = readFileSync('backend/AutomationApi.gs', 'utf8')
const scheduler = readFileSync('backend/ArmyIntelligenceScheduler.gs', 'utf8')
const api = readFileSync('backend/API.gs', 'utf8')
const worker = readFileSync('api/automation-queue-worker.mjs', 'utf8')

assert.equal((canonical.match(/canonicalSubmissionEnqueueGameAutomation_\(targetRow, \{/g) || []).length, 3)
assert.doesNotMatch(canonical, /canonicalSubmissionPublishGameAutomation_/)
assert.match(canonical, /appendRow\(row\)[\s\S]*canonicalSubmissionEnqueueGameAutomation_[\s\S]*coordinateCanonicalRebuild/)
assert.doesNotMatch(canonical, /getAllRecentGameObjects/)

const enqueueStart = automation.indexOf('function enqueueGameSubmittedAutomationEvent')
const enqueueEnd = automation.indexOf('function hasRecentAutomationEventId_', enqueueStart)
const enqueueSource = automation.slice(enqueueStart, enqueueEnd)
assert.doesNotMatch(enqueueSource, /UrlFetchApp|processAutomationQueueItem|sendDiscordAnnouncementPayload|getAllRecentGameObjects|rebuild/)
assert.match(enqueueSource, /gameSubmitted-game-" \+ gameId/)
assert.match(automation, /function hasRecentAutomationEventId_[\s\S]*const firstRow = 2/)
assert.match(enqueueSource, /setValues\(queueRows\)/)

const eventRows = []; const queueRows = []
let failQueueWrite = true
const sandbox = vm.createContext({})
vm.runInContext(automation, sandbox)
sandbox.getAutomationRules = () => ({ gameSubmitted: { enabled: true } })
sandbox.getRuleDestinations = () => ['discord', 'portal']
sandbox.getAutomationTimestamp = () => '2026-10-05T17:00:00Z'
sandbox.ensureAutomationEventsSheet = () => ({ getLastRow: () => eventRows.length + 1,
  appendRow: row => eventRows.push(row), getRange: () => ({ getValues: () => eventRows }) })
sandbox.ensureAutomationQueueSheet = () => ({ getLastRow: () => queueRows.length + 1,
  getRange: () => ({ getValues: () => queueRows,
    setValues: rows => { if (failQueueWrite) throw new Error('queue write failed'); queueRows.push(...rows) } }) })
assert.throws(() => sandbox.enqueueGameSubmittedAutomationEvent({ gameId: 122 }), /queue write failed/)
assert.equal(eventRows.length, 1)
assert.equal(queueRows.length, 0)
failQueueWrite = false
sandbox.enqueueGameSubmittedAutomationEvent({ gameId: 122 })
assert.equal(eventRows.length, 1, 'retry repairs fanout without duplicating the persisted event')
assert.equal(queueRows.length, 2)
sandbox.enqueueGameSubmittedAutomationEvent({ gameId: 122 })
assert.equal(queueRows.length, 2, 'identical retry does not duplicate destination jobs')
let unsupportedUpdate
sandbox.updateAutomationQueueItem = (...args) => { unsupportedUpdate = args }
const unsupported = sandbox.processAutomationQueueItem({ queueId: 'email-1', destination: 'email', attempts: 0 }, false)
assert.equal(unsupported.success, false)
assert.equal(unsupported.status, 'Unsupported')
assert.equal(unsupportedUpdate[1], 'Unsupported', 'unimplemented destinations must never claim delivery')

const legacyRows = [
  ['game-122', 'event-122', 'gameSubmitted', 'discord', 'Retry', '', 3, '', 'Unexpected token \'A\', "A server e"... is not valid JSON', '{}'],
  ['game-123', 'event-123', 'gameSubmitted', 'discord', 'Retry', '', 3, '', 'Unexpected token \'A\', "A server e"... is not valid JSON', '{}'],
  ['delivered', 'event-old', 'gameSubmitted', 'discord', 'Sent', '', 3, '', 'Unexpected token \'A\', "A server e"... is not valid JSON', '{}'],
  ['webhook', 'event-webhook', 'gameSubmitted', 'discord', 'Retry', '', 3, '', 'Webhook returned HTTP 429', '{}'],
]
sandbox.getDiscordConfig = () => ({ retryLimit: 3 })
sandbox.ensureAutomationQueueSheet = () => ({ getLastRow: () => legacyRows.length + 1,
  getRange: () => ({ getValues: () => legacyRows }) })
sandbox.updateAutomationQueueItem = (id, status, attempts, reason, rowNumber) => {
  const row = legacyRows[rowNumber - 2]
  assert.equal(row[0], id)
  row[4] = status; row[6] = attempts; row[8] = reason
}
assert.deepEqual(Array.from(sandbox.recoverLegacyStoryRuntimeFailures_()), ['game-122', 'game-123'])
assert.deepEqual(Array.from(sandbox.recoverLegacyStoryRuntimeFailures_()), [], 'identified runtime failures are requeued once')
assert.equal(legacyRows[2][4], 'Sent', 'delivered jobs remain untouched')
assert.equal(legacyRows[3][6], 3, 'exhausted webhook failures are not reset')
assert.deepEqual(Array.from(sandbox.selectPendingAutomationQueueItems_(4), item => item.queueId), ['game-122', 'game-123'])

assert.match(automation, /const AUTOMATION_QUEUE_BATCH_LIMIT = 4/)
assert.match(automation, /const firstRow = 2;/)
assert.match(automation, /slice\(0, limit\)/)
assert.match(automation, /item\.rowNumber/)
assert.match(automation, /buildAutomationGamePayloadById_[\s\S]*getRange\(target \+ 1, 1, 1, sheet\.getLastColumn\(\)\)/)
assert.match(api, /case "processAutomationQueueBatch"[\s\S]*requireArmyIntelligenceWorkerOrPermission/)

assert.match(scheduler, /everyMinutes\(30\)/)
assert.equal((scheduler.match(/newTrigger\(/g) || []).length, 1)
assert.match(scheduler, /ARMY_INTELLIGENCE_SCHEDULER_URL/)
assert.match(scheduler, /AUTOMATION_QUEUE_WORKER_URL/)
assert.match(worker, /DEFAULT_BATCH_LIMIT = 4/)
assert.match(worker, /ARMY_INTELLIGENCE_WORKER_TOKEN/)
assert.match(worker, /action', 'processAutomationQueueBatch'/)

const originalFetch = globalThis.fetch
const originalWorkerToken = process.env.ARMY_INTELLIGENCE_WORKER_TOKEN
const originalApiUrl = process.env.VITE_API_URL
const requests = []
process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = 'focused-worker-token'
process.env.VITE_API_URL = 'https://example.invalid/api'
globalThis.fetch = async (url, options) => {
  if (String(url).endsWith('/current.json')) return new Response(JSON.stringify({
    snapshotId: '20261005T160801Z', sourceCutoff: new Date().toISOString(),
    publishedAt: new Date().toISOString(), basePath: 'public-snapshots/20261005T160801Z/',
  }), { status: 200 })
  if (String(url).endsWith('/refresh-status.json')) return new Response('', { status: 404 })
  requests.push({ body: String(options.body), method: options.method, url: String(url) })
  return new Response(JSON.stringify({ attempted: 0, success: true }), { status: 200 })
}

const workerResponse = () => ({
  body: null,
  headers: {},
  setHeader(name, value) { this.headers[name] = value },
  status(code) { this.statusCode = code; return this },
  json(value) { this.body = value; return this },
})

const authorizedResponse = workerResponse()
await automationWorker({
  headers: { authorization: 'Bearer focused-worker-token' },
  method: 'POST',
}, authorizedResponse)
assert.equal(authorizedResponse.statusCode, 200)
assert.equal(requests.length, 1)
assert.match(requests[0].body, /action=processAutomationQueueBatch/)
assert.match(requests[0].body, /batchLimit=4/)

const rejectedResponse = workerResponse()
await automationWorker({ headers: {}, method: 'POST' }, rejectedResponse)
assert.equal(rejectedResponse.statusCode, 401)
assert.equal(requests.length, 1, 'Unauthorized worker calls must not reach Apps Script')

globalThis.fetch = originalFetch
if (originalWorkerToken === undefined) delete process.env.ARMY_INTELLIGENCE_WORKER_TOKEN
else process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = originalWorkerToken
if (originalApiUrl === undefined) delete process.env.VITE_API_URL
else process.env.VITE_API_URL = originalApiUrl

console.log('Background game automation boundary checks passed.')
