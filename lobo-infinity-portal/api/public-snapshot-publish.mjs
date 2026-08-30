import { createHash, timingSafeEqual } from 'node:crypto'
import { put } from '@vercel/blob'

export const PUBLIC_SNAPSHOT_FILES = Object.freeze([
  'snapshot.json',
  'players.json',
  'games.json',
  'events.json',
  'missions.json',
  'factions.json',
  'standings.json',
])

const SNAPSHOT_ID_PATTERN = /^\d{8}T\d{6}Z$/
const MAX_PUBLICATION_BYTES = 1_000_000

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  const configuredToken = String(process.env.LOBO_SNAPSHOT_PUBLISH_TOKEN || '').trim()
  const authorization = String(request.headers?.authorization || '').trim()
  const suppliedToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
  if (!configuredToken || !safeEqual(suppliedToken, configuredToken)) {
    response.status(401).json({ error: 'Snapshot publication authentication is required.', success: false })
    return
  }

  try {
    const result = await publishPublicSnapshot(request.body, { putObject: put })
    response.status(200).json({ success: true, ...result })
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : String(error),
      success: false,
    })
  }
}

export async function publishPublicSnapshot(rawBody, { putObject = put } = {}) {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('A JSON publication payload is required.')
  }

  const snapshotId = String(body.snapshotId || '').trim()
  const sourceCutoff = String(body.sourceCutoff || '').trim()
  if (!SNAPSHOT_ID_PATTERN.test(snapshotId)) throw new Error('Invalid snapshot ID.')
  if (!sourceCutoff || Number.isNaN(Date.parse(sourceCutoff))) throw new Error('Invalid source cutoff.')
  if (!body.files || typeof body.files !== 'object' || Array.isArray(body.files)) {
    throw new Error('The seven snapshot files are required.')
  }

  const names = Object.keys(body.files).sort()
  const expectedNames = [...PUBLIC_SNAPSHOT_FILES].sort()
  if (names.length !== expectedNames.length || names.some((name, index) => name !== expectedNames[index])) {
    throw new Error('Exactly the seven allowlisted snapshot files are required.')
  }

  let totalBytes = 0
  const prepared = PUBLIC_SNAPSHOT_FILES.map((filename) => {
    const text = body.files[filename]
    if (typeof text !== 'string') throw new Error(`Snapshot file must be UTF-8 JSON text: ${filename}`)
    const byteCount = Buffer.byteLength(text, 'utf8')
    totalBytes += byteCount
    const parsed = JSON.parse(text)
    if (String(parsed.snapshotId || '') !== snapshotId) throw new Error(`Snapshot ID mismatch: ${filename}`)
    if (String(parsed.sourceCutoff || '') !== sourceCutoff) throw new Error(`Source cutoff mismatch: ${filename}`)
    return {
      byteCount,
      contentHash: createHash('sha256').update(text, 'utf8').digest('hex'),
      filename,
      pathname: `public-snapshots/${snapshotId}/${filename}`,
      text,
    }
  })
  if (totalBytes > MAX_PUBLICATION_BYTES) throw new Error('Snapshot publication payload is too large.')

  const files = []
  for (const artifact of prepared) {
    const blob = await putObject(artifact.pathname, artifact.text, {
      access: 'public',
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000,
      contentType: 'application/json; charset=utf-8',
    })
    files.push({
      filename: artifact.filename,
      pathname: artifact.pathname,
      byteCount: artifact.byteCount,
      contentHash: artifact.contentHash,
      url: blob.url,
    })
  }

  return { snapshotId, sourceCutoff, files, uploaded: files.length }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
