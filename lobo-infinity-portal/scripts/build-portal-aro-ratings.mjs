#!/usr/bin/env node

import { writeFile } from 'node:fs/promises'
import { readArtifact } from './benchmark-artifacts.mjs'

const source = await readArtifact('data/infinity-army/aro-benchmark-catalog.json.gz.b64')
const ratings = Object.fromEntries(source.entries.map((entry) => [entry.key, Object.fromEntries((entry.result.states || []).map((state) => [state.id, {
  grade: state.grade,
  percentile: state.percentile,
  rating: state.rating,
  weaponsUsed: state.weaponsUsed || [],
}]))]))

await writeFile('src/data/portal-aro-ratings.json', `${JSON.stringify({ benchmarkVersion: source.benchmarkVersion, fingerprint: source.fingerprint, ratings })}\n`)
console.log(`Built portal ARO ratings for ${Object.keys(ratings).length} exact profiles.`)
