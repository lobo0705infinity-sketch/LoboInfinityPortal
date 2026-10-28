import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'
import { expect } from 'playwright/test'
import { emptyAuroraState } from '../shared/aurora-public-state.mjs'
import { AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'
import { AURORA_FACTIONS, AURORA_CONQUEST_FACTIONS } from '../shared/aurora-public.mjs'
import { factionName } from '../shared/aurora-games.mjs'
import { createCampaignGameStore } from '../bot/aurora-game-store.mjs'
import { createCampaignGameService } from '../bot/aurora-game-service.mjs'
const directory = await mkdtemp(join(tmpdir(), 'aurora-ops-browser-')), store = createCampaignGameStore(join(directory, 'games.json'))
const players = AURORA_REGISTRATION_FACTIONS.map((f, i) => ({ userId: String(100000000000000000n + BigInt(i)), name: f.name + ' commander', faction: f.id }))
const person = f => players.find(p => factionName(p.faction) === f)
let state = emptyAuroraState(), publicationCount = 0, captured = null
state.turn = 1; state.deadline = '2026-12-01T23:59:00-05:00'; state.territories.forEach((t, i) => { t.controller = AURORA_CONQUEST_FACTIONS[i % 8]; t.vulnerable = i < 4 })
for (const f of AURORA_FACTIONS) await store.operate({ action: 'representatives', revision: (await store.operations()).revision, turn: 0, faction: f, commander: person(f).userId, reason: 'Fixture representative' }, players, state)
const service = createCampaignGameService({ store, registrations: { player: async id => players.find(p => p.userId === id), players: async () => players }, identity: () => null, notify: async () => {}, fetchObject: async url => ({ ok: true, json: async () => url.includes('verify-admin') ? { authorized: true } : { state } }) })
const dist = process.env.CAMPAIGN_TEST_DIST || 'dist'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
  const send = (value, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
  if (req.url.startsWith('/api/aurora-games?')) { req.url = req.url.replace('/api/aurora-games', '/aurora-vii/games'); req.headers.origin = 'https://lobo-infinity-portal.vercel.app'; res.setHeader('content-type', 'application/json'); return service.handler(req, res) }
  if (req.url.startsWith('/api/aurora-campaign')) {
    if (req.method === 'POST') { let body = ''; for await (const chunk of req) body += chunk; captured = JSON.parse(body); state = captured.state; publicationCount++ }
    return send({ revision: 'fixture', publishedAt: '', state })
  }
  if (req.url.startsWith('/api/aurora-activity')) return send(await store.activity(state.turn))
  if (req.url.startsWith('/api/')) return send({ error: 'Unrelated fixture dataset' }, 503)
  let file = resolve(dist, '.' + new URL(req.url, 'http://localhost').pathname); if (!extname(file)) file = resolve(dist, 'index.html')
  try { res.setHeader('content-type', mime[extname(file)] || 'application/octet-stream'); res.end(await readFile(file)) } catch { res.writeHead(404); res.end() }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const root = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ headless: true, ...(process.env.CAMPAIGN_TEST_CHROMIUM ? { executablePath: process.env.CAMPAIGN_TEST_CHROMIUM } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', async route => {
    const req = route.request(); let body; try { body = req.postDataJSON() } catch {}
    if (body?.action === 'session' || new URLSearchParams(req.postData() || '').get('action') === 'session' || new URL(req.url()).searchParams.get('action') === 'session') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, authenticated: true, permissions: {}, user: { role: 'Commissioner', displayName: 'Fixture commissioner', enabled: true } }) })
    return req.url().startsWith(root) ? route.continue() : route.abort()
  })
  await page.addInitScript(() => localStorage.setItem('lobo-session-token', 'fixture-commissioner-token'))
  await page.goto(`${root}/commissioner/aurora-vii`)
  await page.getByRole('heading', { name: 'Campaign operations', exact: true }).waitFor()
  await expect(page.getByText('Turn not prepared', { exact: true })).toBeVisible()
  async function save(title, fields = {}) {
    console.log('Checking:', title)
    const group = page.getByRole('group', { name: title, exact: true })
    for (const [label, value] of Object.entries(fields)) { const field = group.getByLabel(label, { exact: true }); if (await field.evaluate(e => e.tagName) === 'SELECT') await field.selectOption(value); else await field.fill(value) }
    await group.getByLabel('Commissioner explanation', { exact: true }).fill('Verified private Discord DM')
    const response = page.waitForResponse(r => r.url().includes('action=operate') && r.request().method() === 'POST')
    await group.getByRole('button', { name: title, exact: true }).click(); const r = await response; assert(r.ok(), JSON.stringify(await r.json()))
    await expect(page.getByText('Saved to the private campaign ledger.', { exact: true })).toBeVisible()
  }
  await save('Prepare announced Turn'); await expect(page.getByText('Collecting private decisions', { exact: true })).toBeVisible()
  await save('Record Hidden Hand DM', { 'Vulnerable Territory': 'nova-prospect', Faction: 'Yu Jing', 'Desired outcome': 'INSTALL', 'DM sender': person('Tohaa').userId, 'Private note (optional)': 'PRIVATE_SENTINEL' })
  await save('Record Infiltration DM', { 'Vulnerable Territory': 'korin-range', 'DM sender': person('Combined Army').userId })
  await save('Record employer offer DM', { Employer: 'Yu Jing', 'Vulnerable Territory': 'nova-prospect', 'Bid · Credits': '2', 'DM sender': person('Yu Jing').userId })
  await save('Record NA2 acceptance of Yu Jing offer', { 'DM sender': person('NA2').userId })
  await save('Lock decisions & open games'); await expect(page.getByText('Games open · choices locked', { exact: true })).toBeVisible()
  const game = await store.submit({ turn: 1, date: new Date().toISOString().slice(0, 10), kind: 'territory', location: 'nova-prospect', mission: 'Claim the Frontier', opA: 7, opB: 6 }, person('Yu Jing'), person('PanOceania'), state)
  await store.act({ id: game.id, revision: game.revision, action: 'confirm' }, person('PanOceania').userId, false)
  await save('Close campaign reporting'); await expect(page.getByText('Reporting closed · review results', { exact: true })).toBeVisible()
  const commit = page.getByRole('group', { name: 'Commit reviewed Turn resolution', exact: true })
  await commit.locator('input[value="Yu Jing"]').check(); await save('Commit reviewed Turn resolution')
  await expect(page.getByText('Resolved · records locked', { exact: true })).toBeVisible()
  assert.equal(publicationCount, 0)
  await page.getByRole('button', { name: 'Load resolved public outcome into bulletin', exact: true }).click()
  await expect(page.getByLabel('Published controller').first()).toHaveValue('Yu Jing')
  await expect(page.locator('.aurora-admin-form').last().getByLabel('Yu Jing', { exact: true })).toHaveValue('1')
  const consent = page.getByRole('checkbox', { name: /I confirm all content here/ }); await consent.check()
  await page.getByRole('button', { name: 'Publish approved public state', exact: true }).click()
  await expect(page.getByText('The approved public campaign state is now published.', { exact: true })).toBeVisible()
  assert.equal(publicationCount, 1); assert.equal(state.territories[0].controller, 'Yu Jing'); assert.equal(state.standings.find(s => s.faction === 'Tohaa').vp, 2)
  for (const secret of ['PRIVATE_SENTINEL', 'commanders', 'credits', 'offers', 'messageUrl']) assert(!JSON.stringify(captured).includes(secret))
  await page.setViewportSize({ width: 390, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Commissioner phone layout fits')
  await page.getByRole('heading', {name:'Campaign operations',exact:true}).scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(directory, 'commissioner-mobile.png'), fullPage: false })
  await page.goto(`${root}/campaign/aurora-vii/map`); await page.getByRole('combobox', {name:'Choose a territory'}).selectOption('nova-prospect'); await expect(page.locator('.aurora-facts').getByText('Yu Jing', {exact:true})).toBeVisible()
  assert.deepEqual(errors, [])
  console.log('PASS: real private ledger/service, commissioner authentication fixture, DM recording, Credit reserve, lock/open/close, reviewed commit, Doctrine award, public draft transfer, allowlisted publication and mobile layout. No production data or messages. Screenshots:', directory)
} finally { await browser.close(); await new Promise(r => server.close(r)); await rm(join(directory, 'games.json'), { force: true }) }
