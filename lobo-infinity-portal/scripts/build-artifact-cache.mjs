import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const defaultRoot = resolve('node_modules/.cache/lobo-generated-v1')

// Cache data is disposable. Missing or corrupt entries rebuild normally; failed
// generators are never saved. Content checks prevent restoring partial writes.
export async function cachedBytes(name, key, produce, cacheRoot = defaultRoot) {
  if (!/^[a-z0-9-]+$/.test(name) || !/^[a-f0-9]{64}$/.test(key)) throw Error('Invalid build cache key')
  const dir = resolve(cacheRoot, name), path = resolve(dir, key + '.bin')
  try {
    const [bytes, checksum] = await Promise.all([readFile(path), readFile(path + '.sha256', 'utf8')])
    if (digest(bytes) === checksum.trim()) return { bytes, cached: true }
  } catch { /* A cold or incomplete cache is a normal miss. */ }
  const bytes = Buffer.from(await produce())
  try {
    await mkdir(dir, { recursive: true })
    const temporary = path + '.' + process.pid + '.tmp'
    await writeFile(temporary, bytes)
    await rename(temporary, path)
    await writeFile(path + '.sha256', digest(bytes))
  } catch { console.warn(`Build cache unavailable for ${name}; generated output is still fresh.`) }
  return { bytes, cached: false }
}

async function sourceInputs(inputs) {
  const files = new Set()
  async function visit(path) {
    path = resolve(path)
    if (files.has(path)) return
    files.add(path)
    const source = await readFile(path)
    if (!/\.[cm]?[jt]s$/.test(path)) return
    for (const match of source.toString().matchAll(/\b(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      await visit(resolve(dirname(path), match[1]))
    }
  }
  for (const input of inputs) {
    if (input.endsWith('*')) {
      const prefix = input.slice(0, -1), dir = dirname(prefix), name = prefix.slice(dir.length + 1)
      for (const entry of (await readdir(dir)).filter(entry => entry.startsWith(name)).sort()) await visit(resolve(dir, entry))
    } else await visit(input)
  }
  return [...files].sort()
}

export async function runCachedBuild({ name, inputs, outputs, build, cacheRoot = defaultRoot }) {
  const hash = createHash('sha256').update(process.versions.node)
  const files = await sourceInputs([...inputs, fileURLToPath(import.meta.url), 'package-lock.json'])
  for (const file of files) hash.update(relative(process.cwd(), file)).update('\0').update(await readFile(file)).update('\0')
  hash.update(JSON.stringify(outputs))
  const result = await cachedBytes(name, hash.digest('hex'), async () => {
    await build()
    return JSON.stringify(await Promise.all(outputs.map(async path => ({ path, data: (await readFile(path)).toString('base64') }))))
  }, cacheRoot)
  if (result.cached) {
    const entries = JSON.parse(result.bytes.toString())
    if (JSON.stringify(entries.map(entry => entry.path)) !== JSON.stringify(outputs)) throw Error(`Invalid cached output manifest for ${name}`)
    for (const entry of entries) {
      const bytes = Buffer.from(entry.data, 'base64')
      let unchanged = false
      try { unchanged = digest(await readFile(entry.path)) === digest(bytes) } catch { /* Restore a missing output. */ }
      if (!unchanged) { await mkdir(dirname(entry.path), { recursive: true }); await writeFile(entry.path, bytes) }
    }
    console.log(`Restored ${name} from unchanged build inputs.`)
  }
  return result.cached
}
