#!/usr/bin/env node
import { resolve } from 'node:path'
import { buildOfficialCombatSource } from '../bot/official-combat-source.mjs'
import { buildGunfighterBenchmarkCatalog } from '../bot/gunfighter-benchmark-catalog.mjs'
import { buildStandardGunfighterDefenders, GUNFIGHTER_BENCHMARK_VERSION } from '../bot/gunfighter-standard-benchmark.mjs'
import { readArtifact, writeArtifact, parseArgs } from './benchmark-artifacts.mjs'

const args = parseArgs(process.argv.slice(2))
const input = args['official-input'] || 'data/infinity-army/benchmark-official-source.json.gz.b64'
const capture = await readArtifact(resolve(input))
const source = buildOfficialCombatSource(capture)
const defenders = buildStandardGunfighterDefenders(source.weaponChart, [], { canonicalProfiles: source.profiles })
console.log(`Built ${source.profiles.length} exact official profiles and ${defenders.length} defenders`)
const catalog = buildGunfighterBenchmarkCatalog({
  profiles: source.profiles, defenders, officialDataVersion: source.datasetId,
  benchmarkVersion: GUNFIGHTER_BENCHMARK_VERSION,
  options: { sourceWeaponChart: 'official-api', rulesVersion: source.rulesVersion, surpriseAttack: false },
})
catalog.source = {
  datasetId: source.datasetId, captureFingerprint: source.captureFingerprint,
  rulesVersion: source.rulesVersion, payloadCount: capture.payloads.length,
  weaponRecordCount: source.weaponChart.length, profileSource: 'exact-official-identities',
}
catalog.methodology = {
  normal: 'Unlinked active turn, no assumed marker state, no external support.',
  fireteam: 'Eligible profiles only; conditional +1SD, separate from native weapon modifiers.',
  weighting: 'Declared archetype weights; variants and linked/unlinked copies split each share.',
  score: 'Expected capped damage plus state utility and retaliation; not a kill probability.',
  smoke: 'Reactive Smoke/Eclipse assumes a legal close placement blocking LoF; no external smoke support or geometric placement search.',
}
const output = resolve(args.output || 'data/infinity-army/gunfighter-benchmark-catalog.json')
await writeArtifact(output, catalog)
console.log(JSON.stringify({ output, entries: catalog.entryCount, fingerprint: catalog.fingerprint }))
