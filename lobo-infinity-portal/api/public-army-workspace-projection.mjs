const sections = new Set(['armyLists', 'intelligenceSummary', 'intelligenceFaction'])

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('allow', 'GET')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }
  const section = String(request.query?.section || '')
  if (!sections.has(section)) {
    response.status(400).json({ error: 'A valid Army projection section is required.', success: false })
    return
  }
  try {
    const startedAt = performance.now()
    const configured = getConfiguredFileId(section)
    const ids = configured ? null : await bootstrapProjectionFileIds(section)
    const fileId = configured || getBootstrappedFileId(ids, section)
    if (!fileId) throw new Error('Public Army workspace projection is not configured.')
    const sourceStartedAt = performance.now()
    const source = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`, { redirect: 'follow' })
    const sourceMs = performance.now() - sourceStartedAt
    if (!source.ok) throw new Error(`Projection source returned HTTP ${source.status}.`)
    const artifact = await source.json()
    let projection
    if (section === 'armyLists') projection = artifact
    else if (section === 'intelligenceSummary') projection = artifact?.projection
    else projection = artifact?.details?.[String(request.query?.faction || '')]
    if (!artifact?.generatedAt || projection == null) throw new Error('Prepared Army projection is unavailable for the requested scope.')
    const body = JSON.stringify({ generatedAt: artifact.generatedAt, projection, success: true })
    response.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=86400')
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.setHeader('server-timing', `projection-source;dur=${sourceMs.toFixed(1)}, total;dur=${(performance.now() - startedAt).toFixed(1)}`)
    response.setHeader('x-lobo-projection-bytes', String(Buffer.byteLength(body)))
    if (!configured) response.setHeader('x-lobo-projection-bootstrap-file-ids', JSON.stringify(ids))
    response.status(200).send(body)
  } catch (error) {
    response.setHeader('cache-control', 'no-store')
    response.status(502).json({ error: error instanceof Error ? error.message : String(error), success: false })
  }
}

function getConfiguredFileId(section) {
  if (section === 'armyLists') return String(process.env.PUBLIC_ARMY_LISTS_PROJECTION_FILE_ID || '').trim()
  if (section === 'intelligenceSummary') return String(process.env.PUBLIC_ARMY_INTELLIGENCE_SUMMARY_FILE_ID || '').trim()
  return String(process.env.PUBLIC_ARMY_INTELLIGENCE_DETAIL_FILE_ID || '').trim()
}

function getBootstrappedFileId(ids, section) {
  if (section === 'armyLists') return String(ids?.armyLists || '').trim()
  if (section === 'intelligenceSummary') return String(ids?.intelligenceSummary || '').trim()
  return String(ids?.intelligenceDetail || '').trim()
}

async function bootstrapProjectionFileIds(section) {
  const apiUrl = String(process.env.VITE_API_URL || '').trim()
  const workerToken = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  if (!apiUrl || !workerToken) return null
  const publisherSection = section === 'armyLists' ? 'armyLists' : 'intelligence'
  const body = new URLSearchParams({ action: 'refreshPublicArmyWorkspaceProjection', section: publisherSection, workerToken })
  const upstream = await fetch(apiUrl, { body, method: 'POST', redirect: 'follow' })
  const payload = await upstream.json()
  if (!upstream.ok || payload?.success !== true) throw new Error(payload?.error || `Projection bootstrap returned HTTP ${upstream.status}.`)
  return payload.fileIds || null
}
