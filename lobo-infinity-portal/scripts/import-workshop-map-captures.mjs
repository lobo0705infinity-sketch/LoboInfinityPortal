import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../', import.meta.url))
const catalogPath = resolve(root, 'shared/lobo-workshop-current.json')
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const source = process.argv[2]
if (!source) throw new Error('Usage: node scripts/import-workshop-map-captures.mjs /path/to/captures')
const jobs = []
const errors = []
for (const map of catalog.maps) {
  for (const view of ['overhead', 'angled']) {
    const file = ['jpg', 'jpeg', 'png', 'webp'].map(ext => resolve(source, `${map.slug}-${view}.${ext}`)).find(existsSync)
    if (!file) { errors.push(`${map.slug}-${view}: missing`); continue }
    const { width = 0, height = 0 } = await sharp(file).metadata()
    if (width < 1280 || height < 720) { errors.push(`${map.slug}-${view}: ${width}×${height}, needs at least 1280×720`); continue }
    jobs.push({ map, view, file })
  }
}
// Validate the whole batch before changing any catalogue entry.
if (errors.length) throw new Error(`Capture batch incomplete:\n${errors.join('\n')}`)
const captureVersion = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
for (const { map, view, file } of jobs) {
  const url = `/assets/maps/captures-${captureVersion}/${map.slug}-${view}.webp`
  const destination = resolve(root, `public${url}`)
  mkdirSync(dirname(destination), { recursive: true })
  await sharp(file).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 88 }).toFile(destination)
  map[view] = url
  map.previewKind = 'tts'
}
catalog.captureDate = new Date().toISOString().slice(0, 10)
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Imported ${jobs.length} fresh TTS screenshots for ${catalog.maps.length} setups. Review their framing before publication.`)
