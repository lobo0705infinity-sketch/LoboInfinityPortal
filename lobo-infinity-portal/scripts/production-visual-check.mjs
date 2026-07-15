import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { currentGitState, fail, pass, readManifest, repoRoot } from './release-utils.mjs'

const manifest = readManifest()
const baseUrl = process.env.VISUAL_BASE_URL || process.env.CONTRACT_BASE_URL
const updateBaselines = process.env.UPDATE_VISUAL_BASELINES === '1'
const candidateOnly = process.env.VISUAL_CANDIDATES_ONLY === '1'

if (!baseUrl) {
  fail('visual regression check requires VISUAL_BASE_URL or CONTRACT_BASE_URL')
}

const authenticatedMarkersEnabled = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE)
const surfaces = [
  { name: 'dashboard-desktop', route: '/', width: 1440, height: 1000, markers: ['Dashboard'] },
  { name: 'players-desktop', route: '/players', width: 1440, height: 1000, markers: ['Players'] },
  { name: 'submit-game-desktop', route: '/submit-game', width: 1440, height: 1000, markers: ['Submit Game'] },
  { name: 'submit-army-list-desktop', route: '/army-lists/submit', width: 1440, height: 1000, markers: ['Army'] },
  { name: 'events-desktop', route: '/events', width: 1440, height: 1000, markers: ['Events'] },
  {
    name: 'commissioner-sidebar-desktop',
    route: '/commissioner',
    width: 1440,
    height: 1000,
    markers: authenticatedMarkersEnabled ? manifest.contractMarkers.commissionerNavigation : [],
  },
  { name: 'commissioner-system-desktop', route: '/commissioner/system', width: 1440, height: 1000, markers: authenticatedMarkersEnabled ? ['System'] : [] },
  { name: 'my-profile-desktop', route: '/profile', width: 1440, height: 1000, markers: authenticatedMarkersEnabled ? ['My Profile'] : [] },
  { name: 'my-profile-mobile', route: '/profile', width: 390, height: 844, markers: authenticatedMarkersEnabled ? ['My Profile'] : [] },
]

const state = currentGitState()
const outputDir = candidateOnly
  ? resolve(repoRoot, '.release-artifacts', 'visual-candidates', state.commit)
  : resolve(repoRoot, '.release-artifacts', 'visual-current')
const baselineDir = resolve(repoRoot, 'tests', 'visual-baselines')
mkdirSync(outputDir, { recursive: true })
mkdirSync(baselineDir, { recursive: true })

const failures = []
const browser = await chromium.launch({ headless: true })
const contextOptions = process.env.PLAYWRIGHT_STORAGE_STATE
  ? { storageState: process.env.PLAYWRIGHT_STORAGE_STATE }
  : {}
const context = await browser.newContext(contextOptions)

for (const surface of surfaces) {
  const page = await context.newPage()
  await page.setViewportSize({ width: surface.width, height: surface.height })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  try {
    const response = await page.goto(new URL(surface.route, baseUrl).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await page.waitForTimeout(1500)
    const rootChildren = await page.locator('#root > *').count().catch(() => 0)
    const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')

    if (!response || response.status() >= 400) {
      failures.push(`${surface.name} returned HTTP ${response ? response.status() : 'none'}`)
    }
    if (rootChildren < 1 || text.trim().length < 40) {
      failures.push(`${surface.name} rendered an empty or nearly empty shell.`)
    }
    if (errors.length) {
      failures.push(`${surface.name} runtime errors: ${errors.join('; ')}`)
    }
    surface.markers.forEach((marker) => {
      if (!text.includes(marker)) {
        failures.push(`${surface.name} missing visible marker: ${marker}`)
      }
    })

    const screenshot = await page.screenshot({ fullPage: true })
    const screenshotPath = resolve(outputDir, `${surface.name}.png`)
    const baselinePath = resolve(baselineDir, `${surface.name}.png`)
    writeFileSync(screenshotPath, screenshot)

    if (candidateOnly) {
      continue
    }

    if (updateBaselines) {
      writeFileSync(baselinePath, screenshot)
    } else {
      try {
        const baseline = readFileSync(baselinePath)
        if (!baseline.equals(screenshot)) {
          failures.push(`${surface.name} differs from approved visual baseline.`)
        }
      } catch {
        failures.push(`${surface.name} has no approved visual baseline. Run UPDATE_VISUAL_BASELINES=1 only for an intentional visual change.`)
      }
    }
  } catch (error) {
    failures.push(`${surface.name}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await page.close()
  }
}

await context.close()
await browser.close()

if (failures.length) {
  fail('visual regression check failed', failures)
}

pass(`${candidateOnly ? 'visual candidates captured' : 'visual regression check passed'} for ${surfaces.length} surfaces in ${outputDir}`)
