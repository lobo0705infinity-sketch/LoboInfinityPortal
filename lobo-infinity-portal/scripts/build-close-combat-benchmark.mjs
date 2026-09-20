#!/usr/bin/env node
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { buildCanonicalCloseCombatProfiles } from '../bot/close-combat-canonicalizer.mjs'
import { buildCloseCombatCatalog } from '../bot/close-combat-catalog.mjs'
import { buildStandardCloseCombatDefenders, CLOSE_COMBAT_BENCHMARK_VERSION } from '../bot/close-combat-standard-benchmark.mjs'
import { COMBAT_RULES_VERSION } from '../bot/combat-rules.mjs'
import { validateMobilityCapture } from '../bot/mobility-catalog-validation.mjs'
import { readArtifact, writeArtifact, parseArgs } from './benchmark-artifacts.mjs'

const args = parseArgs(process.argv.slice(2))
const input = await readArtifact(resolve(args.input || 'data/infinity-army/benchmark-official-source.json.gz.b64'))
validateMobilityCapture(input)
const profiles = buildCanonicalCloseCombatProfiles({ official: input })
const defenders = buildStandardCloseCombatDefenders()
console.log(`Built ${profiles.length} canonical CC loadouts; starting exact benchmark evaluation`)
const artifact = buildCloseCombatCatalog({
  profiles, defenders,
  officialDataVersion: input.payloads.map(p => p.version).filter(Boolean).sort().at(-1) || null,
  benchmarkVersion: CLOSE_COMBAT_BENCHMARK_VERSION,
})
artifact.source = { captureFingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'), rulesVersion: COMBAT_RULES_VERSION }
const output = resolve(args.output || 'data/infinity-army/close-combat-benchmark.json')
await writeArtifact(output, artifact)
console.log(JSON.stringify({ output, entries: artifact.entryCount, aliases: artifact.sourceAliasCount, fingerprint: artifact.fingerprint }))
