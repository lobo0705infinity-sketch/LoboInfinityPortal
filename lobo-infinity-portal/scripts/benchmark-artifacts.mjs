import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'

export async function readArtifact(path) {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(path.endsWith('.gz.b64') ? gunzipSync(Buffer.from(raw, 'base64')).toString('utf8') : raw)
}

// All three representations must agree. Remove only obsolete numbered chunks of this artifact.
export async function writeArtifact(path, artifact, { plain = true, parts = true } = {}) {
  await mkdir(dirname(path), { recursive: true })
  const serialized = JSON.stringify(artifact) + '\n'
  const archive = path.endsWith('.gz.b64') ? path : path + '.gz.b64'
  if (plain && path !== archive) await writeFile(path, serialized)
  const encoded = gzipSync(serialized, { level: 9 }).toString('base64')
  await writeFile(archive, encoded)
  const expected = new Set()
  if (parts) for (let offset = 0, part = 1; offset < encoded.length; offset += 180_000, part++) {
    const name = basename(archive) + '.part-' + String(part).padStart(2, '0')
    expected.add(name)
    await writeFile(dirname(archive) + '/' + name, encoded.slice(offset, offset + 180_000))
  }
  const prefix = basename(archive) + '.part-'
  for (const name of await readdir(dirname(archive))) {
    if (name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length)) && !expected.has(name)) await unlink(dirname(archive) + '/' + name)
  }
}

export function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 2) result[values[index].replace(/^--/, '')] = values[index + 1]
  return result
}
