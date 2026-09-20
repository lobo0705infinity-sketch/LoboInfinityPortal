import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { mobilityIndex, MOBILITY_INDEX_VERSION, MOBILITY_WEIGHTS } from '../bot/mobility-index.mjs'
import { validateMobilityEntries } from '../bot/mobility-catalog-validation.mjs'

const source = JSON.parse(gunzipSync(Buffer.from(await readFile('data/infinity-army/mobility-provisional-catalog.json.gz.b64', 'utf8'), 'base64')))
validateMobilityEntries(source.entries)
const records = [], signatures = new Map(), keys = {}
const rated = []
for (const entry of source.entries) {
  const rating = mobilityIndex(entry)
  const s = rating.scenarios
  const record = { status: rating.status, score: rating.score, mov: entry.mov, form: entry.name.split(' — ').length > 2 ? entry.name.split(' — ').at(-1) : null, travel: s?.openBestTravel ?? null, jump: s?.horizontalJumpAndShoot ?? null, climb: s?.climbAndShoot ?? null, dodge: s?.normalDodge.expectedDistance ?? null }
  const signature = JSON.stringify(record)
  if (!signatures.has(signature)) { signatures.set(signature, records.length); records.push(record) }
  keys[entry.id] = signatures.get(signature)
  rated.push({ entry, rating })
}
const fingerprint = createHash('sha256').update(JSON.stringify({ version: MOBILITY_INDEX_VERSION, weights: MOBILITY_WEIGHTS, keys, records })).digest('hex')
const catalog = { version: MOBILITY_INDEX_VERSION, fingerprint, sourceFingerprint: source.captureFingerprint, weights: MOBILITY_WEIGHTS, profiles: records, keys }
await mkdir('src/data', { recursive: true })
await writeFile('src/data/mobility-index.json', JSON.stringify(catalog) + '\n')
const unique = [...new Map(rated.map(row => [JSON.stringify({ unit: row.entry.unitId, form: row.entry.profileId, mov: row.entry.mov, components: row.rating.components }), row])).values()]
const sorted = rows => rows.filter(x => x.rating.score !== null).sort((a,b) => b.rating.score - a.rating.score || a.entry.name.localeCompare(b.entry.name))
const sensitivity = []
for (const key of Object.keys(MOBILITY_WEIGHTS)) for (const multiplier of [0.8, 1.2]) {
  const weights = { ...MOBILITY_WEIGHTS, [key]: MOBILITY_WEIGHTS[key] * multiplier }
  const rows = sorted(unique.map(({ entry }) => ({ entry, rating: mobilityIndex(entry, weights) })))
  sensitivity.push({ key, multiplier, top10: rows.slice(0,10).map(x => ({ id: x.entry.id, name: x.entry.name, score: x.rating.score })) })
}
const summary = { version: MOBILITY_INDEX_VERSION, fingerprint, weights: MOBILITY_WEIGHTS, coverage: { entries: rated.length, rated: rated.filter(x => x.rating.status === 'rated').length, noMovement: rated.filter(x => x.rating.status === 'no-movement').length, unresolved: rated.filter(x => !['rated','no-movement'].includes(x.rating.status)).map(x => ({ id:x.entry.id, name:x.entry.name, status:x.rating.status })) }, top30: sorted(unique).slice(0,30).map(x => ({ id:x.entry.id, name:x.entry.name, mov:x.entry.mov, score:x.rating.score, components:x.rating.components })), sensitivity }
await writeFile('data/infinity-army/mobility-index-validation.json', JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify({ fingerprint, records: records.length, entries: rated.length, rated: summary.coverage.rated, unresolved: summary.coverage.unresolved.length, sensitivityRuns: sensitivity.length, top: summary.top30.slice(0,10).map(x=>({name:x.name,score:x.score})) }))
