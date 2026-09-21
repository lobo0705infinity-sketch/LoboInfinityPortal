#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'

const archive = await readFile('data/infinity-army/gunfighter-benchmark-catalog.json.gz.b64', 'utf8')
const source = JSON.parse(gunzipSync(Buffer.from(archive, 'base64')).toString('utf8'))
const ratings = Object.fromEntries(source.entries.map((entry) => [entry.key, Object.fromEntries((entry.result.states || []).map((state) => [state.id, {
  grade: state.grade,
  percentile: state.percentile,
  rating: state.rating,
  weaponsUsed: state.weaponsUsed || [],
}]))]))

await writeFile('src/data/portal-gunfighter-ratings.json', `${JSON.stringify({ benchmarkVersion: source.benchmarkVersion, fingerprint: source.fingerprint, ratings })}\n`)
console.log(`Built portal gunfighter ratings for ${Object.keys(ratings).length} exact profiles.`)
