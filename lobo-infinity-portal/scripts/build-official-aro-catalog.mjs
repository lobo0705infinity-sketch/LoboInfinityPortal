#!/usr/bin/env node
import { resolve } from 'node:path'
import { buildAroBenchmarkCatalog, selectBenchmarkAttackers } from '../bot/aro-benchmark-catalog.mjs'
import { loadGunfighterBenchmarkCatalog } from '../bot/gunfighter-catalog-store.mjs'
import { buildOfficialCombatSource } from '../bot/official-combat-source.mjs'
import { readArtifact, writeArtifact, parseArgs } from './benchmark-artifacts.mjs'

const args = parseArgs(process.argv.slice(2))
const capture = await readArtifact(resolve(args['official-input'] || 'data/infinity-army/benchmark-official-source.json.gz.b64'))
const source = buildOfficialCombatSource(capture)
const gunfighter = await loadGunfighterBenchmarkCatalog()
if (!gunfighter || gunfighter.source?.captureFingerprint !== source.captureFingerprint || gunfighter.source?.rulesVersion !== source.rulesVersion) throw Error('Rebuild gunfighters first: ARO inputs must have identical source and rules versions.')
const keys = new Set(source.profiles.map(profile => profile.id))
if (gunfighter.entries.length !== keys.size || gunfighter.entries.some(entry => !keys.has(entry.key))) throw Error('Gunfighter/ARO profile identity mismatch')
const attackers = selectBenchmarkAttackers(source.profiles, gunfighter, { limit: 30 })
console.log('ARO attacker suite:', attackers.map(a => `${a.profile.name} [${a.state}]`).join('; '))
const catalog = buildAroBenchmarkCatalog({
  profiles: source.profiles, attackers, officialDataVersion: source.datasetId,
  options: { sourceProfiles: 'exact-official-identities', attackerCount: 30, rulesVersion: source.rulesVersion },
})
catalog.source = { datasetId: source.datasetId, captureFingerprint: source.captureFingerprint, rulesVersion: source.rulesVersion, gunfighterCatalogFingerprint: gunfighter.fingerprint }
const output = resolve(args.output || 'data/infinity-army/aro-benchmark-catalog.json.gz.b64')
await writeArtifact(output, catalog, { plain: false })
console.log(JSON.stringify({ output, entries: catalog.entryCount, fingerprint: catalog.fingerprint }))
