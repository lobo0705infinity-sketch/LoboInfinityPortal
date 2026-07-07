import { getApiDiagnostics } from './apiCore'
import { getRumMetrics } from './rumMetrics'

export function getFrontendPerformanceDiagnostics() {
  const navigation =
    performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined

  const resources = getResourceMetrics()
  const rum = getRumMetrics()

  return {
    api: getApiDiagnostics(),
    bundleVersion: getBundleVersion(),
    cumulativeLayoutShift: roundMetric(rum.cumulativeLayoutShift, 3),
    firstContentfulPaint: Math.round(getFirstContentfulPaint()),
    interactionToNextPaint: Math.round(rum.interactionToNextPaint),
    javascriptTransferBytes: resources.javascriptTransferBytes,
    largestContentfulPaint: Math.round(getLargestContentfulPaint()),
    pageLoad:
      navigation && navigation.loadEventEnd > 0
        ? Math.round(navigation.loadEventEnd - navigation.startTime)
        : 0,
    resourceCount: resources.resourceCount,
    routeTransitionMs: Math.round(rum.routeTransitionMs),
    routeTransitions: rum.routeTransitions,
    stylesheetTransferBytes: resources.stylesheetTransferBytes,
    timeToInteractive:
      navigation && navigation.domInteractive > 0
        ? Math.round(navigation.domInteractive - navigation.startTime)
        : 0,
  }
}

function getFirstContentfulPaint() {
  const rum = getRumMetrics()

  if (rum.firstContentfulPaint > 0) {
    return rum.firstContentfulPaint
  }

  return (
    performance
      .getEntriesByType('paint')
      .find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? 0
  )
}

function getLargestContentfulPaint() {
  const rum = getRumMetrics()

  if (rum.largestContentfulPaint > 0) {
    return rum.largestContentfulPaint
  }

  return (
    performance.getEntriesByType('largest-contentful-paint').at(-1)?.startTime ??
    0
  )
}

function getResourceMetrics() {
  const resources = performance.getEntriesByType(
    'resource',
  ) as PerformanceResourceTiming[]

  return resources.reduce(
    (summary, resource) => {
      const name = resource.name
      const transferSize = resource.transferSize || 0

      if (name.includes('/assets/') && name.endsWith('.js')) {
        summary.javascriptTransferBytes += transferSize
      }

      if (name.includes('/assets/') && name.endsWith('.css')) {
        summary.stylesheetTransferBytes += transferSize
      }

      summary.resourceCount += 1

      return summary
    },
    {
      javascriptTransferBytes: 0,
      resourceCount: 0,
      stylesheetTransferBytes: 0,
    },
  )
}

function roundMetric(value: number, decimals: number) {
  const multiplier = 10 ** decimals

  return Math.round(value * multiplier) / multiplier
}

function getBundleVersion() {
  const script = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src*="/assets/index-"]',
  )

  return script?.src.split('/').at(-1) ?? 'development'
}
