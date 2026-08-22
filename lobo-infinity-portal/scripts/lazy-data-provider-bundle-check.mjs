import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const manifest = JSON.parse(
  readFileSync('dist/.vite/manifest.json', 'utf8'),
)
const failures = []

for (const route of [
  'index.html',
  'src/pages/Dashboard.tsx',
  'src/pages/Players.tsx',
]) {
  const files = [...staticClosure(route)].map((key) => manifest[key]?.file ?? '')
  const firebaseFiles = files.filter((file) =>
    /firebase|Firestore|DualCompare/i.test(file),
  )

  assert(
    firebaseFiles.length === 0,
    `${route} must not statically load Firebase tooling: ${firebaseFiles.join(', ')}`,
  )
}

const lazyFiles = Object.values(manifest)
  .map((entry) => entry.file ?? '')
  .filter((file) => /firebase|Firestore|DualCompare/i.test(file))

for (const expected of [
  /firebase-auth/i,
  /firebase-firestore/i,
  /FirestoreBootstrap/i,
  /FirestoreMigrationService/i,
  /FirestoreMigrationVerification/i,
  /DualCompareProvider/i,
]) {
  assert(
    lazyFiles.some((file) => expected.test(file)),
    `Explicit on-demand capability is missing: ${expected}.`,
  )
}

const dashboard = measureStaticClosure('src/pages/Dashboard.tsx')
const entry = measureStaticClosure('index.html')

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('lazy data-provider bundle checks passed')
console.log(JSON.stringify({ dashboard, entry, lazyFiles }, null, 2))

function staticClosure(key, seen = new Set()) {
  if (seen.has(key) || !manifest[key]) return seen
  seen.add(key)
  for (const dependency of manifest[key].imports ?? []) {
    staticClosure(dependency, seen)
  }
  return seen
}

function measureStaticClosure(key) {
  const files = [...staticClosure(key)]
    .map((manifestKey) => manifest[manifestKey]?.file)
    .filter(Boolean)
  let gzipBytes = 0
  let rawBytes = 0

  for (const file of files) {
    const content = readFileSync(`dist/${file}`)
    rawBytes += content.length
    gzipBytes += gzipSync(content).length
  }

  return { files, gzipBytes, rawBytes }
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}
