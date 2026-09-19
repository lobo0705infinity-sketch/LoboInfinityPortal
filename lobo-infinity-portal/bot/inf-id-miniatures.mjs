import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const catalogPath = resolve('data', 'infinity-miniatures', 'supplemental-images.json')
const allowedTypes = new Set(['exact-profile-sculpt', 'exact-troop-sculpt', 'representative-official-sculpt'])
const allowedImageHosts = new Set(['infinity.2nirwana.de', 'www.brueckenkopf-online.com', 'cdn.1001hobbies.nl'])

export function supplementalKey(entry) {
  return `${entry.unitId}:${entry.profileGroupId}:${entry.optionId}:${entry.profileId}`
}

export async function loadSupplementalMiniatures(path = catalogPath) {
  const data = JSON.parse(await readFile(path, 'utf8'))
  if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error('Unsupported supplemental miniature catalog.')
  const result = new Map()
  for (const entry of data.entries) {
    if (![entry.unitId, entry.profileGroupId, entry.optionId, entry.profileId].every(Number.isInteger)) throw new Error('Supplemental miniature entry has incomplete stable IDs.')
    if (!allowedTypes.has(entry.image?.matchType)) throw new Error('Supplemental miniature entry has an invalid match classification.')
    result.set(supplementalKey(entry), entry)
  }
  return result
}

export function chooseMiniature({ rosterEntry, infinityDataImage, supplementalCatalog }) {
  if (infinityDataImage?.url) return { ...infinityDataImage, resolutionSource: 'infinity-data', resolves: true }
  const supplemental = supplementalCatalog.get(supplementalKey(rosterEntry))
  if (supplemental && normalizedName(supplemental.unitName) === normalizedName(rosterEntry.unitName)) {
    return { ...supplemental.image, key: new URL(supplemental.image.url).pathname.split('/').pop(), resolutionSource: 'supplemental-catalog', resolves: true }
  }
  return { url: null, key: null, matchType: null, resolutionSource: 'unresolved', resolves: false }
}

export async function fetchImageData(url, { timeoutMs = 12_000, maxBytes = 8 * 1024 * 1024, fetchImpl = fetch } = {}) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !allowedImageHosts.has(parsed.hostname)) throw new Error('Miniature image host is not allowed.')
  const response = await fetchImpl(parsed, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
  const final = new URL(response.url || parsed)
  if (final.protocol !== 'https:' || !allowedImageHosts.has(final.hostname)) throw new Error('Miniature image redirected to an untrusted host.')
  const type = response.headers.get('content-type') || ''
  const declared = Number(response.headers.get('content-length') || 0)
  if (!response.ok || !/^image\/(png|jpe?g|webp)$/i.test(type) || declared > maxBytes) throw new Error('Miniature image response is invalid.')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > maxBytes) throw new Error('Miniature image exceeds the size limit.')
  return `data:${type.split(';')[0]};base64,${bytes.toString('base64')}`
}

export function normalizedName(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}
