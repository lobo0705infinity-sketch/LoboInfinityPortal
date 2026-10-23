#!/usr/bin/env node

import { addBenchmarkRanks } from './benchmark-ranking.mjs'
import { readFile, writeFile } from 'node:fs/promises'

import { runCachedBuild } from './build-artifact-cache.mjs'

await runCachedBuild({
  name: "portal-gunfighter",
  inputs: ["scripts/build-portal-gunfighter-ratings.mjs", "data/infinity-army/gunfighter-benchmark-catalog.json"],
  outputs: ["src/data/portal-gunfighter-ratings.json"],
  build: async () => {
    const source = JSON.parse(await readFile('data/infinity-army/gunfighter-benchmark-catalog.json', 'utf8'))
    const ratings = Object.fromEntries(source.entries.map((entry) => [entry.key, Object.fromEntries((entry.result.states || []).map((state) => [state.id, {
      grade: state.grade,
      percentile: state.percentile,
      rating: state.rating,
      weaponsUsed: state.weaponsUsed || [],
    }]))]))

    await writeFile('src/data/portal-gunfighter-ratings.json', `${JSON.stringify({ benchmarkVersion: source.benchmarkVersion, fingerprint: source.fingerprint, ratings: addBenchmarkRanks(ratings) })}\n`)
    console.log(`Built portal gunfighter ratings for ${Object.keys(ratings).length} exact profiles.`)
  },
})
