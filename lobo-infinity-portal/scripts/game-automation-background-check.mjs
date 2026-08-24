import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
assert.match(automation, /function hasRecentAutomationEventId_[\s\S]*AUTOMATION_GAME_EVENT_LOOKBACK/)
assert.match(enqueueSource, /setValues\(queueRows\)/)

assert.match(automation, /const AUTOMATION_QUEUE_BATCH_LIMIT = 4/)
assert.match(automation, /const AUTOMATION_QUEUE_SELECTION_WINDOW = 100/)
assert.match(automation, /slice\(0, limit\)/)
assert.match(automation, /item\.rowNumber/)
assert.match(automation, /buildAutomationGamePayloadById_[\s\S]*getRange\(target \+ 1, 1, 1, sheet\.getLastColumn\(\)\)/)
assert.match(api, /case "processAutomationQueueBatch"[\s\S]*requireArmyIntelligenceWorkerOrPermission/)

assert.match(scheduler, /everyMinutes\(5\)/)
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
