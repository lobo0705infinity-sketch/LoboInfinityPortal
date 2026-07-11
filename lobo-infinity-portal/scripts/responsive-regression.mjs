import { chromium } from 'playwright'

const DEFAULT_BASE_URL = 'http://127.0.0.1:4173'

const viewports = [
  { height: 1080, name: 'desktop-1920', width: 1920 },
  { height: 768, name: 'desktop-1366', width: 1366 },
  { height: 844, name: 'mobile-390', width: 390 },
  { height: 1024, name: 'tablet-768', width: 768 },
  { height: 390, name: 'landscape-844', width: 844 },
]

const widthAuditViewports = [
  { height: 900, name: 'desktop-1600', width: 1600 },
  { height: 900, name: 'browser-1500', width: 1500 },
  { height: 900, name: 'desktop-1440', width: 1440 },
  { height: 900, name: 'browser-1400', width: 1400 },
  { height: 800, name: 'browser-1300', width: 1300 },
  { height: 720, name: 'desktop-1280', width: 1280 },
  { height: 800, name: 'browser-1200', width: 1200 },
  { height: 800, name: 'browser-1100', width: 1100 },
  { height: 800, name: 'browser-1000', width: 1000 },
  { height: 800, name: 'browser-900', width: 900 },
]

const routes = [
  { name: 'dashboard', path: '/' },
  { name: 'event-overview', path: '/event/event-current-league' },
  { name: 'team-tournament', path: '/event/event-august-2026-team-tournament/tournament' },
  { name: 'submit-result', path: '/event/event-current-league/submit-result' },
  { name: 'standings', path: '/standings?eventId=event-current-league' },
  { name: 'match-finder', path: '/match-finder?eventId=event-current-league' },
  { name: 'players', path: '/players?eventId=event-current-league' },
  { name: 'factions', path: '/factions?eventId=event-current-league' },
  { name: 'statistics', path: '/analytics?eventId=event-current-league' },
  { name: 'rules-league', path: '/rules?eventId=event-current-league' },
  { name: 'rules-team-tournament', path: '/rules?eventId=event-august-2026-team-tournament' },
  { name: 'timeline', path: '/timeline?eventId=event-current-league' },
  { name: 'news', path: '/news' },
  { name: 'hall-of-fame', path: '/hall-of-fame' },
  { name: 'compare', path: '/compare' },
  { name: 'commissioner', path: '/commissioner' },
  { name: 'operations', path: '/operations' },
  { name: 'automation', path: '/automation' },
  { name: 'diagnostics', path: '/diagnostics' },
]

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, value = 'true'] = arg.slice(2).split('=')
      return [key, value]
    }),
)

const baseUrl = args.get('base-url') ?? DEFAULT_BASE_URL
const includeScreenshots = args.get('screenshots') === 'true'
const auditAllWidths = args.get('all-widths') === 'true'
const screenshotDir = args.get('screenshot-dir') ?? 'screenshots-responsive'
const selectedViewports = auditAllWidths ? [...viewports, ...widthAuditViewports] : viewports

const browser = await chromium.launch()
const failures = []

try {
  for (const viewport of selectedViewports) {
    const page = await browser.newPage({ viewport })

    for (const route of routes) {
      const url = new URL(route.path, baseUrl).toString()
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(900)

      const result = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth
        const viewportHeight = document.documentElement.clientHeight
        const overflow = Math.max(
          document.documentElement.scrollWidth - viewportWidth,
          document.body.scrollWidth - viewportWidth,
        )

        const visibleControls = Array.from(
          document.querySelectorAll(
            'main input, main select, main textarea, main button, main a, header input, header select, header button, header a, header .header-title, header .mobile-app-brand',
          ),
        )
          .map((element) => {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return {
              label:
                element.getAttribute('aria-label') ||
                element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) ||
                element.getAttribute('name') ||
                element.tagName.toLowerCase(),
              rect: {
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width,
              },
              visible:
                rect.width > 4 &&
                rect.height > 4 &&
                rect.bottom > 0 &&
                rect.right > 0 &&
                rect.top < viewportHeight &&
                rect.left < viewportWidth &&
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                Number(style.opacity) !== 0,
            }
          })
          .filter((item) => item.visible)

        const clippedControls = visibleControls.filter(
          (item) => item.rect.left < -2 || item.rect.right > viewportWidth + 2,
        )

        const overlaps = []
        for (let index = 0; index < visibleControls.length; index += 1) {
          for (let next = index + 1; next < visibleControls.length; next += 1) {
            const left = Math.max(visibleControls[index].rect.left, visibleControls[next].rect.left)
            const right = Math.min(visibleControls[index].rect.right, visibleControls[next].rect.right)
            const top = Math.max(visibleControls[index].rect.top, visibleControls[next].rect.top)
            const bottom = Math.min(visibleControls[index].rect.bottom, visibleControls[next].rect.bottom)
            const area = Math.max(0, right - left) * Math.max(0, bottom - top)

            if (area > 120) {
              overlaps.push({
                area: Math.round(area),
                first: visibleControls[index].label,
                second: visibleControls[next].label,
              })
            }
          }
        }

        return {
          clippedControls: clippedControls.slice(0, 5),
          overflow,
          overlaps: overlaps.slice(0, 5),
        }
      })

      if (result.overflow > 2 || result.clippedControls.length > 0 || result.overlaps.length > 0) {
        failures.push({
          result,
          route: route.name,
          viewport: viewport.name,
        })
      }

      if (includeScreenshots) {
        await page.screenshot({
          fullPage: true,
          path: `${screenshotDir}/${viewport.name}-${route.name}.png`,
        })
      }
    }

    await page.close()
  }
} finally {
  await browser.close()
}

if (failures.length > 0) {
  console.error(JSON.stringify({ failures }, null, 2))
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      routes: routes.length,
      status: 'passed',
      viewports: selectedViewports.map((viewport) => viewport.name),
    },
    null,
    2,
  ),
)
