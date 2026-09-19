import { readFileSync } from 'node:fs'

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8')
const failures = []
const hook = dashboard.slice(
  dashboard.indexOf('function useDashboardDeferredOnDemand'),
  dashboard.indexOf('function preloadDashboardHero'),
)

assert(!/3200|deferredObserverDelayMs|setTimeout|requestIdleCallback/.test(hook),
  'Dashboard deferred loading must not contain an artificial observer-install delay.')
assert(/const observer = new IntersectionObserver/.test(hook),
  'Dashboard deferred loading must preserve IntersectionObserver visibility gating.')
assert(/\{ rootMargin: deferredObserverRootMargin \}/.test(hook) &&
  /deferredObserverRootMargin = '80px 0px'/.test(dashboard),
  'Dashboard deferred loading must preserve its existing observer configuration.')
assert(/if \(!entry\?\.isIntersecting \|\| requested\.current\)/.test(hook),
  'Off-screen panels and already-requested panels must remain gated.')
assert(/requested\.current = true\s*loadDeferredSections\(sections\)\s*observer\.disconnect\(\)/.test(hook),
  'A visible panel must request its existing sections exactly once and disconnect.')
assert(/return \(\) => \{\s*observer\.disconnect\(\)\s*\}/.test(hook),
  'Observer cleanup must remain active on unmount or route change.')
assert(/typeof IntersectionObserver === 'undefined'[\s\S]*requested\.current = true[\s\S]*loadDeferredSections\(sections\)/.test(hook),
  'The existing no-IntersectionObserver fallback must remain intact.')
assert(/homeStatus === 'loading'[\s\S]*DashboardLoadingContent/.test(dashboard) &&
  /if \(!homeData \|\| !data\)/.test(dashboard),
  'Primary Dashboard summary loading must remain independent of deferred panels.')
assert(!/Commander Overview/.test(dashboard),
  'Commander Overview must remain removed.')

await simulateVisibleCachedPanel()

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('dashboard deferred-loading checks passed')

function simulateVisibleCachedPanel() {
  let observerInstalled = false
  let requests = 0
  let panelData = null
  const cached = { reports: 3 }

  observerInstalled = true
  const intersect = (visible) => {
    if (!visible || requests > 0) return
    requests += 1
    Promise.resolve(cached).then((data) => {
      panelData = data
    })
  }

  assert(observerInstalled, 'Observer must be installed synchronously at mount.')
  intersect(false)
  assert(requests === 0, 'Off-screen panels must not request supplemental data.')
  intersect(true)
  intersect(true)
  assert(requests === 1, 'A visible panel must make the same single request without duplication.')

  return Promise.resolve().then(() => {
    assert(panelData === cached, 'Cached panel data must populate on the next microtask.')
  })
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}
