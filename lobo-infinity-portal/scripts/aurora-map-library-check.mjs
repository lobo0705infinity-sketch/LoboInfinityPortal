import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { AURORA_TERRITORIES } from '../shared/aurora-public.mjs'

// The approved cloud-only Workshop export is the provenance for bag labels and rules.
const bags = JSON.parse(await readFile('shared/aurora-workshop-bags.json', 'utf8'))
assert.equal(bags.length, 48)
assert.equal(new Set(bags.map(bag => bag.guid)).size, 48)
for (const region of AURORA_TERRITORIES) for (const location of region.layouts) {
  assert.deepEqual(bags.filter(bag => bag.region === region.name && bag.location === location).map(bag => bag.mission).sort(), ['Frontline', 'Supremacy'])
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png' }
let shell = resolve('dist/app-shell.html')
try { await access(shell) } catch { shell = resolve('dist/index.html') }
const server = createServer(async (req, res) => {
  let path = resolve('dist', '.' + new URL(req.url, 'http://localhost').pathname)
  if (!extname(path)) path = shell
  try { res.setHeader('content-type', mime[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)) }
  catch { res.writeHead(404); res.end() }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const browser = await chromium.launch({ headless: true, ...(process.env.CAMPAIGN_TEST_CHROMIUM ? { executablePath: process.env.CAMPAIGN_TEST_CHROMIUM } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote'] })
try {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://**/*', route => route.fulfill({ status: 503, body: '{}' }))
  const snapshotId = '20261023T040302Z'
  const catalog = {missions: ['Frontline', 'Supremacy'].flatMap(name => [6,7,8,9,10,11,12,13,14,15,16].map(season => ({
    id: `s${season}_${name.toLowerCase()}`, name, current: false, rights: {official: true},
    sourceCollectionId: `s${season}`, sourceCollectionName: `ITS Season ${season}`,
    canonicalUrl: `https://infinitygeist.com/mission/s${season}_${name.toLowerCase()}`,
  })))}
  await page.route('https://ecwefvuvauaqpary.public.blob.vercel-storage.com/**', route => {
    const current = route.request().url().endsWith('/current.json')
    return route.fulfill({contentType:'application/json',body:JSON.stringify(current
      ? {schemaVersion:1,snapshotId,sourceCutoff:'2026-10-23',basePath:`public-snapshots/${snapshotId}/`}
      : {schemaVersion:1,snapshotId,data:route.request().url().endsWith('/mission-catalog.json')?catalog:[]})})
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${origin}/maps`)
  await page.getByRole('navigation', { name: 'Map collections' }).getByRole('link', { name: /Aurora VII/ }).click()
  await page.getByRole('heading', { name: 'Choose your battlefield.' }).waitFor()
  assert.equal(await page.locator('.aurora-region-card').count(), 12)
  assert.equal(await page.locator('.aurora-location-links a').count(), 24)
  const links = await page.locator('.aurora-location-links a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))
  const images = new Set()
  for (const link of links) {
    await page.goto(origin + link)
    await page.locator('#aurora-bag-name').waitFor()
    const frontline = await page.locator('#aurora-bag-name').inputValue()
    assert(bags.some(bag => bag.bagName === frontline))
    await page.getByRole('link', {name: 'Open Frontline reference · ITS Season 16 ↗', exact:true}).waitFor()
    assert.equal(await page.locator('a[href*="infinitygeist.com/mission/"]').count(), 1)
    const image = page.locator('.aurora-location-reference img')
    const source = await image.getAttribute('src')
    await access('public' + source)
    await image.evaluate(node => node.decode())
    images.add(source)
    await page.getByRole('button', { name: 'Supremacy', exact: true }).click()
    assert.equal(await image.getAttribute('src'), source, 'Mission selection must keep the shared image')
    await page.waitForFunction(expected => document.querySelector('#aurora-bag-name')?.value === expected, frontline.replace(/Frontline$/, 'Supremacy'))
    await page.reload()
    assert.equal(await page.getByRole('button', { name: 'Supremacy', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('heading', { name: 'Territory owner advantage' }).waitFor()
    await page.getByRole('link', {name:'Open Supremacy reference · ITS Season 16 ↗',exact:true}).waitFor()
    assert.equal(await page.locator('a[href*="infinitygeist.com/mission/"]').count(), 1)
  }
  assert.equal(images.size, 24)
  await page.getByRole('button', { name: 'Copy bag name', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Bag name copied.' }).waitFor()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.locator('#aurora-bag-name').inputValue())
  await page.goto(`${origin}/maps/aurora-vii?region=azure-coast`)
  await page.locator('.aurora-region-card').waitFor()
  assert.equal(await page.locator('.aurora-region-card').count(), 1)
  await page.getByRole('link', { name: /Coastal Access.*Frontline/ }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'No mobile overflow')
  await page.screenshot({ path: '/tmp/aurora-location-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Supremacy', exact: true }).click()
  await page.goto(`${origin}/maps/aurora-vii?q=no-such-map`)
  await page.getByText(/No regions or locations match/).waitFor()
  await page.getByRole('link', { name: 'Reset filters' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.aurora-region-card').length === 12)
  assert.equal(await page.locator('.aurora-region-card').count(), 12)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.locator('.aurora-region-card img').evaluateAll(nodes => Promise.all(nodes.map(node => { node.loading = 'eager'; return node.decode() })))
  assert(await page.locator('.aurora-region-card img').first().evaluate(node => node.getBoundingClientRect().height <= 180), 'Region previews stay compact')
  await page.screenshot({ path: '/tmp/aurora-regions-desktop.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS: 12 regions, 24 shared images, all 48 exact bag labels, mission deep links, clipboard, filters, offline references, and mobile layout.')
} finally { await browser.close(); await new Promise(done => server.close(done)) }
