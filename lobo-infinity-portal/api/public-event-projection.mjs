const TOP40_EVENT_ID = 'event-lobo-s-american-top-40'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('allow', 'GET')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  const startedAt = performance.now()
  const eventId = String(request.query?.eventId || '').trim()
  if (eventId !== TOP40_EVENT_ID) {
    response.status(404).json({ error: 'Public event projection was not found.', success: false })
    return
  }

  const configuredFileId = String(process.env.TOP40_PUBLIC_PROJECTION_FILE_ID || '').trim()
  const fileId = configuredFileId || await bootstrapProjectionFileId()
  if (!fileId) {
    response.status(503).json({ error: 'Public event projection is not configured.', success: false })
    return
  }

  try {
    const sourceStartedAt = performance.now()
    const source = await fetch(
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
      { redirect: 'follow' },
    )
    const sourceMs = performance.now() - sourceStartedAt
    if (!source.ok) throw new Error(`Projection source returned HTTP ${source.status}.`)

    const projection = await source.json()
    if (
      projection?.eventId !== TOP40_EVENT_ID ||
      projection?.home?.event?.id !== TOP40_EVENT_ID ||
      projection?.bracket?.eventId !== TOP40_EVENT_ID
    ) {
      throw new Error('Projection event isolation validation failed.')
    }

    const body = JSON.stringify({ projection, success: true })
    const totalMs = performance.now() - startedAt
    response.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=86400')
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.setHeader('server-timing', `projection-source;dur=${sourceMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`)
    response.setHeader('x-lobo-projection-generated-at', String(projection.generatedAt || ''))
    response.setHeader('x-lobo-projection-bytes', String(Buffer.byteLength(body)))
    if (!configuredFileId) response.setHeader('x-lobo-projection-bootstrap-file-id', fileId)
    response.status(200).send(body)
  } catch (error) {
    response.setHeader('cache-control', 'no-store')
    response.status(502).json({
      error: error instanceof Error ? error.message : String(error),
      success: false,
    })
  }
}

async function bootstrapProjectionFileId() {
  const apiUrl = String(process.env.VITE_API_URL || '').trim()
  const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  if (!apiUrl || !workerToken) return ''

  const body = new URLSearchParams({
    action: 'refreshTop40PublicProjection',
    workerToken,
  })
  const response = await fetch(apiUrl, { body, method: 'POST', redirect: 'follow' })
  const payload = await response.json()
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error || `Projection bootstrap returned HTTP ${response.status}.`)
  }
  return String(payload.fileId || '').trim()
}
