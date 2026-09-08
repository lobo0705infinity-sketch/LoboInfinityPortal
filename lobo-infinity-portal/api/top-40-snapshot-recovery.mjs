export const maxDuration = 300

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ success: false })
  const apiUrl = String(process.env.VITE_API_URL || '').trim()
  const credential = String(process.env.ARMY_INTELLIGENCE_WORKER_TOKEN || '').trim()
  if (!apiUrl || !credential) return response.status(500).json({ error: 'Recovery environment unavailable.', success: false })
  const body = new URLSearchParams({
    action: 'refreshArmyIntelligence', workerToken: credential, snapshots: '[]', publishPublicSnapshot: 'true',
  })
  const upstream = await fetch(apiUrl, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body, redirect: 'follow',
  })
  const text = await upstream.text()
  console.log('TOP40_RECOVERY_RESULT', text)
  response.status(upstream.ok ? 200 : 502).json({ success: upstream.ok, upstreamStatus: upstream.status, payload: JSON.parse(text) })
}
