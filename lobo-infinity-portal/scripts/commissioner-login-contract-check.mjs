import assert from 'node:assert/strict'
import handler from '../api/commissioner-login.mjs'

const successfulPayload = {
  authenticated: true,
  code: 'AUTH_OK',
  expiresAt: '2026-08-26T00:00:00.000Z',
  permissions: { manageSettings: true },
  sessionToken: 'test-session-token',
  stage: 'sessionValidation',
  success: true,
  user: { displayName: 'Commissioner', enabled: true, role: 'Commissioner' },
}

async function invoke(upstreamPayload, options = {}) {
  const previousFetch = globalThis.fetch
  const previousApiUrl = process.env.VITE_API_URL
  let forwardedBody = ''
  globalThis.fetch = async (_url, fetchOptions) => {
    if (options.fetchError) throw options.fetchError
    forwardedBody = String(fetchOptions.body)
    if (options.response) return options.response
    return new Response(JSON.stringify(upstreamPayload), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    })
  }
  process.env.VITE_API_URL = options.apiUrl ?? 'https://example.test/apps-script'

  const result = { body: null, status: 0 }
  const response = {
    json(value) { result.body = value; return this },
    setHeader() {},
    status(value) { result.status = value; return this },
  }

  try {
    await handler({ body: { password: 'fixture-password' }, method: 'POST' }, response)
  } finally {
    globalThis.fetch = previousFetch
    if (previousApiUrl === undefined) delete process.env.VITE_API_URL
    else process.env.VITE_API_URL = previousApiUrl
  }

  return { ...result, forwardedBody }
}

const success = await invoke(successfulPayload)
assert.equal(success.status, 200)
assert.deepEqual(success.body, successfulPayload)
assert.equal(new URLSearchParams(success.forwardedBody).get('action'), 'commissionerLogin')
assert.equal(new URLSearchParams(success.forwardedBody).get('password'), 'fixture-password')

const invalid = await invoke({
  authenticated: false,
  code: 'AUTH_INVALID_CREDENTIALS',
  error: 'Invalid Commissioner password.',
  success: false,
})
assert.equal(invalid.status, 200)
assert.equal(invalid.body.code, 'AUTH_INVALID_CREDENTIALS')
assert.equal(invalid.body.error, 'Invalid Commissioner password.')

const invalidUrl = await invoke(null, { apiUrl: 'not a URL' })
assert.equal(invalidUrl.status, 500)
assert.equal(invalidUrl.body.code, 'INVALID_UPSTREAM_URL')

const fetchFailure = await invoke(null, { fetchError: new TypeError('safe fixture failure') })
assert.equal(fetchFailure.status, 502)
assert.equal(fetchFailure.body.code, 'UPSTREAM_FETCH_FAILED')
assert.equal(fetchFailure.body.errorName, 'TypeError')

const httpFailure = await invoke(null, {
  response: new Response('not exposed', { headers: { 'content-type': 'text/plain' }, status: 403 }),
})
assert.equal(httpFailure.status, 502)
assert.equal(httpFailure.body.code, 'UPSTREAM_HTTP_ERROR')
assert.equal(httpFailure.body.status, 403)

const parseFailure = await invoke(null, {
  response: new Response('<html>not exposed</html>', { headers: { 'content-type': 'text/html' }, status: 200 }),
})
assert.equal(parseFailure.status, 502)
assert.equal(parseFailure.body.code, 'UPSTREAM_RESPONSE_NOT_JSON')
assert.equal(parseFailure.body.contentType, 'text/html')
assert.doesNotMatch(JSON.stringify(parseFailure.body), /fixture-password|not exposed/)

console.log('commissioner login contract checks passed')
