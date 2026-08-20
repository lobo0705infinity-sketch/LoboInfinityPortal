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

async function invoke(upstreamPayload) {
  const previousFetch = globalThis.fetch
  const previousApiUrl = process.env.VITE_API_URL
  let forwardedBody = ''
  globalThis.fetch = async (_url, options) => {
    forwardedBody = String(options.body)
    return new Response(JSON.stringify(upstreamPayload), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    })
  }
  process.env.VITE_API_URL = 'https://example.test/apps-script'

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

console.log('commissioner login contract checks passed')
