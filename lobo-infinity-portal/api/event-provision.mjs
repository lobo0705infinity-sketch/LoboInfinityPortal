import { timingSafeEqual } from 'node:crypto'

const OPERATIONS = new Set(['create', 'update', 'read', 'validate'])

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  const provisioningToken = String(process.env.EVENT_PROVISIONING_TOKEN || '').trim()
  const suppliedToken = readBearerToken(request)
  if (!provisioningToken || !safeEqual(suppliedToken, provisioningToken)) {
    response.status(401).json({ error: 'Event provisioning authorization is required.', success: false })
    return
  }

  const apiUrl = String(process.env.VITE_API_URL || '').trim()
  const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  if (!apiUrl || !workerToken) {
    response.status(500).json({ error: 'Event provisioning is not configured.', success: false })
    return
  }

  try {
    const body = readBody(request)
    const operation = String(body.operation || '').trim().toLowerCase()
    if (!OPERATIONS.has(operation)) {
      response.status(400).json({ error: 'Invalid provisioning operation.', success: false })
      return
    }

    const definition = normalizeDefinition(body.definition || {})
    const upstream = await callAppsScript(apiUrl, workerToken, operation, definition)
    if (!upstream.success) {
      response.status(upstream.code === 'PROVISIONING_UNAUTHORIZED' ? 401 : 400).json(upstream)
      return
    }

    if (operation === 'create' || operation === 'update') {
      const verification = await callAppsScript(apiUrl, workerToken, 'read', {
        eventId: upstream.eventId,
      })
      if (!verification.success || verification.eventId !== upstream.eventId) {
        response.status(502).json({
          error: 'Event provisioning read-back verification failed.',
          success: false,
        })
        return
      }
      response.status(200).json({ ...verification, operation, verified: true })
      return
    }

    response.status(200).json({ ...upstream, operation })
  } catch (error) {
    response.status(500).json({
      error: error instanceof SyntaxError ? 'Invalid provisioning response.' : 'Event provisioning failed.',
      success: false,
    })
  }
}

function normalizeDefinition(value) {
  const source = value && typeof value === 'object' ? value : {}
  const allowed = [
    'description', 'endDate', 'eventId', 'lifecycleStage', 'maximumPlayers',
    'name', 'registration', 'startDate', 'status', 'type',
  ]
  return Object.fromEntries(allowed.map((key) => [key, String(source[key] ?? '').trim()]))
}

async function callAppsScript(apiUrl, workerToken, operation, definition) {
  const params = new URLSearchParams({ action: 'provisionEvent', operation, workerToken })
  for (const [key, value] of Object.entries(definition)) {
    if (value !== '') params.set(key, value)
  }
  const upstream = await fetch(apiUrl, { body: params, method: 'POST', redirect: 'follow' })
  const text = await upstream.text()
  const payload = text ? JSON.parse(text) : {}
  if (!upstream.ok) return { error: `Event API returned HTTP ${upstream.status}.`, success: false }
  return payload
}

function readBody(request) {
  if (request.body && typeof request.body === 'object') return request.body
  return request.body ? JSON.parse(String(request.body)) : {}
}

function readBearerToken(request) {
  const authorization = String(request.headers?.authorization || '').trim()
  return authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

