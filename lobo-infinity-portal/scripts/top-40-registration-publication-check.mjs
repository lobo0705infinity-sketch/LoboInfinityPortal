import assert from 'node:assert/strict'
import { BlobNotFoundError } from '@vercel/blob'
import { PUBLIC_SNAPSHOT_FILES } from '../api/public-snapshot-publish.mjs'
import { publishTop40RegistrationSnapshot } from '../api/top-40-registration-publish.mjs'

const currentId = '20260907T230547Z'
const currentCutoff = '2026-09-07T23:05:59.069Z'
const nextDate = new Date('2026-09-08T22:30:00.000Z')
const oldFiles = Object.fromEntries(PUBLIC_SNAPSHOT_FILES.map((filename) => [filename, {
  schemaVersion: 1,
  snapshotId: currentId,
  sourceCutoff: currentCutoff,
  data: filename === 'top-40-registrations.json'
    ? { generatedAt: currentCutoff, players: [{ name: 'Alpha', position: 1 }] }
    : [{ preserved: filename }],
}]))
delete oldFiles['top-40-registrations.json']
oldFiles['snapshot.json'] = {
  schemaVersion: 1,
  snapshotId: currentId,
  sourceCutoff: currentCutoff,
  createdAt: currentCutoff,
  status: 'validated',
  published: false,
  livePointer: false,
  files: Object.fromEntries(PUBLIC_SNAPSHOT_FILES
    .filter((name) => !['snapshot.json', 'top-40-registrations.json'].includes(name))
    .map((name) => [name, name])),
}

const pointer = {
  schemaVersion: 1,
  snapshotId: currentId,
  sourceCutoff: currentCutoff,
  basePath: `public-snapshots/${currentId}/`,
}
const uploads = []
const reads = []
const result = await publishTop40RegistrationSnapshot({
  data: { players: [{ name: 'Alpha', position: 1 }, { name: 'Lobo', position: 2 }] },
}, {
  now: () => nextDate,
  headObject: async (pathname) => {
    if (pathname === 'public-snapshots/current.json') {
      return { pathname, url: 'https://blob.example/public-snapshots/current.json' }
    }
    throw new BlobNotFoundError()
  },
  fetchObject: async (url) => {
    const filename = new URL(url).pathname.split('/').at(-1)
    if (filename === 'current.json') return { ok: true, json: async () => pointer }
    reads.push(filename)
    assert.notEqual(filename, 'top-40-registrations.json')
    return { ok: true, json: async () => structuredClone(oldFiles[filename]) }
  },
  putObject: async (pathname, text, options) => {
    uploads.push({ pathname, text, options })
    return { pathname, url: `https://blob.example/${pathname}`, size: Buffer.byteLength(text) }
  },
})

assert.equal(result.snapshotId, '20260908T223000Z')
assert.equal(result.activated, true)
assert.deepEqual(reads.sort(), PUBLIC_SNAPSHOT_FILES.filter((name) => name !== 'top-40-registrations.json').sort())
assert.equal(uploads.length, PUBLIC_SNAPSHOT_FILES.length + 1)
assert.equal(uploads.at(-1).pathname, 'public-snapshots/current.json')
const published = Object.fromEntries(uploads.slice(0, -1).map((upload) => [upload.pathname.split('/').at(-1), JSON.parse(upload.text)]))
assert.deepEqual(published['top-40-registrations.json'].data.players, [
  { name: 'Alpha', position: 1 },
  { name: 'Lobo', position: 2 },
])
assert.deepEqual(published['players.json'].data, oldFiles['players.json'].data)
for (const filename of PUBLIC_SNAPSHOT_FILES.filter((name) => !['snapshot.json', 'top-40-registrations.json'].includes(name))) {
  assert.deepEqual(published[filename].data, oldFiles[filename].data)
}
assert.equal(published['snapshot.json'].files.top40Registrations, 'top-40-registrations.json')
assert.deepEqual(Object.keys(published['top-40-registrations.json'].data.players[1]).sort(), ['name', 'position'])

for (const data of [
  { players: [{ name: 'Lobo', position: 1, email: 'private@example.com' }] },
  { players: [{ name: 'Lobo', position: 2 }] },
  { players: [{ name: 'Lobo', position: 1 }, { name: 'lobo', position: 2 }] },
]) {
  await assert.rejects(() => publishTop40RegistrationSnapshot({ data }), /unsupported fields|position|Duplicate/)
}

console.log('Dedicated Top 40 registration publication checks passed')
