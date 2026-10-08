import { addBenchmarkRanks } from './benchmark-ranking.mjs'
import { gunzipSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'

const archive = await readFile('data/infinity-army/close-combat-benchmark.json.gz.b64', 'utf8')
const source = JSON.parse(gunzipSync(Buffer.from(archive, 'base64')).toString('utf8'))
const ratings = {}

for (const entry of source.entries || []) {
  const value = {
    grade: entry.grade,
    percentile: entry.percentile,
    rating: entry.rating,
    weapon: entry.weapons?.[0]?.name || 'Close Combat',
  }
  if (String(entry.key || '').split(':').length === 5) ratings[entry.key] = value
  for (const alias of entry.aliases || []) {
    const key = alias.key || (alias.sectorialId != null ? `${Number(alias.sectorialId)}:${entry.key}` : '')
    if (key) ratings[key] = value
  }
}

const ranked = addBenchmarkRanks(Object.fromEntries(Object.entries(ratings).map(([key,value])=>[key,{normal:value}])))
const rankedRatings = Object.fromEntries(Object.entries(ranked).map(([key,states])=>[key,states.normal]))

await writeFile('src/data/portal-close-combat-ratings.json', `${JSON.stringify({ schemaVersion: source.schemaVersion, ratings: rankedRatings })}\n`)
console.log(`Wrote ${Object.keys(ratings).length} portal close-combat benchmark aliases.`)
