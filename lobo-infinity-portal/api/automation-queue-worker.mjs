import { timingSafeEqual } from 'node:crypto'

const DEFAULT_BATCH_LIMIT = 4

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  const authorization = String(request.headers?.authorization || '').trim()
  const suppliedToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''

  if (!workerToken || !safeEqual(suppliedToken, workerToken)) {
    response.status(401).json({ error: 'Background worker authentication is required.', success: false })
    return
  }

  try {
    const apiUrl = String(process.env.VITE_API_URL || '').trim()
    if (!apiUrl) {
      response.status(500).json({ error: 'Missing API URL.', success: false })
      return
    }

    const body = new URLSearchParams()
    body.set('action', 'processAutomationQueueBatch')
    body.set('batchLimit', String(DEFAULT_BATCH_LIMIT))
    body.set('workerToken', workerToken)

    const upstream = await fetch(apiUrl, {
      body,
      method: 'POST',
      redirect: 'follow',
    })
    const text = await upstream.text()
    const payload = text ? JSON.parse(text) : {}

    if (!upstream.ok || payload.success === false) {
      response.status(502).json({
        error: payload.error || `Automation queue API returned HTTP ${upstream.status}.`,
        success: false,
      })
      return
    }

    response.status(200).json(payload)
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      success: false,
    })
  }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

