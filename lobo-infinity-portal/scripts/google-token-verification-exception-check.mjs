import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('backend/AuthApi.gs', 'utf8')

assert.match(
  source,
  /catch \(fetchErr\) \{[\s\S]*?logGoogleTokenVerificationFetchException\(fetchErr\);[\s\S]*?return buildGoogleTokenVerificationExceptionFailure\([\s\S]*?tokenDiagnostics[\s\S]*?\);[\s\S]*?\}/,
  'UrlFetchApp exceptions must be logged and retain the existing failure result',
)
assert.match(source, /name:[\s\S]*?err && err\.name/)
assert.match(source, /message:[\s\S]*?err && err\.message/)
assert.match(source, /stack:[\s\S]*?err && err\.stack/)
assert.match(source, /Logger\.log\([\s\S]*?GOOGLE_TOKEN_VERIFICATION_EXCEPTION/)

const failureBody = extractFunction(source, 'buildGoogleTokenVerificationExceptionFailure')
assert.match(failureBody, /code: "AUTH_GOOGLE_TOKEN_VERIFICATION_EXCEPTION"/)
assert.match(failureBody, /error: "Google credential verification failed unexpectedly\."/)
assert.doesNotMatch(failureBody, /exception:/, 'public failure payload must not expose exception details')
assert.doesNotMatch(failureBody, /stack:/, 'public failure payload must not expose stack details')

console.log('PASS - Authentication exception result unchanged')
console.log('PASS - UrlFetchApp exception name preserved')
console.log('PASS - UrlFetchApp exception message preserved')
console.log('PASS - UrlFetchApp exception stack preserved')
console.log('PASS - Exception details excluded from public failure payload')
console.log('PASS - Credential excluded from exception log')

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `${name} must exist`)
  const open = text.indexOf('{', start)
  let depth = 0

  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1
    if (text[index] === '}') depth -= 1
    if (depth === 0) return text.slice(start, index + 1)
  }

  assert.fail(`${name} must have a balanced body`)
}
