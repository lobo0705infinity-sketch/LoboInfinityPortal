import sharp from 'sharp'
import { readPublicDataset } from './_lib/public-snapshot.mjs'

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('allow', 'GET, HEAD')
    return response.status(405).end()
  }
  const id = String(request.query?.id || '')
  if (!/^[1-9]\d{0,8}$/.test(id)) return response.status(400).end('Invalid report ID')

  try {
    const games = await readPublicDataset('games')
    const game = games.find(item => String(item.id) === id)
    if (!game) return response.status(404).end('Report not found')
    const image = await createReportPreview(game)
    response.setHeader('content-type', 'image/png')
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300')
    response.status(200)
    if (request.method === 'HEAD') return response.end()
    return response.send(image)
  } catch (error) {
    console.error('Battle report preview unavailable:', error)
    return response.status(503).end('Preview temporarily unavailable')
  }
}

export async function createReportPreview(game) {
  const mission = escapeXml(displayText(game.mission, 37) || 'Battle Report')
  const left = escapeXml(displayText(game.player1Faction, 39) || 'Faction one')
  const right = escapeXml(displayText(game.player2Faction, 39) || 'Faction two')
  const score = escapeXml(displayText(game.tp, 20))
  const reportId = escapeXml(String(game.id))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#08111c"/><stop offset=".55" stop-color="#172a39"/><stop offset="1" stop-color="#080e16"/></linearGradient>
      <linearGradient id="accent" x1="0" x2="1"><stop stop-color="#e8b958"/><stop offset="1" stop-color="#b77d34"/></linearGradient>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#456073" stroke-opacity=".16" stroke-width="1"/></pattern>
    </defs>
    <rect width="1200" height="630" fill="url(#background)"/>
    <rect width="1200" height="630" fill="url(#grid)"/>
    <path d="M940 0H1200V340L1020 280Z" fill="#d9a547" opacity=".07"/>
    <path d="M0 0H1200" stroke="url(#accent)" stroke-width="18"/>
    <rect x="70" y="55" width="55" height="55" rx="8" fill="#e8b958"/>
    <text x="97" y="96" fill="#08111c" font-family="DejaVu Sans, sans-serif" font-weight="900" font-size="37" text-anchor="middle">L</text>
    <text x="150" y="80" fill="#f7f9fa" font-family="DejaVu Sans, sans-serif" font-size="25" font-weight="bold" letter-spacing="3">LOBO INFINITY</text>
    <text x="150" y="103" fill="#a4bdcc" font-family="DejaVu Sans, sans-serif" font-size="15" letter-spacing="2">LEAGUE PORTAL  /  AFTER ACTION DOSSIER</text>
    <text x="1128" y="89" fill="#e8b958" font-family="DejaVu Sans, sans-serif" font-size="28" font-weight="bold" text-anchor="end">BR-${reportId}</text>
    <path d="M70 136H1130" stroke="#536878" stroke-opacity=".7" stroke-width="2"/>
    <text x="70" y="194" fill="#e8b958" font-family="DejaVu Sans, sans-serif" font-size="20" font-weight="bold" letter-spacing="5">MISSION</text>
    <text x="68" y="267" fill="#ffffff" font-family="DejaVu Sans, sans-serif" font-size="${mission.length > 31 ? 44 : mission.length > 25 ? 54 : 66}" font-weight="900">${mission}</text>
    <path d="M70 298H260" stroke="#e8b958" stroke-width="4"/>
    <text x="70" y="368" fill="#f3f7fa" font-family="DejaVu Sans, sans-serif" font-size="${left.length > 31 ? 35 : 43}" font-weight="bold">${left}</text>
    <text x="70" y="419" fill="#e8b958" font-family="DejaVu Sans, sans-serif" font-size="27" font-weight="900" letter-spacing="4">VS</text>
    <text x="70" y="475" fill="#f3f7fa" font-family="DejaVu Sans, sans-serif" font-size="${right.length > 31 ? 35 : 43}" font-weight="bold">${right}</text>
    <path d="M70 531H1130" stroke="#536878" stroke-opacity=".7" stroke-width="2"/>
    <text x="70" y="580" fill="#a4bdcc" font-family="DejaVu Sans, sans-serif" font-size="21" letter-spacing="2">READ THE BATTLE REPORT</text>
    <text x="1128" y="580" fill="#e8b958" font-family="DejaVu Sans, sans-serif" font-size="24" font-weight="bold" text-anchor="end">${score ? `${score} TP` : 'INFINITY N5'}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

function displayText(value, maxLength) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim()
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}
