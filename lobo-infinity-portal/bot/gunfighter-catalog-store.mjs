import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { GUNFIGHTER_CATALOG_SCHEMA } from './gunfighter-benchmark-catalog.mjs'

let cachedPath = null
let cachedCatalog = null

export const BUNDLED_GUNFIGHTER_CATALOG_PATH = resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'gunfighter-benchmark-catalog.json')
export const BUNDLED_GUNFIGHTER_CATALOG_ARCHIVE_PATH = `${BUNDLED_GUNFIGHTER_CATALOG_PATH}.gz.b64`

export async function loadGunfighterBenchmarkCatalog(path = BUNDLED_GUNFIGHTER_CATALOG_PATH) {
  const absolute = resolve(path)
  if (cachedPath === absolute && cachedCatalog) return cachedCatalog
  try {
    const source = absolute === BUNDLED_GUNFIGHTER_CATALOG_PATH
      ? gunzipSync(Buffer.from(await readBundledArchive(), 'base64')).toString('utf8')
      : await readFile(absolute, 'utf8')
    const catalog = JSON.parse(source)
    if (catalog?.schemaVersion !== GUNFIGHTER_CATALOG_SCHEMA || !Array.isArray(catalog.entries)) throw new Error('Unsupported gunfighter catalog schema.')
    cachedPath = absolute
    cachedCatalog = catalog
    return catalog
  } catch {
    if (cachedPath === absolute) cachedCatalog = null
    return null
  }
}

async function readBundledArchive() {
  const parts = []
  for (let index = 1; index <= 99; index += 1) {
    try { parts.push(await readFile(`${BUNDLED_GUNFIGHTER_CATALOG_ARCHIVE_PATH}.part-${String(index).padStart(2, '0')}`, 'utf8')) }
    catch { break }
  }
  return parts.length ? parts.join('') : readFile(BUNDLED_GUNFIGHTER_CATALOG_ARCHIVE_PATH, 'utf8')
}
