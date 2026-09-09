import { timingSafeEqual } from 'node:crypto'
import { head, put } from '@vercel/blob'
import { PUBLIC_SNAPSHOT_FILES, publishPublicSnapshot } from './public-snapshot-publish.mjs'

const SNAPSHOT_ID_PATTERN = /^\d{8}T\d{6}Z$/

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed.', success: false })
  }
  const configured = String(process.env.LOBO_SNAPSHOT_PUBLISH_TOKEN || '').trim()
  const supplied = String(request.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!configured || !safeEqual(supplied, configured)) {
    return response.status(401).json({ error: 'Snapshot publication authentication is required.', success: false })
  }
  try {
    const result = await publishTop40RegistrationSnapshot(request.body, { headObject: head, putObject: put })
    return response.status(200).json({ success: true, ...result })
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : String(error), success: false })
  }
}

export async function publishTop40RegistrationSnapshot(rawBody, {
  fetchObject = fetch,
  headObject = head,
  putObject = put,
  now = () => new Date(),
} = {}) {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).join(',') !== 'data') {
    throw new Error('Only the Top 40 registration projection is accepted.')
  }
  const registration = validateRegistration(body?.data)
  const currentBlob = await headObject('public-snapshots/current.json')
  const currentResponse = await fetchObject(currentBlob.url)
  if (!currentResponse.ok) throw new Error('Current snapshot pointer could not be read.')
  const current = await currentResponse.json()
  if (!SNAPSHOT_ID_PATTERN.test(String(current.snapshotId || '')) || !current.basePath) {
    throw new Error('Current snapshot pointer is invalid.')
  }

  const timestamp = now()
  const snapshotId = formatSnapshotId(timestamp)
  const sourceCutoff = timestamp.toISOString()
  if (snapshotId <= current.snapshotId) throw new Error('New snapshot identity must advance the current pointer.')
  const baseUrl = new URL(`/${String(current.basePath).replace(/^\/+/, '')}`, currentBlob.url)
  const files = {}
  for (const filename of PUBLIC_SNAPSHOT_FILES) {
    if (filename === 'top-40-registrations.json') {
      files[filename] = JSON.stringify({
        schemaVersion: 1,
        snapshotId,
        sourceCutoff,
        data: { generatedAt: sourceCutoff, players: registration.players },
      })
      continue
    }
    const fileResponse = await fetchObject(new URL(filename, baseUrl).href)
    if (!fileResponse.ok) throw new Error(`Current snapshot file could not be read: ${filename}`)
    const value = await fileResponse.json()
    value.snapshotId = snapshotId
    value.sourceCutoff = sourceCutoff
    if (filename === 'snapshot.json') {
      value.createdAt = sourceCutoff
      value.files = value.files && typeof value.files === 'object' ? value.files : {}
      value.files.top40Registrations = 'top-40-registrations.json'
    }
    files[filename] = JSON.stringify(value)
  }

  const latestBlob = await headObject('public-snapshots/current.json')
  const latestResponse = await fetchObject(latestBlob.url)
  if (!latestResponse.ok) throw new Error('Current snapshot pointer could not be revalidated.')
  const latest = await latestResponse.json()
  if (latest.snapshotId !== current.snapshotId) throw new Error('Current snapshot changed during Top 40 publication; retry safely.')

  return publishPublicSnapshot({ snapshotId, sourceCutoff, files, activate: true }, {
    compareCurrent: false,
    fetchObject,
    headObject,
    putObject,
  })
}

function validateRegistration(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.players)) {
    throw new Error('A Top 40 registration projection is required.')
  }
  if (Object.keys(value).sort().some((key) => !['generatedAt', 'players'].includes(key))) {
    throw new Error('Top 40 registration projection exposes unsupported fields.')
  }
  if (value.players.length > 40) throw new Error('Top 40 registration capacity exceeded.')
  const seen = new Set()
  const players = value.players.map((player, index) => {
    if (!player || typeof player !== 'object' || Array.isArray(player)) throw new Error('Invalid Top 40 registration.')
    if (Object.keys(player).sort().join(',') !== 'name,position') throw new Error('Top 40 registration exposes unsupported fields.')
    const name = String(player.name || '').trim().replace(/\s+/g, ' ')
    if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Invalid Top 40 registration name.')
    if (player.position !== index + 1) throw new Error('Invalid Top 40 registration position.')
    const normalized = name.toLowerCase()
    if (seen.has(normalized)) throw new Error('Duplicate Top 40 registration name.')
    seen.add(normalized)
    if (player.position !== index + 1) throw new Error('Top 40 registration positions must be sequential.')
    return { name, position: index + 1 }
  })
  return { players }
}

function formatSnapshotId(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
