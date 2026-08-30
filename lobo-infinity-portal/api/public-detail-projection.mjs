const sections = new Set(['games', 'players', 'factions', 'missions'])

export const config = { maxDuration: 300 }

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('allow', 'GET')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }
  const section = String(request.query?.section || '')
  if (!sections.has(section)) {
    response.status(400).json({ error: 'A valid public detail section is required.', success: false })
    return
  }
  try {
    const startedAt = performance.now()
    const configuredFileId = String(process.env.PUBLIC_DETAIL_PROJECTION_FILE_ID || '').trim()
    const fileId = configuredFileId || await bootstrapProjectionFileId(section)
    if (!fileId) {
      response.status(503).json({ error: 'Public detail projection is not configured.', success: false })
      return
    }
    const sourceStartedAt = performance.now()
    const source = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`, { redirect: 'follow' })
    const sourceMs = performance.now() - sourceStartedAt
    if (!source.ok) throw new Error(`Projection source returned HTTP ${source.status}.`)
    const artifact = await source.json()
    const projection = section === 'games'
      ? { games: artifact.games, news: artifact.news, streams: artifact.streams }
      : artifact[section]
    if (!artifact?.generatedAt || projection == null) throw new Error('Public detail projection section is unavailable.')
    const body = JSON.stringify({ generatedAt: artifact.generatedAt, projection, success: true })
    response.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=86400')
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.setHeader('server-timing', `projection-source;dur=${sourceMs.toFixed(1)}, total;dur=${(performance.now() - startedAt).toFixed(1)}`)
    response.setHeader('x-lobo-projection-bytes', String(Buffer.byteLength(body)))
    response.status(200).send(body)
  } catch (error) {
    response.setHeader('cache-control', 'no-store')
    response.status(502).json({ error: error instanceof Error ? error.message : String(error), success: false })
  }
}

async function bootstrapProjectionFileId(section) {
  const apiUrl = String(process.env.VITE_API_URL || '').trim()
  const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  if (!apiUrl || !workerToken) return ''
  const body = new URLSearchParams({ action: 'refreshPublicDetailProjection', section, workerToken })
  const upstream = await fetch(apiUrl, {
    body,
    method: 'POST',
    redirect: 'follow',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  })
  const payload = await upstream.json()
  if (!upstream.ok || payload?.success !== true) {
    throw new Error(
      payload?.error || payload?.message ||
      `Projection bootstrap returned HTTP ${upstream.status} (${Object.keys(payload || {}).join(',') || 'empty'}).`,
    )
  }
  return String(payload.fileId || '').trim()
}
