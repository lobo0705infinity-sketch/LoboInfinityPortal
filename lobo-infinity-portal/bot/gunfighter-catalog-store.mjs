import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { GUNFIGHTER_CATALOG_SCHEMA } from './gunfighter-benchmark-catalog.mjs'

let cachedPath = null
let cachedCatalog = null

export const BUNDLED_GUNFIGHTER_CATALOG_PATH = resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'gunfighter-benchmark-catalog.json')

export async function loadGunfighterBenchmarkCatalog(path = BUNDLED_GUNFIGHTER_CATALOG_PATH) {
  const absolute = resolve(path)
  if (cachedPath === absolute && cachedCatalog) return cachedCatalog
  try {
    const catalog = JSON.parse(await readFile(absolute, 'utf8'))
    if (catalog?.schemaVersion !== GUNFIGHTER_CATALOG_SCHEMA || !Array.isArray(catalog.entries)) throw new Error('Unsupported gunfighter catalog schema.')
    cachedPath = absolute
    cachedCatalog = catalog
    return catalog
  } catch {
    if (cachedPath === absolute) cachedCatalog = null
    return null
  }
}
