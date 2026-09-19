import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { CLOSE_COMBAT_CATALOG_SCHEMA } from './close-combat-catalog.mjs'

let cachedPath = null
let cachedCatalog = null

export const BUNDLED_CLOSE_COMBAT_CATALOG_PATH = resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'close-combat-benchmark.json')
export const BUNDLED_CLOSE_COMBAT_CATALOG_ARCHIVE_PATH = `${BUNDLED_CLOSE_COMBAT_CATALOG_PATH}.gz.b64`

export async function loadCloseCombatCatalog(path = BUNDLED_CLOSE_COMBAT_CATALOG_PATH) {
  const absolute = resolve(path)
  if (cachedPath === absolute && cachedCatalog) return cachedCatalog
  try {
    const source = absolute === BUNDLED_CLOSE_COMBAT_CATALOG_PATH
      ? gunzipSync(Buffer.from(await readBundledArchive(), 'base64')).toString('utf8')
      : await readFile(absolute, 'utf8')
    const catalog = JSON.parse(source)
    if (catalog?.schemaVersion !== CLOSE_COMBAT_CATALOG_SCHEMA || !Array.isArray(catalog.entries)) throw new Error('Unsupported close-combat catalog schema.')
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
    try { parts.push(await readFile(`${BUNDLED_CLOSE_COMBAT_CATALOG_ARCHIVE_PATH}.part-${String(index).padStart(2, '0')}`, 'utf8')) }
    catch { break }
  }
  return parts.length ? parts.join('') : readFile(BUNDLED_CLOSE_COMBAT_CATALOG_ARCHIVE_PATH, 'utf8')
}
