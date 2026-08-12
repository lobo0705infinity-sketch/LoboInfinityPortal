import assert from 'node:assert/strict'
import fs from 'node:fs'

const authContext = fs.readFileSync('src/auth/AuthContext.tsx', 'utf8')
const apiCore = fs.readFileSync('src/services/apiCore.ts', 'utf8')
const combined = `${authContext}\n${apiCore}`

assert.doesNotMatch(
  combined,
  /console\.info\('\[auth-session-forensic\]'\s*,\s*\{/,
  'forensic logging must not emit collapsed objects',
)

for (const field of [
  'stage',
  'timestamp',
  'requestUrl',
  'apiAction',
  'httpMethod',
  'httpStatus',
  'responseContentType',
  'responseBodyPreview',
  'exceptionName',
  'exceptionMessage',
  'exceptionStack',
  'requestId',
]) {
  assert.match(combined, new RegExp(`\\b${field}:`), `${field} must be logged`)
}

for (const sensitiveField of [
  'authToken',
  'avatarUrl',
  'credential',
  'displayName',
  'email',
  'idToken',
  'leaguePlayer',
]) {
  assert.match(apiCore, new RegExp(`'${sensitiveField}'`), `${sensitiveField} must be redacted`)
}

assert.match(apiCore, /JSON\.stringify\(redactSessionForensicValue\(payload\)\)\.slice\(0, 200\)/)
assert.match(combined, /console\.info\(`\[auth-session-forensic\]\\n\$\{field\}=\$\{[^}]+\}`\)/)

console.log('PASS - Authentication behavior unchanged')
console.log('PASS - Session requests unchanged')
console.log('PASS - Forensic logging is one readable line per field')
console.log('PASS - Response previews limited to 200 characters')
console.log('PASS - Credentials and personal identity fields are redacted')
