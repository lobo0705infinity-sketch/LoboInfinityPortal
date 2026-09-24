import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'

// The bundled official Army payload marks named characters with category 10.
// This is more reliable than trying to guess from capitalization or unit cost.
const encoded = await readFile('data/infinity-army/benchmark-official-source.json.gz.b64', 'utf8')
const source = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'))
const characters = new Map()
for (const payload of source.payloads || []) {
  for (const unit of payload.units || []) {
    if (!unit.filters?.categories?.includes(10)) continue
    const name = String(unit.isc || unit.name || '').split(',')[0].trim()
    if (Number.isInteger(unit.id) && name) characters.set(unit.id, name)
  }
}
const ordered = Object.fromEntries([...characters.entries()].sort(([left], [right]) => left - right))
await writeFile('src/data/storyCharacters.json', `${JSON.stringify(ordered, null, 2)}\n`)
console.log(`Recorded ${characters.size} officially classified named characters.`)
