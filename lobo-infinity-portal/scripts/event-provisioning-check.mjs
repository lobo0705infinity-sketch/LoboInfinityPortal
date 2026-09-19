import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import handler from '../api/event-provision.mjs'

const root = new URL('../', import.meta.url)
const [apiSource, cliSource, managerSource, backendSource, engineSource, homeSource, analyticsSource] = await Promise.all([
  readFile(new URL('api/event-provision.mjs', root), 'utf8'),
  readFile(new URL('scripts/provision-event.mjs', root), 'utf8'),
  readFile(new URL('src/components/EventManagerPanel.tsx', root), 'utf8'),
  readFile(new URL('backend/EventManagerApi.gs', root), 'utf8'),
  readFile(new URL('backend/EventEngineApi.gs', root), 'utf8'),
  readFile(new URL('backend/EventHomeApi.gs', root), 'utf8'),
  readFile(new URL('backend/EventAnalyticsApi.gs', root), 'utf8'),
])

let checks = 0
function check(condition, message) { assert.ok(condition, message); checks += 1 }

const savedEnv = { ...process.env }
process.env.EVENT_PROVISIONING_TOKEN = 'dedicated-test-token'
process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = 'internal-worker-token'
process.env.VITE_API_URL = 'https://example.invalid/exec'

const unauthorized = await invoke({ operation: 'read', definition: {} }, '')
check(unauthorized.statusCode === 401, 'Anonymous provisioning must be rejected.')

let calls = []
global.fetch = async (_url, options) => {
  calls.push(String(options.body))
  const operation = new URLSearchParams(String(options.body)).get('operation')
  const payload = operation === 'read'
    ? { success: true, eventId: 'event-lobo-s-american-top-40', event: { id: 'event-lobo-s-american-top-40' }, maximumPlayers: 40, participantCount: 0 }
    : { success: true, eventId: 'event-lobo-s-american-top-40' }
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) }
}
const created = await invoke({ operation: 'create', definition: {
  name: "Lobo's American Top 40", type: 'Individual Double Elimination',
  maximumPlayers: 40, registration: 'Registration Closed',
  lifecycleStage: 'Planning', status: 'Planning',
} }, 'dedicated-test-token')
check(created.statusCode === 200 && created.body.verified === true, 'Create must require successful read-back verification.')
check(calls.length === 2, 'Create must make one mutation and one read-back request.')
check(calls.every((body) => new URLSearchParams(body).get('action') === 'provisionEvent'), 'Only provisionEvent may be invoked.')
check(new URLSearchParams(calls[0]).get('operation') === 'create', 'Create intent must remain explicit.')
check(new URLSearchParams(calls[1]).get('operation') === 'read', 'Post-create verification must be read-only.')

global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ success: false, error: 'Event already exists.' }) })
const duplicate = await invoke({ operation: 'create', definition: { name: 'Existing' } }, 'dedicated-test-token')
check(duplicate.statusCode === 400 && duplicate.body.error === 'Event already exists.', 'Duplicate Create must fail safely.')

check(apiSource.includes('EVENT_PROVISIONING_TOKEN'), 'The edge must require dedicated provisioning authorization.')
check(!apiSource.includes('sessionToken') && !apiSource.toLowerCase().includes('password'), 'Provisioning must not use Commissioner credentials.')
check(!cliSource.includes('LOBO_SESSION_TOKEN') && !cliSource.toLowerCase().includes('password'), 'The CLI must not use Commissioner credentials.')
check(cliSource.includes('process.env.EVENT_PROVISIONING_TOKEN'), 'The CLI secret must come only from the environment.')
check(!cliSource.includes('Spreadsheet') && !apiSource.includes('Spreadsheet'), 'Operational tooling must not write sheets directly.')
check(backendSource.includes('function saveCanonicalEventDefinition('), 'One internal event service must own persistence.')
check(/saveEventManagerEvent[\s\S]*saveCanonicalEventDefinition/.test(backendSource), 'Commissioner saves must reuse the canonical service.')
check(/provisionEvent[\s\S]*saveCanonicalEventDefinition/.test(backendSource), 'Provisioning must reuse the canonical service.')
check(backendSource.includes('mode === "create" && existing') && backendSource.includes('mode === "update" && !existing'), 'Create/update idempotency must be explicit.')
check(backendSource.indexOf('validateEventProvisioningDefinition') < backendSource.indexOf('saveCanonicalEventDefinition(validation.definition'), 'Validation must precede persistence.')
check(backendSource.includes('ensureEventManagerEventDefaults') && backendSource.includes('recordEventManagerAudit') && backendSource.includes('invalidateEventManagerCaches'), 'Canonical defaults, audit, and cache invalidation must remain.')
check(backendSource.includes('return "event-" + base'), 'Canonical IDs must use the existing slug rule.')
check(!managerSource.includes('Create New Event') && !managerSource.includes('startCreateEvent'), 'Commissioner must not expose canonical creation.')
check(managerSource.includes('Save Event') && managerSource.includes('ParticipantsPanel'), 'Existing event operations must remain.')
check(engineSource.includes('requestedEventId ? null : getCurrentLeagueEventSnapshot()'), 'Explicit missing event reads must not fall back.')
check(homeSource.includes('requestedEventId ? null : getCurrentLeagueEventSnapshot()'), 'Explicit missing Event Home reads must not fall back.')
check(analyticsSource.includes('!requestedEventId && typeof getCurrentLeagueEventSnapshot'), 'Explicit missing analytics reads must not fall back.')
check(homeSource.includes('error: "Event not found."') && analyticsSource.includes('throw new Error("Event not found.")'), 'Missing explicit IDs must be observable.')

process.env = savedEnv
process.stdout.write(`Event provisioning regression passed (${checks} checks).\n`)

async function invoke(body, token) {
  const response = { body: null, headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value },
    status(value) { this.statusCode = value; return this },
    json(value) { this.body = value; return this },
  }
  await handler({ body, headers: { authorization: token ? `Bearer ${token}` : '' }, method: 'POST' }, response)
  return response
}
