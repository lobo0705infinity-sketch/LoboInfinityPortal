import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
const failures = []

page.on('console', (message) => {
  if (message.type() === 'error') {
    failures.push(`console: ${message.text()}`)
  }
})

page.on('pageerror', (error) => {
  failures.push(`pageerror: ${error.message}`)
})

page.on('requestfailed', (request) => {
  failures.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`)
})

await page.goto('https://lobo-infinity-portal.vercel.app/', {
  waitUntil: 'networkidle',
  timeout: 60000,
})

const rendered = await page.locator('.dashboard-command-hero').isVisible({ timeout: 30000 }).catch(() => false)
const pageText = await page.locator('body').innerText()
const normalizedPageText = pageText.toLowerCase()
const legacyRemoved = [
  'What Everyone Is Talking About',
  'Featured Match',
  'Season Story',
  'League Pulse',
  'Reports Awaiting Approval',
].every((text) => !pageText.includes(text))
const recentReportsPresent = normalizedPageText.includes('recent reports')

console.log(JSON.stringify({
  failures,
  legacyRemoved,
  recentReportsPresent,
  rendered,
  title: await page.title(),
  url: page.url(),
}, null, 2))

await browser.close()
