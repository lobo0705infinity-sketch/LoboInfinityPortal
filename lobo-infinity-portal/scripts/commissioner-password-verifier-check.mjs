import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync('backend/AuthApi.gs', 'utf8')
const fixturePassword = 'commissioner-verifier-fixture'
const oldFormatFixture = 'pbkdf2-sha256$20000$AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8$A5yeJFmTaZHuZ8UYq0Ch9MQMjT05PX_tLXwLVN2ywOE'
const sandbox = {
  Utilities: {
    base64DecodeWebSafe(value) {
      return Array.from(Buffer.from(value, 'base64url'), (byte) => byte > 127 ? byte - 256 : byte)
    },
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

assert.match(source, /const USER_PASSWORD_HASH_ITERATIONS = 20000;/)
assert.match(source, /const USER_PASSWORD_HASH_BYTES = 32;/)
assert.match(source, /computeUserPasswordHmacSha256\(value, hmacKey\)/)
assert.match(source, /function constantTimeByteArraysEqual\(left, right\)/)
assert.doesNotMatch(source, /USER_PASSWORD_HASH_ITERATIONS = (?!20000)/)

console.log(`commissioner password verifier checks passed (${correctPasswordMs.toFixed(1)} ms)`)
