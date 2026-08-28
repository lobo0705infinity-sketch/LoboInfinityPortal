import { readFile } from 'node:fs/promises'

const args = parseArgs(process.argv.slice(2))
const token = String(process.env.EVENT_PROVISIONING_TOKEN || '').trim()
if (!token) fail('Dedicated event provisioning authorization is required.')

const endpoint = String(
  process.env.EVENT_PROVISIONING_URL ||
  'https://lobo-infinity-portal.vercel.app/api/event-provision',
).trim()
const operation = String(args.operation || args.mode || '').trim().toLowerCase()
if (!['create', 'update', 'read', 'validate'].includes(operation)) {
  fail('Use --operation create, update, read, or validate.')
}

let definition = {}
if (args.file) {
  definition = JSON.parse(await readFile(args.file, 'utf8'))
} else if (args.definition) {
  definition = JSON.parse(args.definition)
}

const response = await fetch(endpoint, {
  body: JSON.stringify({ definition, operation }),
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  method: 'POST',
})
const payload = await response.json().catch(() => ({ success: false }))
if (!response.ok || payload.success === false) {
  fail(String(payload.error || `Event provisioning returned HTTP ${response.status}.`))
}

if ((operation === 'create' || operation === 'update') && payload.verified !== true) {
  fail('Event provisioning was not verified.')
}

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const key = String(values[index] || '').replace(/^--/, '')
    if (!key) continue
    result[key] = values[index + 1]
    index += 1
  }
  return result
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

