import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { ARO_CATALOG_SCHEMA } from './aro-benchmark-catalog.mjs'

let cachedCatalog = null
export const BUNDLED_ARO_CATALOG_PATH = resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'aro-benchmark-catalog.json.gz.b64')

export async function loadAroBenchmarkCatalog(path = BUNDLED_ARO_CATALOG_PATH) {
  if (cachedCatalog && resolve(path) === BUNDLED_ARO_CATALOG_PATH) return cachedCatalog
  try {
    const encoded = resolve(path) === BUNDLED_ARO_CATALOG_PATH
      ? await readBundledArchive()
      : await readFile(resolve(path), 'utf8')
    const catalog = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'))
    if (catalog?.schemaVersion !== ARO_CATALOG_SCHEMA || !Array.isArray(catalog.entries)) throw new Error('Unsupported ARO catalog schema.')
    if (resolve(path) === BUNDLED_ARO_CATALOG_PATH) cachedCatalog = catalog
    return catalog
  } catch {
    return null
  }
}

async function readBundledArchive() {
  const parts = []
  for (let index = 1; index <= 99; index += 1) {
    try { parts.push(await readFile(`${BUNDLED_ARO_CATALOG_PATH}.part-${String(index).padStart(2, '0')}`, 'utf8')) }
    catch { break }
  }
  return parts.length ? parts.join('') : readFile(BUNDLED_ARO_CATALOG_PATH, 'utf8')
}
