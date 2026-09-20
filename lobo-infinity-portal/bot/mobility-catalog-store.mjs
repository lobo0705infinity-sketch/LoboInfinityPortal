import { readFile } from 'node:fs/promises'

let cached
export async function loadMobilityCatalog() {
  if (cached) return cached
  try {
    const catalog = JSON.parse(await readFile(new URL('../src/data/mobility-index.json', import.meta.url), 'utf8'))
    if (catalog.version !== 'mobility-index-v2' || !Array.isArray(catalog.profiles) || !catalog.keys) return null
    cached = catalog
    return catalog
  } catch { return null }
}
