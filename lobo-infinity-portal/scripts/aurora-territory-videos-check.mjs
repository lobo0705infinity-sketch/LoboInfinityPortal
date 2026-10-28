import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from 'playwright'
import { AURORA_TERRITORIES } from '../shared/aurora-public.mjs'
import { auroraMapRegions } from '../shared/aurora-map-catalog.mjs'
import { emptyAuroraState } from '../shared/aurora-public-state.mjs'

const expected = {
  'nova-prospect': 'hPJqowEY2ag', 'korin-range': 'XGDKjDwFM8Q',
  'crystal-frontier': 'hLn39ozOR28', 'harmony-province': 'abxV520l70E',
  'verde-wilds': 'CW79NFD_sPM', 'ember-highlands': 'ARvOGEtQhrk',
  'frostreach-wastes': 'gczfSFmLDjg', 'iron-corridor': '1bz2C1y7ce0',
}
const pdfPath = '/guides/aurora-vii-territory-special-rules-20261028.pdf'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.pdf': 'application/pdf' }
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/api/aurora-campaign')) return res.end(JSON.stringify({ revision: 'test', publishedAt: '2026-10-28T00:00:00Z', state: emptyAuroraState() }))
  if (req.url.startsWith('/api/aurora-activity')) return res.end(JSON.stringify({ turn: 0, games: [], totals: [] }))
  if (req.url.startsWith('/api/')) { res.writeHead(503); return res.end('{}') }
  let path = resolve('dist', '.' + new URL(req.url, 'http://localhost').pathname)
  if (!extname(path)) path = resolve('dist/app-shell.html')
  try { res.setHeader('content-type', mime[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)) }
  catch { res.writeHead(404); res.end() }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const browser = await chromium.launch({ headless: true,
  ...(process.env.CAMPAIGN_TEST_CHROMIUM ? { executablePath: process.env.CAMPAIGN_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = [], embeds = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().includes('youtube-nocookie.com/embed/')) embeds.push(request.url()) })
  await page.route('https://**/*', route => route.fulfill({ status: 503, body: '{}' }))
  const origin = `http://127.0.0.1:${server.address().port}`
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(origin + '/campaign/aurora-vii')
    await page.getByRole('heading', { name: 'Territory video guides', exact: true }).waitFor()
    assert.equal(await page.locator('.aurora-territory-video-card').count(), 8)
    await page.locator('.aurora-territory-video-card img').evaluateAll(nodes => Promise.all(nodes.map(node => { node.loading = 'eager'; return node.decode() })))
    assert.equal(await page.locator('iframe').count(), 0)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Gallery fits ${width}px`)
    assert.equal(await page.locator('.aurora-territory-video-card').first().evaluate(node => getComputedStyle(node.parentElement).display), 'grid')
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const territory of AURORA_TERRITORIES) {
    await page.goto(origin + '/campaign/aurora-vii/territories/' + territory.id)
    await page.locator('.aurora-battlefield-rules').waitFor()
    assert.equal(await page.locator('.aurora-territory-video').count(), expected[territory.id] ? 1 : 0)
    assert.equal(await page.locator('iframe').count(), 0)
    if (expected[territory.id]) {
      const video = page.locator('.aurora-territory-video')
      assert.equal(await video.getByRole('link', { name: 'Watch on YouTube ↗' }).getAttribute('href'), `https://www.youtube.com/watch?v=${expected[territory.id]}`)
    }
  }
  assert.equal(embeds.length, 0, 'No player requests before a visitor chooses playback')
  await page.goto(origin + '/campaign/aurora-vii/territories/iron-corridor')
  await page.getByRole('button', { name: 'Play Iron Corridor video guide' }).click()
  assert.match(await page.locator('iframe').getAttribute('src'), /1bz2C1y7ce0\?autoplay=1/)
  assert.equal(await page.locator('iframe').getAttribute('title'), 'Reinforced Cover: Iron Corridor')
  await page.getByRole('button', { name: 'Close player' }).click()
  assert.equal(await page.locator('iframe').count(), 0)
  const sulfur = auroraMapRegions.find(region => region.id === 'sulfur-basin')
  const sulfurRoutes = ['/campaign/aurora-vii/territories/sulfur-basin', ...sulfur.locations.map(location => '/maps/' + location.slug)]
  for (const route of sulfurRoutes) {
    await page.goto(origin + route)
    const rules = page.locator('.aurora-battlefield-rules')
    await rules.waitFor()
    const text = await rules.innerText()
    for (const skill of ['Immunity (ARM)', 'Immunity (Enhanced)', 'Immunity (BTS)', 'Immunity (Continuous Damage)', 'Terrain (Total)']) assert(text.includes(skill), route + ': ' + skill)
    assert(text.includes('every trooper in a Fireteam containing a trooper with any of those skills'))
    assert(text.includes('At the beginning of the scenario, choose one friendly trooper.'))
    assert(!text.includes('ignore the Toxic Fumes Saving Roll for one Order'))
  }
  await page.goto(origin + '/campaign/aurora-vii/rules')
  await page.getByText('Sulfur Basin · Toxic Fumes', { exact: true }).click()
  await page.getByText('At the beginning of the scenario, choose one friendly trooper.', { exact: false }).waitFor()
  const response = await page.request.get(origin + pdfPath)
  assert.equal(response.status(), 200)
  assert((await response.body()).subarray(0, 5).equals(Buffer.from('%PDF-')))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin + '/campaign/aurora-vii/territories/iron-corridor')
  await page.getByRole('button', { name: 'Play Iron Corridor video guide' }).waitFor()
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Territory fits mobile')
  await page.locator('.aurora-video-poster img').evaluate(node => { node.loading = 'eager'; return node.decode() })
  await page.screenshot({ path: '/tmp/aurora-video-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(origin + '/campaign/aurora-vii#territory-videos')
  await page.locator('#territory-videos').scrollIntoViewIfNeeded()
  await page.locator('.aurora-territory-video-card img').evaluateAll(nodes => Promise.all(nodes.map(node => { node.loading = 'eager'; return node.decode() })))
  await page.screenshot({ path: '/tmp/aurora-video-gallery.png' })
  assert.deepEqual(errors, [])
  console.log('PASS: eight published guides, all twelve territories, click-to-load/close player, no preloaded embeds, mobile gallery, Sulfur rules across territory/two locations/Player Rules, downloadable PDF, no page errors.')
} finally { await browser.close(); await new Promise(done => server.close(done)) }
