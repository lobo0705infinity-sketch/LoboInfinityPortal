import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { BlobNotFoundError } from '@vercel/blob'
import { PUBLIC_SNAPSHOT_FILES, SNAPSHOT_CHUNK_BYTES, publishPublicSnapshot } from '../api/public-snapshot-publish.mjs'

const snapshotId = '20261005T160801Z'
const sourceCutoff = '2026-10-05T16:08:16.208Z'
const objects = new Map()
const dependencies = {
  compareCurrent: false,
  headObject: async pathname => {
    if (!objects.has(pathname)) throw new BlobNotFoundError()
    return { url: `https://example.test/${pathname}`, size: objects.get(pathname).length }
  },
  putObject: async (pathname, content, options) => {
    if (objects.has(pathname) && !options.allowOverwrite) throw new Error('Unexpected overwrite')
    objects.set(pathname, Buffer.from(content))
    return { url: `https://example.test/${pathname}` }
  },
  fetchObject: async url => new Response(objects.get(new URL(url).pathname.slice(1))),
}
// Exceeds the old aggregate cap; the largest single dataset also exceeds it.
const files = PUBLIC_SNAPSHOT_FILES.map(filename => {
  const bytes = Buffer.from(JSON.stringify({ snapshotId, sourceCutoff,
    data: filename === 'army-intelligence-detail.json' ? 'é🚀'.repeat(850000) : [] }))
  return { bytes, filename, byteCount: bytes.length,
    contentHash: createHash('sha256').update(bytes).digest('hex'),
    chunks: Math.ceil(bytes.length / SNAPSHOT_CHUNK_BYTES) }
})
const manifest = files.map(({ bytes, ...artifact }) => artifact)
for (const { bytes, ...artifact } of files) {
  for (let index = 0; index < artifact.chunks; index++) {
    const body = { action: 'chunk', snapshotId, sourceCutoff, artifact, index,
      content: bytes.subarray(index * SNAPSHOT_CHUNK_BYTES, (index + 1) * SNAPSHOT_CHUNK_BYTES).toString('base64') }
    assert.ok(Buffer.byteLength(JSON.stringify(body)) < 1000000)
    await publishPublicSnapshot(body, dependencies)
    await publishPublicSnapshot(body, dependencies) // resumable immutable retries
  }
}
const final = { action: 'finalize', snapshotId, sourceCutoff, manifest, activate: true }
const chunkPath = [...objects.keys()].find(path => path.includes('/army-intelligence-detail.json/'))
const saved = objects.get(chunkPath)
objects.delete(chunkPath)
await assert.rejects(() => publishPublicSnapshot(final, dependencies), BlobNotFoundError)
assert.equal(objects.has('public-snapshots/current.json'), false)
objects.set(chunkPath, Buffer.from('corrupt'))
await assert.rejects(() => publishPublicSnapshot(final, dependencies), /verification failed/)
assert.equal(objects.has('public-snapshots/current.json'), false)
objects.set(chunkPath, saved)
const result = await publishPublicSnapshot(final, dependencies)
assert.equal(result.activated, true)
assert.equal(result.uploaded, PUBLIC_SNAPSHOT_FILES.length)
for (const file of files) assert.deepEqual(objects.get(`public-snapshots/${snapshotId}/${file.filename}`), file.bytes)
const pointer = objects.get('public-snapshots/current.json')
await assert.rejects(() => publishPublicSnapshot({ ...final, manifest: manifest.slice(1) }, dependencies), /complete snapshot manifest/)
assert.deepEqual(objects.get('public-snapshots/current.json'), pointer)
console.log('Snapshot chunk publication regression PASS: >5 MB, Unicode, retry, missing/corrupt chunks, atomic activation')
