#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildCanonicalCloseCombatProfiles } from '../bot/close-combat-canonicalizer.mjs'
import { buildCloseCombatCatalog } from '../bot/close-combat-catalog.mjs'
import { buildStandardCloseCombatDefenders, CLOSE_COMBAT_BENCHMARK_VERSION } from '../bot/close-combat-standard-benchmark.mjs'

const args = parseArgs(process.argv.slice(2))
if (!args.input) throw new Error('Usage: node scripts/build-close-combat-benchmark.mjs --input <official-army-payloads.json> [--output <catalog.json>]')
const input = JSON.parse(await readFile(resolve(args.input), 'utf8'))
const profiles = buildCanonicalCloseCombatProfiles({ official: input })
const defenders = buildStandardCloseCombatDefenders()
console.log(`Built ${profiles.length} canonical CC loadouts; starting exact benchmark evaluation`)
const artifact = buildCloseCombatCatalog({
  profiles,
  defenders,
  officialDataVersion: input.payloads.map((payload) => payload.version).filter(Boolean).sort().at(-1) || null,
  benchmarkVersion: CLOSE_COMBAT_BENCHMARK_VERSION,
})
const output = resolve(args.output || 'data/infinity-army/close-combat-benchmark.json')
await writeFile(output, `${JSON.stringify(artifact)}\n`, 'utf8')
console.log(JSON.stringify({ output, entries: artifact.entryCount, aliases: artifact.sourceAliasCount, defenders: artifact.defenders.length, fingerprint: artifact.fingerprint }))

function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) result[values[index].replace(/^--/, '')] = values[index + 1]; return result }
