import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { loadGunfighterBenchmarkCatalog } from '../bot/gunfighter-catalog-store.mjs'
import { loadMobilityCatalog } from '../bot/mobility-catalog-store.mjs'
import { buildMobileGunfighterCatalog } from '../bot/mobile-gunfighter.mjs'
const g = await loadGunfighterBenchmarkCatalog(), m = await loadMobilityCatalog()
if (!g || !m) throw Error('Both source catalogs are required')
const audited = JSON.parse(await readFile('src/data/profile-audit.json', 'utf8'))
const catalog = buildMobileGunfighterCatalog(g, m, key => {
  const index = audited.keys[key]
  return index === undefined || audited.memberships[audited.profiles[index].m].length > 0
})
catalog.profileAuditFingerprint = audited.fingerprint
catalog.fingerprint = createHash('sha256').update(JSON.stringify(catalog)).digest('hex')
await writeFile('src/data/mobile-gunfighter.json', JSON.stringify(catalog) + '\n')
console.log(JSON.stringify({ fingerprint: catalog.fingerprint, coverage: catalog.coverage, records: catalog.profiles.length }))
