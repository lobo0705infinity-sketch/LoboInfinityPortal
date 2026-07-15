import { chromium } from 'playwright'
import { fail, pass, readManifest } from './release-utils.mjs'

const manifest = readManifest()
const baseUrl = process.env.SMOKE_BASE_URL || process.env.VISUAL_BASE_URL || process.env.CONTRACT_BASE_URL
const authenticatedMarkersEnabled = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE)

if (!baseUrl) {
  fail('route smoke check requires SMOKE_BASE_URL, VISUAL_BASE_URL, or CONTRACT_BASE_URL')
}

const routes = [
  { name: 'dashboard', path: '/', markers: ['Dashboard'] },
  { name: 'players', path: '/players', markers: ['Players'] },
  { name: 'submit-game', path: '/submit-game', markers: ['Submit Game'] },
  { name: 'submit-army-list', path: '/army-lists/submit', markers: ['Army'] },
  { name: 'events', path: '/events', markers: ['Events'] },
  {
    name: 'commissioner',
    path: '/commissioner',
    markers: authenticatedMarkersEnabled ? manifest.contractMarkers.commissionerNavigation : [],
  },
  {
    name: 'commissioner-events',
    path: '/commissioner/events',
    markers: authenticatedMarkersEnabled ? ['Events'] : [],
  },
  {
    name: 'commissioner-players',
    path: '/commissioner/players',
    markers: authenticatedMarkersEnabled ? ['Players'] : [],
  },
  {
    name: 'commissioner-automation',
    path: '/commissioner/automation',
    markers: authenticatedMarkersEnabled ? ['Automation'] : [],
  },
  {
    name: 'commissioner-system',
    path: '/commissioner/system',
    markers: authenticatedMarkersEnabled ? ['System'] : [],
  },
  {
    name: 'my-profile-desktop',
    path: '/profile',
    markers: authenticatedMarkersEnabled ? ['My Profile', 'Current Season', 'Promotion Status', 'Recent Results'] : [],
  },
]

const failures = []
const browser = await chromium.launch({ headless: true })
const contextOptions = process.env.PLAYWRIGHT_STORAGE_STATE
  ? { storageState: process.env.PLAYWRIGHT_STORAGE_STATE }
  : {}
const context = await browser.newContext(contextOptions)

for (const route of routes) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  try {
    const response = await page.goto(new URL(route.path, baseUrl).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
    const rootChildren = await page.locator('#root > *').count().catch(() => 0)
    const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')

    if (!response || response.status() >= 400) {
      failures.push(`${route.name} returned HTTP ${response ? response.status() : 'none'}`)
    }
    if (rootChildren < 1 || text.trim().length < 40) {
      failures.push(`${route.name} rendered an empty or nearly empty shell.`)
    }
    if (errors.length) {
      failures.push(`${route.name} runtime errors: ${errors.join('; ')}`)
    }
    route.markers.forEach((marker) => {
      if (!text.includes(marker)) {
        failures.push(`${route.name} missing visible marker: ${marker}`)
      }
    })
  } catch (error) {
    failures.push(`${route.name}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await page.close()
  }
}

await context.close()
await browser.close()

if (failures.length) {
  fail('route smoke check failed', failures)
}

pass(`route smoke check passed for ${routes.length} routes`)
