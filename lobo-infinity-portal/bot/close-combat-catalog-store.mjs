import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CLOSE_COMBAT_CATALOG_SCHEMA } from './close-combat-catalog.mjs'

let cachedPath = null
let cachedCatalog = null

export const BUNDLED_CLOSE_COMBAT_CATALOG_PATH = resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'close-combat-benchmark.json')

export async function loadCloseCombatCatalog(path = BUNDLED_CLOSE_COMBAT_CATALOG_PATH) {
  const absolute = resolve(path)
  if (cachedPath === absolute && cachedCatalog) return cachedCatalog
  try {
    const catalog = JSON.parse(await readFile(absolute, 'utf8'))
    if (catalog?.schemaVersion !== CLOSE_COMBAT_CATALOG_SCHEMA || !Array.isArray(catalog.entries)) throw new Error('Unsupported close-combat catalog schema.')
    cachedPath = absolute
    cachedCatalog = catalog
    return catalog
  } catch {
    if (cachedPath === absolute) cachedCatalog = null
    return null
  }
}
