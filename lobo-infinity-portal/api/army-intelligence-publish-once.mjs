import { createHash, timingSafeEqual } from 'node:crypto'

const TOKEN_HASH = '9ed8183f0efa8d3d0e4b28092eb083ac27d3434ca54ca903d6c4f72c2b9761bc'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    response.status(405).json({ success: false })
    return
  }
  const suppliedHash = createHash('sha256').update(String(request.headers?.['x-maintenance-token'] || '')).digest('hex')
  if (!timingSafeEqual(Buffer.from(suppliedHash), Buffer.from(TOKEN_HASH))) {
    response.status(404).json({ success: false })
    return
  }
  const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  const origin = `https://${request.headers.host}`
  const refreshOnly = String(request.headers?.['x-maintenance-action'] || '') === 'refresh'
  const upstream = await fetch(`${origin}/api/army-intelligence-refresh-worker`, {
    method: 'POST',
    headers: { authorization: `Bearer ${workerToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(refreshOnly
      ? { batchLimit: 5 }
      : { publishPublicSnapshot: true, snapshotKeys: ['__publish_only__'] }),
  })
  const text = await upstream.text()
  response.status(upstream.status).send(text)
}
