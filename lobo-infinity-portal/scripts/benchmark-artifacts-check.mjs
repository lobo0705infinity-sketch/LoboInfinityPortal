import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeArtifact, readArtifact } from './benchmark-artifacts.mjs'

const dir = await mkdtemp(join(tmpdir(), 'benchmark-archive-test-'))
const path = join(dir, 'fixture.json')
await writeFile(path + '.gz.b64.part-02', 'obsolete fixture chunk')
await writeFile(path + '.gz.b64.part-note', 'not an archive chunk')
await writeFile(join(dir, 'other.json.gz.b64.part-02'), 'unrelated fixture')
const value = { schemaVersion: 'fixture', entries: [1, 2, 3] }
await writeArtifact(path, value)
assert.deepEqual(await readArtifact(path), value)
assert.deepEqual(await readArtifact(path + '.gz.b64'), value)
assert.equal(await readFile(path + '.gz.b64.part-01', 'utf8'), await readFile(path + '.gz.b64', 'utf8'))
const names = await readdir(dir)
assert.ok(!names.includes('fixture.json.gz.b64.part-02'))
assert.ok(names.includes('fixture.json.gz.b64.part-note'))
assert.ok(names.includes('other.json.gz.b64.part-02'))
await writeArtifact(path, value, { parts: false })
assert.ok(!(await readdir(dir)).includes('fixture.json.gz.b64.part-01'))
console.log('PASS: archive rebuild parity and exact-target stale-part cleanup preserve unrelated files.')
