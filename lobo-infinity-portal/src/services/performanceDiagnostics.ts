import { getApiDiagnostics } from './apiCore'

export function getFrontendPerformanceDiagnostics() {
  const navigation =
    performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined

  const paintEntries = performance.getEntriesByType('paint')
  const firstContentfulPaint =
    paintEntries.find((entry) => entry.name === 'first-contentful-paint')
      ?.startTime ?? 0

  const largestContentfulPaint =
    performance
      .getEntriesByType('largest-contentful-paint')
      .at(-1)?.startTime ?? 0

  return {
    api: getApiDiagnostics(),
    bundleVersion: getBundleVersion(),
    firstContentfulPaint: Math.round(firstContentfulPaint),
    largestContentfulPaint: Math.round(largestContentfulPaint),
    pageLoad:
      navigation && navigation.loadEventEnd > 0
        ? Math.round(navigation.loadEventEnd - navigation.startTime)
        : 0,
    timeToInteractive:
      navigation && navigation.domInteractive > 0
        ? Math.round(navigation.domInteractive - navigation.startTime)
        : 0,
  }
}

function getBundleVersion() {
  const script = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src*="/assets/index-"]',
  )

  return script?.src.split('/').at(-1) ?? 'development'
}
