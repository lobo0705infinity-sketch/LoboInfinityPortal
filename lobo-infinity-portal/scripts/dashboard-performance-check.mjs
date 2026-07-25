import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const failures = []
const sourcePath = resolve(
  process.cwd(),
  'docs',
  'design',
  'Dashboard',
  'docs',
  'dashboard-concept-v2.1.png',
)
const derivativePath = resolve(process.cwd(), 'public', 'dashboard', 'dashboard-hero.webp')
const dashboard = read('src/pages/Dashboard.tsx')
const context = read('src/contexts/DashboardDataContext.tsx')
const dashboardCss = read('src/pages/Dashboard.css')

assert(existsSync(sourcePath), 'Approved Dashboard source artwork must exist.')
assert(existsSync(derivativePath), 'Optimized Dashboard hero derivative must exist.')

if (existsSync(derivativePath)) {
  const derivative = readFileSync(derivativePath)
  assert(isWebp(derivative), 'Optimized Dashboard hero derivative must be WebP.')
  assert(statSync(derivativePath).size < statSync(sourcePath).size, 'Hero derivative must be smaller than source PNG.')
}

const sourceHash = sha256(readFileSync(sourcePath))
assert(
  sourceHash === '2dcb5648789f7f0ba77c6828d91512ae6684754e9b53d0ab82c3de0065ca3354',
  'Approved Dashboard source artwork hash must remain unchanged.',
)

assert(
  /const dashboardHero = '\/dashboard\/dashboard-hero\.webp'/.test(dashboard) &&
    /src=\{dashboardHero\}/.test(dashboard),
  'Dashboard must render the optimized public hero derivative.',
)
assert(
  !/dashboard-concept-v2\.1\.png/.test(dashboard),
  'Dashboard must not import the full-size source PNG into the startup bundle.',
)
assert(
  /width=\{1536\}/.test(dashboard) && /height=\{1024\}/.test(dashboard),
  'Dashboard hero must declare explicit dimensions.',
)
assert(
  /decoding="async"/.test(dashboard) && !/loading="lazy"[\s\S]*src=\{dashboardHero\}/.test(dashboard),
  'Above-the-fold Dashboard hero must decode asynchronously without lazy loading.',
)
assert(
  /fetchPriority="high"/.test(dashboard),
  'Above-the-fold Dashboard hero must use high fetch priority.',
)
assert(
  /function preloadDashboardHero/.test(dashboard) &&
    /link\.rel = 'preload'/.test(dashboard) &&
    /link\.as = 'image'/.test(dashboard) &&
    /link\.href = dashboardHero/.test(dashboard),
  'Dashboard route module must preload the optimized hero image.',
)
assert(
  /homeStatus === 'loading'[\s\S]*<DashboardCommandHero/.test(dashboard) &&
    /homeStatus === 'error'[\s\S]*<DashboardCommandHero/.test(dashboard),
  'Dashboard loading and error states must render the final optimized hero independently of summary data.',
)
assert(
  /min-height: 420px/.test(dashboardCss) &&
    /dashboard-command-overlay[\s\S]*min-height: inherit/.test(dashboardCss) &&
    /dashboard-command-status[\s\S]*min-height: 35px/.test(dashboardCss),
  'Dashboard hero loading and loaded states must reserve stable hero and overlay dimensions.',
)

for (const action of ['recentGames', 'streams', 'records', 'hallOfFame', 'armyLists', 'intelligence']) {
  assert(
    new RegExp(`useDashboardDeferredOnDemand\\(\\[[^\\]]*'${action}'`).test(dashboard),
    `Dashboard must request ${action} through a deferred section trigger.`,
  )
}

assert(
  !/loadDeferredDashboardData/.test(context),
  'Dashboard context must not eagerly request every below-the-fold dataset after summary load.',
)
assert(
  !/loadNews|newsCache|apiClient\.getNews/.test(context),
  'Removed News page data must not be requested by Dashboard data loading.',
)
assert(
  /IntersectionObserver/.test(dashboard) &&
    /requested\.current/.test(dashboard) &&
    /loadDeferredSections\(sections\)/.test(dashboard),
  'Dashboard must use a reusable one-shot IntersectionObserver deferred-section pattern.',
)
assert(
  /deferredObserverDelayMs = 3200/.test(dashboard) &&
    /deferredObserverRootMargin = '80px 0px'/.test(dashboard) &&
    /window\.setTimeout/.test(dashboard),
  'Dashboard deferred observers must wait past the LCP window and use a narrower forward margin.',
)
assert(
  /requestedDeferredSections\.current\.has\(section\)/.test(context),
  'Dashboard deferred loader must avoid duplicate requests when sections re-enter the viewport.',
)
assert(
  /createDashboardCache/.test(context) &&
    /existing\?\.value && existing\.expiresAt > now/.test(context) &&
    /existing\?\.pending/.test(context),
  'Dashboard deferred data must preserve existing cache and in-flight request behavior.',
)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('dashboard performance checks passed')
console.log(
  JSON.stringify(
    {
      derivativeBytes: statSync(derivativePath).size,
      derivativeFormat: 'webp',
      sourceBytes: statSync(sourcePath).size,
      sourceSha256: sourceHash,
    },
    null,
    2,
  ),
)

function read(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message)
  }
}

function isWebp(buffer) {
  return (
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  )
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}
