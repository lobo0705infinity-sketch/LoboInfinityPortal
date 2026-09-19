export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  response.setHeader('cache-control', 'no-store')

  const apiUrl = String(process.env.VITE_API_URL || '').trim()
  const password = typeof request.body?.password === 'string'
    ? request.body.password
    : ''

  let upstreamUrl
  try {
    upstreamUrl = new URL(apiUrl)
    if (upstreamUrl.protocol !== 'https:') throw new TypeError('HTTPS is required.')
  } catch {
    response.status(500).json({ code: 'INVALID_UPSTREAM_URL', error: 'Commissioner login is unavailable.', success: false })
    return
  }

  const body = new URLSearchParams({ action: 'commissionerLogin', password })
  let upstream
  try {
    upstream = await fetch(upstreamUrl, { body, method: 'POST', redirect: 'follow' })
  } catch (error) {
    response.status(502).json({
      code: 'UPSTREAM_FETCH_FAILED',
      error: 'Commissioner login is unavailable.',
      errorName: typeof error?.name === 'string' ? error.name : 'Error',
      success: false,
    })
    return
  }

  if (!upstream.ok) {
    response.status(502).json({
      code: 'UPSTREAM_HTTP_ERROR',
      contentType: upstream.headers.get('content-type') || '',
      status: upstream.status,
      success: false,
    })
    return
  }

  let payload
  try {
    payload = await upstream.json()
  } catch {
    response.status(502).json({
      code: 'UPSTREAM_RESPONSE_NOT_JSON',
      contentType: upstream.headers.get('content-type') || '',
      status: upstream.status,
      success: false,
    })
    return
  }

  response.status(200).json(payload)
}
