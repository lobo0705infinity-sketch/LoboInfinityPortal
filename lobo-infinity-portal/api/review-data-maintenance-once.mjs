import { createHash, timingSafeEqual } from 'node:crypto'

// This endpoint is temporary and must be removed after the review backfill.
const TOKEN_HASH = 'fe52708efe4c230fb96fa4771d72eadb6e09e4552ed6ebec4a5820e155422d94'
const WORKER_URL = 'https://lobo-infinity-portal.vercel.app/api/army-intelligence-refresh-worker'

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ success: false })
    return
  }

  const actual = createHash('sha256')
    .update(String(request.headers?.['x-maintenance-token'] || ''))
    .digest()
  const expected = Buffer.from(TOKEN_HASH, 'hex')
  if (!timingSafeEqual(actual, expected)) {
    response.status(404).json({ success: false })
    return
  }

  const action = String(request.headers?.['x-maintenance-action'] || '')
  if (action !== 'refresh' && action !== 'publish' && action !== 'probe') {
    response.status(400).json({ success: false, error: 'Unsupported action.' })
    return
  }

  const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  if (!workerToken) {
    response.status(500).json({ success: false, error: 'Worker credential is not configured.' })
    return
  }

  try {
    const upstream = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${workerToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(action === 'refresh'
        ? { batchLimit: 1 }
        : action === 'probe'
          ? { snapshotKeys: ['__probe_only__'] }
          : { publishPublicSnapshot: true, snapshotKeys: ['__publish_only__'] }),
    })
    response.status(upstream.status).send(await upstream.text())
  } catch (error) {
    response.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
