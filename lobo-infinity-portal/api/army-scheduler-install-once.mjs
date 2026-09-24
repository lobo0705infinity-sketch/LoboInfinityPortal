import { createHash, timingSafeEqual } from 'node:crypto'

// Remove this one-time route after verifying the scheduler installation.
const TOKEN_HASH = 'db2bf322d2fd598ab126daefe1f3060fc9bc5e45c850f371cfa452f834fec14d'

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ success: false })
    return
  }

  const actual = createHash('sha256')
    .update(String(request.headers?.['x-scheduler-install-token'] || ''))
    .digest()
  if (!timingSafeEqual(actual, Buffer.from(TOKEN_HASH, 'hex'))) {
    response.status(404).json({ success: false })
    return
  }

  const apiUrl = String(process.env.VITE_API_URL || '').trim()
  const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  if (!apiUrl || !workerToken) {
    response.status(500).json({ success: false, error: 'Scheduler configuration is missing.' })
    return
  }

  try {
    const url = new URL(apiUrl)
    url.searchParams.set('action', 'installArmyIntelligenceScheduler')
    const body = new URLSearchParams({
      action: 'installArmyIntelligenceScheduler',
      workerToken,
    })
    const upstream = await fetch(url, { method: 'POST', body, redirect: 'follow' })
    const text = await upstream.text()
    response.status(upstream.status).send(text)
  } catch (error) {
    response.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
