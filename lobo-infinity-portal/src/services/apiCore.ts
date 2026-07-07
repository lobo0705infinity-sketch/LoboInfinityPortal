export type ApiOptions = {
  signal?: AbortSignal
}

type RequestParams = Record<string, string>

type CacheEntry = {
  expiresAt: number
  payload: unknown
}

export type ApiTimingMetric = {
  action: string
  cache: 'hit' | 'miss' | 'shared' | 'mutation'
  durationMs: number
  ok: boolean
  timestamp: number
}

export type ClientDiagnosticMetric = {
  detail: string
  durationMs: number
  event: string
  status:
    | 'attempt'
    | 'failure'
    | 'outgoing_refresh_failed'
    | 'runtime_invariant_failed'
    | 'success'
    | 'verification_failed'
  timestamp: number
}

export const API_URL =
  'https://script.google.com/macros/s/AKfycbxBzo57XHrxiBy1EJq4f_VS026uTXnCYHSXrWT6c2uU__zSB2Dzeixx3rFHQahXQycCng/exec'

let activeAuthToken = ''
let activeOAuthClientId = ''

const frontendCacheTtlMs = 300_000
const frontendResponseCache = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<unknown>>()
const apiTimingMetrics: ApiTimingMetric[] = []
const clientDiagnosticMetrics: ClientDiagnosticMetric[] = []

export function setApiAuthToken(token: string) {
  activeAuthToken = token
  frontendResponseCache.clear()
  inFlightRequests.clear()
}

export function setApiOAuthClientId(clientId: string) {
  activeOAuthClientId = clientId
}

export async function request(
  action: string,
  options: ApiOptions = {},
  params: RequestParams = {},
): Promise<unknown> {
  const url = new URL(API_URL)
  url.searchParams.set('action', action)

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  if (activeAuthToken) {
    url.searchParams.set('authToken', activeAuthToken)
  }

  if (activeOAuthClientId) {
    url.searchParams.set('oauthClientId', activeOAuthClientId)
  }

  const cacheKey = url.toString()
  const cached = frontendResponseCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    recordApiTiming(action, 'hit', 0, true)
    return cached.payload
  }

  const inFlight = inFlightRequests.get(cacheKey)

  if (inFlight) {
    recordApiTiming(action, 'shared', 0, true)
    return inFlight
  }

  const start = performance.now()
  const pending = fetch(url, {
    signal: options.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`${action} request failed with status ${response.status}`)
      }

      const payload = (await response.json()) as unknown

      frontendResponseCache.set(cacheKey, {
        expiresAt: Date.now() + frontendCacheTtlMs,
        payload,
      })
      recordApiTiming(action, 'miss', performance.now() - start, true)

      return payload
    })
    .catch((error) => {
      recordApiTiming(action, 'miss', performance.now() - start, false)
      throw error
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey)
    })

  inFlightRequests.set(cacheKey, pending)

  return pending
}

export async function postRequest(
  action: string,
  options: ApiOptions,
  params: RequestParams,
): Promise<unknown> {
  const url = new URL(API_URL)
  url.searchParams.set('action', action)

  const body = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    body.set(key, value)
  })

  if (activeAuthToken) {
    body.set('authToken', activeAuthToken)
  }

  if (activeOAuthClientId) {
    body.set('oauthClientId', activeOAuthClientId)
  }

  frontendResponseCache.clear()
  inFlightRequests.clear()

  const start = performance.now()
  const response = await fetch(url, {
    body,
    method: 'POST',
    signal: options.signal,
  })

  recordApiTiming(action, 'mutation', performance.now() - start, response.ok)

  if (!response.ok) {
    throw new Error(`${action} request failed with status ${response.status}`)
  }

  return response.json() as Promise<unknown>
}

export function getApiDiagnostics() {
  const metrics = [...apiTimingMetrics]
  const completed = metrics.filter((metric) => metric.durationMs > 0)
  const cacheHits = metrics.filter((metric) => metric.cache === 'hit').length
  const cacheMisses = metrics.filter((metric) => metric.cache === 'miss').length

  return {
    cacheHits,
    cacheMisses,
    client: {
      recent: clientDiagnosticMetrics.slice(-25),
    },
    recent: metrics.slice(-25),
    requestCount: metrics.length,
    averageDurationMs:
      completed.length > 0
        ? completed.reduce((total, metric) => total + metric.durationMs, 0) /
          completed.length
        : 0,
    slowest: completed
      .slice()
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 5),
  }
}

export function recordClientDiagnostic(
  event: string,
  status: ClientDiagnosticMetric['status'],
  durationMs: number,
  detail = '',
) {
  clientDiagnosticMetrics.push({
    detail,
    durationMs: Math.round(durationMs),
    event,
    status,
    timestamp: Date.now(),
  })

  if (clientDiagnosticMetrics.length > 100) {
    clientDiagnosticMetrics.splice(0, clientDiagnosticMetrics.length - 100)
  }
}

function recordApiTiming(
  action: string,
  cache: ApiTimingMetric['cache'],
  durationMs: number,
  ok: boolean,
) {
  apiTimingMetrics.push({
    action,
    cache,
    durationMs: Math.round(durationMs),
    ok,
    timestamp: Date.now(),
  })

  if (apiTimingMetrics.length > 100) {
    apiTimingMetrics.splice(0, apiTimingMetrics.length - 100)
  }
}
