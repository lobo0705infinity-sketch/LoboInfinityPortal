import { readFile } from 'node:fs/promises'
import { MOBILE_GUNFIGHTER_VERSION } from './mobile-gunfighter.mjs'
let cached
export async function loadMobileGunfighterCatalog() {
  if (cached) return cached
  try {
    const catalog = JSON.parse(await readFile(new URL('../src/data/mobile-gunfighter.json', import.meta.url), 'utf8'))
    if (catalog.version !== MOBILE_GUNFIGHTER_VERSION || !catalog.keys || !Array.isArray(catalog.profiles)) return null
    return cached = catalog
  } catch { return null }
}
