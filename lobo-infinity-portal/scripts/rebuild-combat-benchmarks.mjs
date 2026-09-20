#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { readArtifact, writeArtifact } from './benchmark-artifacts.mjs'

// One immutable official capture feeds every dependent catalog. No network or publishing here.
const input = resolve(process.argv[2] || 'data/infinity-army/benchmark-official-source.json.gz.b64')
const capture = await readArtifact(input)
const source = resolve('data/infinity-army/benchmark-official-source.json.gz.b64')
await writeArtifact(source, capture, { plain: false, parts: false })
const temporary = await mkdtemp(join(tmpdir(), 'infinity-benchmark-'))
const capturePath = join(temporary, 'official-capture.json')
await writeFile(capturePath, JSON.stringify(capture))
function run(script, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' })
  if (result.status !== 0) throw Error(`${script} failed (${result.status}): ${result.error || ''}`)
}
run('scripts/benchmark-audit-regression-check.mjs')
run('scripts/build-profile-audit-catalog.mjs', capturePath)
run('scripts/build-mobility-catalog.mjs', capturePath, 'data/infinity-army/mobility-provisional-catalog.json.gz.b64')
run('scripts/build-mobility-index.mjs')
run('scripts/build-gunfighter-catalog.mjs', '--official-input', source)
run('scripts/build-official-aro-catalog.mjs', '--official-input', source)
run('scripts/build-close-combat-benchmark.mjs', '--input', source)
run('scripts/build-mobile-gunfighter.mjs')
run('scripts/benchmark-catalog-integrity-check.mjs')
console.log('All dependent benchmark catalogs rebuilt from one official capture.')
