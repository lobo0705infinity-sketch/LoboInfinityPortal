import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync('backend/AuthApi.gs', 'utf8')
const fixturePassword = 'commissioner-verifier-fixture'
const oldFormatFixture = 'pbkdf2-sha256$20000$AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8$A5yeJFmTaZHuZ8UYq0Ch9MQMjT05PX_tLXwLVN2ywOE'
const properties = new Map([['commissioner:passwordHash', oldFormatFixture]])
const sandbox = {
  PropertiesService: {
    getScriptProperties() {
      return {
        deleteProperty(key) { properties.delete(key) },
        getProperty(key) { return properties.get(key) ?? null },
        setProperty(key, value) { properties.set(key, value) },
      }
    },
  },
  USER_ROLES: { COMMISSIONER: 'Commissioner', GUEST: 'Guest' },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    base64DecodeWebSafe(value) {
      return Array.from(Buffer.from(value, 'base64url'), (byte) => byte > 127 ? byte - 256 : byte)
    },
    base64EncodeWebSafe(value) {
      return Buffer.from(Array.from(value, (byte) => byte & 255)).toString('base64url')
    },
    computeDigest(_algorithm, value) {
      return Array.from(createHash('sha256').update(
        typeof value === 'string' ? value : Buffer.from(Array.from(value, (byte) => byte & 255)),
      ).digest(), (byte) => byte > 127 ? byte - 256 : byte)
    },
    getUuid() { return '00000000-0000-4000-8000-000000000001' },
    newBlob(value) {
      return {
        getBytes() {
          return Array.from(Buffer.from(String(value), 'utf8'), (byte) => byte > 127 ? byte - 256 : byte)
        },
      }
    },
  },
}

vm.createContext(sandbox)
vm.runInContext(source, sandbox)

const startedAt = performance.now()
assert.equal(sandbox.verifyUserPasswordHash(fixturePassword, oldFormatFixture), true)
const correctPasswordMs = performance.now() - startedAt
assert.equal(sandbox.verifyUserPasswordHash('incorrect-fixture-password', oldFormatFixture), false)

const session = sandbox.createCommissionerSession(fixturePassword)
assert.equal(session.user.role, 'Commissioner')
assert.ok(session.token)
assert.equal(sandbox.validateNativeSession(session.token).user.role, 'Commissioner')
assert.equal(sandbox.destroyNativeSession(session.token), true)
assert.equal(sandbox.validateNativeSession(session.token), null)

assert.match(source, /const USER_PASSWORD_HASH_ITERATIONS = 20000;/)
assert.match(source, /const USER_PASSWORD_HASH_BYTES = 32;/)
assert.match(source, /computeUserPasswordHmacSha256\(value, hmacKey\)/)
assert.match(source, /function constantTimeByteArraysEqual\(left, right\)/)
assert.doesNotMatch(source, /USER_PASSWORD_HASH_ITERATIONS = (?!20000)/)

console.log(`commissioner password verifier checks passed (${correctPasswordMs.toFixed(1)} ms)`)
