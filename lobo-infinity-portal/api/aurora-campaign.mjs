import { get, put, BlobPreconditionFailedError } from '@vercel/blob'
import { randomUUID } from 'node:crypto'
import { verifyCommissionerSession } from './featured-report.mjs'
import { readPublicDataset } from './_lib/public-snapshot.mjs'
import { emptyAuroraState, validateAuroraPublicState } from '../shared/aurora-public-state.mjs'

const pathname = 'portal-config/aurora-vii-public.json'

async function readStoredPublication(getObject = get) {
  const blob = await getObject(pathname, { access: 'public', useCache: false })
  if (!blob) return { publication: { revision: '', publishedAt: '', state: emptyAuroraState() }, etag: null }
  const data = await new Response(blob.stream).json()
  if (typeof data.revision !== 'string' || typeof data.publishedAt !== 'string') throw new Error('Invalid campaign publication.')
  return { publication: { revision: data.revision, publishedAt: data.publishedAt, state: validateAuroraPublicState(data.state) }, etag: blob.blob?.etag }
}

export async function readAuroraPublication(getObject = get) {
  return (await readStoredPublication(getObject)).publication
}

export async function saveAuroraPublication(body, { getObject = get, putObject = put, readEvents = () => readPublicDataset('events'), now = () => new Date() } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'expectedRevision,state') throw new Error('Submit only approved public campaign state and its revision.')
  if (JSON.stringify(body).length > 150000) throw new Error('Campaign publication is too large.')
  if (typeof body.expectedRevision !== 'string') throw new Error('A publication revision is required.')
  const state = validateAuroraPublicState(body.state)
  if (state.eventId) {
    const events = await readEvents()
    if (!events.some(event => event.id === state.eventId && /narrative campaign/i.test(event.type))) throw new Error('Choose a published Narrative Campaign event.')
  }
  const { publication: previous, etag } = await readStoredPublication(getObject)
  if (body.expectedRevision !== previous.revision) { const error = new Error('The campaign changed. Reload before publishing.'); error.code = 'REVISION_CONFLICT'; throw error }
  const publishedAt = now().toISOString()
  const publication = { revision: randomUUID(), publishedAt, state }
  try {
    await putObject(pathname, JSON.stringify(publication), { access: 'public', allowOverwrite: Boolean(previous.revision), ...(etag ? { ifMatch: etag } : {}), addRandomSuffix: false, cacheControlMaxAge: 60, contentType: 'application/json; charset=utf-8' })
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError || error?.constructor?.name === 'BlobAlreadyExistsError') {
      error.code = 'REVISION_CONFLICT'
      error.message = 'The campaign changed. Reload before publishing.'
    }
    throw error
  }
  return publication
}

export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store')
  response.setHeader('x-content-type-options', 'nosniff')
  if (request.method === 'GET') {
    try { return response.status(200).json(await readAuroraPublication()) }
    catch { return response.status(503).json({ error: 'Published campaign state is temporarily unavailable.' }) }
  }
  if (request.method !== 'POST') { response.setHeader('allow', 'GET, POST'); return response.status(405).json({ error: 'Method not allowed.' }) }
  try {
    if (!await verifyCommissionerSession(request.headers?.authorization)) return response.status(403).json({ error: 'Commissioner access is required.' })
  } catch { return response.status(503).json({ error: 'Commissioner verification is temporarily unavailable.' }) }
  let body
  try { body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body }
  catch { return response.status(400).json({ error: 'Invalid public campaign publication.' }) }
  try { return response.status(200).json(await saveAuroraPublication(body)) }
  catch (error) { return response.status(error.code === 'REVISION_CONFLICT' ? 409 : 400).json({ error: error.message || 'Campaign publication failed.' }) }
}
