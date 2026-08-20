export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    response.status(405).json({ error: 'Method not allowed.', success: false })
    return
  }

  response.setHeader('cache-control', 'no-store')

  try {
    const apiUrl = String(process.env.VITE_API_URL || '').trim()
    const password = typeof request.body?.password === 'string'
      ? request.body.password
      : ''

    if (!apiUrl) {
      response.status(500).json({ error: 'Commissioner login is unavailable.', success: false })
      return
    }

    const body = new URLSearchParams({ action: 'commissionerLogin', password })
    const upstream = await fetch(apiUrl, { body, method: 'POST', redirect: 'follow' })
    const payload = await upstream.json()

    if (!upstream.ok) {
      response.status(502).json({ error: 'Commissioner login is unavailable.', success: false })
      return
    }

    response.status(200).json(payload)
  } catch {
    response.status(502).json({ error: 'Commissioner login is unavailable.', success: false })
  }
}
