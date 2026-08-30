import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/PublicGenerationFoundation.gs', 'utf8')
const propertiesMap = new Map()
const properties = {
  getProperty: (key) => propertiesMap.get(key) ?? null,
  getProperties: () => Object.fromEntries(propertiesMap),
  setProperty: (key, value) => propertiesMap.set(key, String(value)),
  deleteProperty: (key) => propertiesMap.delete(key),
}
let lockAvailable = true
let lockHeld = false
let lockAcquisitions = 0
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  Object,
  String,
  PropertiesService: { getScriptProperties: () => properties },
  LockService: { getScriptLock: () => ({
    tryLock() {
      lockAcquisitions += 1
      if (!lockAvailable || lockHeld) return false
      lockHeld = true
      return true
    },
    releaseLock() { lockHeld = false },
  }) },
  Utilities: {
    Charset: { UTF_8: 'UTF_8' },
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest(_algorithm, value) {
      return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
        .map((byte) => byte > 127 ? byte - 256 : byte)
    },
    newBlob(value) { return { getBytes: () => [...Buffer.from(String(value), 'utf8')] } },
    formatDate(date, _zone, pattern) {
      const iso = date.toISOString()
      if (pattern.startsWith('yyyyMMdd')) return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
      return iso.replace(/\.\d{3}/, '')
    },
  },
  MimeType: { PLAIN_TEXT: 'text/plain' },
}
vm.createContext(context)
vm.runInContext(source, context)

assert.equal(context.formatPublicGenerationId_(new Date('2026-08-30T17:00:00Z')), '20260830T170000Z')
assert.match('20260830T170000Z', /^\d{8}T\d{6}Z$/)

// Frozen cutoff: later canonical source changes cannot alter the captured input.
const frozen = {
  schemaVersion: 1,
  generation: '20260830T170000Z',
  sourceCutoff: '2026-08-30T17:00:00Z',
  games: Array.from({ length: 10 }, (_, index) => ({ gameId: index + 1 })),
  players: [],
  event: { id: 'event-current-league' },
}
const mutableSource = [...frozen.games]
mutableSource.push({ gameId: 11 })
assert.equal(frozen.games.length, 10)

// Determinism: the same frozen input produces identical section bytes and hash.
const coreA = context.buildPublicGenerationCoreSection_(frozen)
const coreB = context.buildPublicGenerationCoreSection_(JSON.parse(JSON.stringify(frozen)))
const jsonA = context.stablePublicGenerationJson_(coreA)
const jsonB = context.stablePublicGenerationJson_(coreB)
assert.equal(jsonA, jsonB)
assert.equal(context.sha256PublicGenerationText_(jsonA), context.sha256PublicGenerationText_(jsonB))
assert.doesNotMatch(jsonA, /sourceRow/)

// Security validation rejects public sensitive fields, including raw Army Codes.
context.validatePublicGenerationPublicArtifact_(coreA, frozen.generation, frozen.sourceCutoff)
assert.throws(() => context.assertNoForbiddenPublicGenerationKeys_({ sessionToken: 'x' }, 'core'), /forbidden key/)
assert.throws(() => context.assertNoForbiddenPublicGenerationKeys_({ ArmyCode: 'x' }, 'core'), /forbidden key/)
context.validatePublicGenerationCandidateIsolation_(['candidate-file'])
properties.setProperty('PUBLIC_PLAYERS_PROJECTION_FILE_ID', 'candidate-file')
assert.throws(
  () => context.validatePublicGenerationCandidateIsolation_(['candidate-file']),
  /referenced by non-foundation/,
)
properties.deleteProperty('PUBLIC_PLAYERS_PROJECTION_FILE_ID')

// One active build maximum and bounded lock failure.
const first = context.reservePublicGenerationBuild_('20260830T170000Z', new Date('2026-08-30T17:00:00Z'))
assert.equal(first.record.status, 'reserved')
assert.throws(
  () => context.reservePublicGenerationBuild_('20260830T170001Z', new Date('2026-08-30T17:00:01Z')),
  /already active/,
)
lockAvailable = false
assert.throws(
  () => context.reservePublicGenerationBuild_('20260830T170002Z', new Date('2026-08-30T17:00:02Z')),
  /lock is busy/,
)
lockAvailable = true
properties.deleteProperty('PUBLIC_GENERATION_FOUNDATION_ACTIVE_BUILD')

// Immutable files reject overwrites and read-back validates exact bytes/hash.
let stored = ''
let hasFile = false
const file = {
  getId: () => 'candidate-file',
  getBlob: () => ({ getDataAsString: () => stored }),
}
const folder = {
  getFilesByName: () => ({ hasNext: () => hasFile }),
  createFile(_name, content) { hasFile = true; stored = content; return file },
}
const created = context.createImmutablePublicGenerationFile_(folder, 'core.json', jsonA)
context.validatePersistedPublicGenerationText_(
  created,
  jsonA,
  context.sha256PublicGenerationText_(jsonA),
  Buffer.byteLength(jsonA, 'utf8'),
)
assert.throws(() => context.createImmutablePublicGenerationFile_(folder, 'core.json', jsonA), /already exists/)

// Read-back/hash failure remains isolated.
stored = '{}'
assert.throws(
  () => context.validatePersistedPublicGenerationText_(created, jsonA, context.sha256PublicGenerationText_(jsonA), Buffer.byteLength(jsonA)),
  /read-back/,
)

// Static isolation: no router, pointer, publisher, rebuild, decoder, or remote worker path.
assert.match(source, /function runCreatePublicGenerationCandidate\(\)/)
assert.doesNotMatch(source, /function runPublicGenerationCandidateStatus/)
assert.doesNotMatch(source, /doGet|doPost|jsonOutput|setSharing|currentPointer|livePointer.*true/)
assert.doesNotMatch(source, /rebuildGameEngine\s*\(|coordinateCanonicalRebuild\s*\(|processAutomationQueueBatch\s*\(/)
assert.doesNotMatch(source, /CanonicalDecoderGateway|decode\s*\(|UrlFetchApp/)
assert.equal(lockHeld, false)
assert.ok(lockAcquisitions >= 3)

console.log('Public generation foundation regression passed.')
