export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('allow', 'GET')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  const startedAt = performance.now()
  const configuredFileId = String(process.env.PUBLIC_PLAYERS_PROJECTION_FILE_ID || '').trim()
  const fileId = configuredFileId || await bootstrapProjectionFileId()
  if (!fileId) {
    response.status(503).json({ error: 'Public Players projection is not configured.', success: false })
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

    const artifact = await source.json()
    if (artifact?.eventId !== '' || !Array.isArray(artifact?.divisions) ||
        !Array.isArray(artifact?.comparison?.players) ||
        !Array.isArray(artifact?.comparison?.headToHead)) {
      throw new Error('Public Players projection is invalid.')
    }

    const body = JSON.stringify({
      divisions: artifact.divisions,
      comparison: artifact.comparison,
      eventId: '',
      generatedAt: artifact.generatedAt,
      success: true,
    })
    const totalMs = performance.now() - startedAt
    response.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=86400')
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.setHeader('server-timing', `projection-source;dur=${sourceMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`)
    response.setHeader('x-lobo-projection-generated-at', String(artifact.generatedAt || ''))
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

  const body = new URLSearchParams({ action: 'refreshPublicPlayersProjection', workerToken })
  const upstream = await fetch(apiUrl, { body, method: 'POST', redirect: 'follow' })
  const payload = await upstream.json()
  if (!upstream.ok || payload?.success !== true) {
    throw new Error(payload?.error || `Projection bootstrap returned HTTP ${upstream.status}.`)
  }
  return String(payload.fileId || '').trim()
}
