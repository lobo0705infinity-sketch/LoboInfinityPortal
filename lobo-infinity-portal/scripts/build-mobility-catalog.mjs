import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { buildMobilityProfiles, MOBILITY_VERSION } from '../bot/mobility-rating.mjs'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw Error('Usage: node scripts/build-mobility-catalog.mjs <official-capture.json|--api> <output.json|output.json.gz.b64>')
const capture = input === '--api' ? await captureOfficialData() : JSON.parse(await readFile(input, 'utf8'))
if (capture.failures?.length) throw Error('Refusing an incomplete official capture')
const entries = buildMobilityProfiles(capture)
if (!entries.length) throw Error('Official capture contains no profiles')
const artifact = {
  schemaVersion: MOBILITY_VERSION,
  generatedAt: new Date().toISOString(),
  source: 'Official Infinity Army API',
  officialVersions: [...new Set(capture.payloads.map(x => x.version))],
  payloadCount: capture.payloads.length,
  entryCount: entries.length,
  missingMovement: entries.filter(x => x.mobility.status === 'missing-movement').length,
  noMovementAttribute: entries.filter(x => x.mobility.status === 'no-movement-attribute').length,
  limitations: ['Provisional weights; not a terrain simulation.', 'Terrain Total and motorcycle restrictions retained as capabilities, not scored.', 'No combat-rating blend or production integration.'],
  entries,
}
await mkdir(dirname(resolve(output)), { recursive: true })
const serialized = JSON.stringify(artifact) + '\n'
await writeFile(output, output.endsWith('.gz.b64') ? gzipSync(serialized).toString('base64') + '\n' : serialized)
console.log(JSON.stringify({ output, entries: artifact.entryCount, missingMovement: artifact.missingMovement }))

async function captureOfficialData() {
  const get = async url => {
    const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', origin: 'https://infinityuniverse.com', referer: 'https://infinityuniverse.com/army/' }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw Error(`Official Army request failed: ${response.status} ${url}`)
    return response.json()
  }
  const metadata = await get('https://api.corvusbelli.com/army/infinity/en/metadata')
  const ids = [...new Set(metadata.factions.map(x => x.id))].sort((a, b) => a - b)
  const payloads = []
  for (let offset = 0; offset < ids.length; offset += 8) {
    const batch = await Promise.all(ids.slice(offset, offset + 8).map(async sectorialId => {
      const url = `https://api.corvusbelli.com/army/units/en/${sectorialId}`
      const payload = await get(url)
      if (!Array.isArray(payload.units)) throw Error(`Missing units for ${sectorialId}`)
      return { ...payload, sectorialId, url }
    }))
    payloads.push(...batch)
  }
  return { metadata, payloads }
}
