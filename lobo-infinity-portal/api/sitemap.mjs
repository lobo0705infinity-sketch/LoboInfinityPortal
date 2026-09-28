import { loboWorkshopMaps } from '../shared/lobo-workshop-maps.mjs'

const siteOrigin = 'https://lobo-infinity-portal.vercel.app'
const snapshotOrigin = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'

// Only canonical, public landing pages belong here. Snapshot-backed detail pages
// are added below so new reports and events appear without another deployment.
const publicPaths = [
  '/',
  '/explore',
  '/little-helper',
  '/army-intelligence',
  '/games',
  '/maps',
  '/events',
  '/players',
  '/factions',
  '/missions',
  '/streams',
  '/army-lists',
  '/analytics',
  '/compare',
  '/standings',
  '/schedule',
  '/league-operations',
  '/community',
  '/rules',
]

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('allow', 'GET, HEAD')
    response.status(405).end()
    return
  }

  const { xml, snapshotAvailable } = await buildSitemap()
  response.setHeader('content-type', 'application/xml; charset=utf-8')
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('cache-control', snapshotAvailable
    ? 'public, s-maxage=300, stale-while-revalidate=3600'
    : 'no-store')
  response.status(200)
  if (request.method === 'HEAD') response.end()
  else response.send(xml)
}

export async function buildSitemap({ fetchObject = fetch } = {}) {
  const paths = new Set(publicPaths)
  for (const map of loboWorkshopMaps) paths.add(`/maps/${map.slug}`)
  let snapshotAvailable = false

  try {
    const pointer = await readJson(new URL('public-snapshots/current.json', snapshotOrigin), fetchObject)
    if (!/^\d{8}T\d{6}Z$/.test(pointer?.snapshotId)
      || pointer.basePath !== `public-snapshots/${pointer.snapshotId}/`) {
      throw new Error('Invalid public snapshot pointer')
    }

    const datasets = await Promise.all(['games', 'events', 'factions', 'missions'].map(async (name) => {
      const url = new URL(`${pointer.basePath}${name}.json`, snapshotOrigin)
      const envelope = await readJson(url, fetchObject)
      if (envelope.snapshotId !== pointer.snapshotId || !Array.isArray(envelope.data)) {
        throw new Error(`Invalid public ${name} snapshot`)
      }
      return envelope.data
    }))

    for (const game of datasets[0]) {
      const id = String(game?.id ?? '').trim()
      if (/^[a-zA-Z0-9_-]{1,80}$/.test(id)) paths.add(`/games/${id}`)
    }
    for (const event of datasets[1]) {
      const id = String(event?.id ?? '').trim()
      if (/^[a-zA-Z0-9_-]{1,100}$/.test(id)) paths.add(`/event/${id}`)
    }
    for (const faction of datasets[2]) {
      const name = String(faction?.name ?? '').trim()
      if (name) paths.add(`/factions/${encodeURIComponent(name)}`)
    }
    for (const mission of datasets[3]) {
      const name = String(mission?.mission ?? '').trim()
      if (name) paths.add(`/missions/${encodeURIComponent(name)}`)
    }
    snapshotAvailable = true
  } catch (error) {
    // Evergreen landing pages remain available if the public snapshot is down.
    console.error('Sitemap public snapshot unavailable:', error)
  }

  const urls = [...paths].sort().slice(0, 50_000)
  const entries = urls.map(path => `  <url><loc>${escapeXml(siteOrigin + path)}</loc></url>`)
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`,
    snapshotAvailable,
  }
}

async function readJson(url, fetchObject) {
  const response = await fetchObject(url, { signal: AbortSignal.timeout(8_000) })
  if (!response.ok) throw new Error(`Public snapshot returned HTTP ${response.status}`)
  return response.json()
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}
