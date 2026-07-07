type InteractionEntry = PerformanceEntry & {
  duration?: number
  interactionId?: number
}

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput?: boolean
  value?: number
}

export type RouteTransitionMetric = {
  durationMs: number
  path: string
  timestamp: number
}

const metrics = {
  cumulativeLayoutShift: 0,
  firstContentfulPaint: 0,
  interactionToNextPaint: 0,
  largestContentfulPaint: 0,
  routeTransitionMs: 0,
  routeTransitions: [] as RouteTransitionMetric[],
}

let monitoringInitialized = false
let lastRouteTimestamp = performance.now()

export function initializePerformanceMonitoring() {
  if (monitoringInitialized || typeof PerformanceObserver === 'undefined') {
    return
  }

  monitoringInitialized = true

  observePerformanceEntries('paint', (entry) => {
    if (entry.name === 'first-contentful-paint') {
      metrics.firstContentfulPaint = entry.startTime
    }
  })

  observePerformanceEntries('largest-contentful-paint', (entry) => {
    metrics.largestContentfulPaint = entry.startTime
  })

  observePerformanceEntries('layout-shift', (entry) => {
    const shift = entry as LayoutShiftEntry

    if (!shift.hadRecentInput) {
      metrics.cumulativeLayoutShift += shift.value ?? 0
    }
  })

  observePerformanceEntries('event', (entry) => {
    const interaction = entry as InteractionEntry

    if ((interaction.interactionId ?? 0) > 0) {
      metrics.interactionToNextPaint = Math.max(
        metrics.interactionToNextPaint,
        interaction.duration ?? 0,
      )
    }
  })
}

export function recordRouteTransition(path: string) {
  const now = performance.now()
  const durationMs = Math.max(0, now - lastRouteTimestamp)

  lastRouteTimestamp = now
  metrics.routeTransitionMs = durationMs
  metrics.routeTransitions.push({
    durationMs,
    path,
    timestamp: Date.now(),
  })

  if (metrics.routeTransitions.length > 20) {
    metrics.routeTransitions.splice(0, metrics.routeTransitions.length - 20)
  }
}

export function getRumMetrics() {
  return {
    cumulativeLayoutShift: metrics.cumulativeLayoutShift,
    firstContentfulPaint: metrics.firstContentfulPaint,
    interactionToNextPaint: metrics.interactionToNextPaint,
    largestContentfulPaint: metrics.largestContentfulPaint,
    routeTransitionMs: metrics.routeTransitionMs,
    routeTransitions: metrics.routeTransitions.slice(-10),
  }
}

function observePerformanceEntries(
  type: string,
  onEntry: (entry: PerformanceEntry) => void,
) {
  const supported = PerformanceObserver.supportedEntryTypes || []

  if (!supported.includes(type)) {
    return
  }

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(onEntry)
    })

    observer.observe({ buffered: true, type })
  } catch {
    // Some browsers expose a supported entry type but reject buffered observers.
  }
}
