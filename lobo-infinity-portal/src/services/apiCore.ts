export type ApiOptions = {
  eventId?: string
  signal?: AbortSignal
}

import { isLikelyGoogleJwt } from '../auth/googleJwt'
import {
  createRequestId,
  getCurrentRoute,
  recordApiRequestFinished,
  recordApiRequestStarted,
  type LoboApiRequestDiagnostic,
} from './diagnostics'

type RequestParams = Record<string, string>

type CacheEntry = {
  expiresAt: number
  payload: unknown
}

type SessionCacheEntry = {
  version: string
  timestamp: number
  cacheKey: string
  eventId: string
  expiresAt: number
  data: unknown
}

type CredentialShapeDiagnostic = {
  credentialLength: number
  credentialPreviewEnd: string
  credentialPreviewStart: string
  credentialSha256: string
  credentialStartsWithEyJ: boolean
  format: 'jwt' | 'not_jwt'
  hasWhitespace: boolean
  headerLength: number
  partCount: number
  payloadLength: number
  signatureLength: number
}

type CredentialTransportDiagnostic = {
  action: string
  caller: string
  fields: {
    authToken: boolean
    credential: boolean
    idToken: boolean
  }
  source: 'authToken' | 'idToken' | 'credential' | ''
  stage: string
  timestamp: number
  token: CredentialShapeDiagnostic
  transport: 'GET' | 'POST'
}

type SessionRecoveryHandler = () => Promise<boolean>

declare global {
  interface Window {
    __loboCredentialTransportDiagnostics?: CredentialTransportDiagnostic[]
  }
}

export type ApiTimingMetric = {
  action: string
  cache: 'hit' | 'miss' | 'shared' | 'mutation'
  durationMs: number
  ok: boolean
  startTimeMs: number
  endTimeMs: number
  timestamp: number
}

export type ApiRequestAuditEntry = {
  action: string
  cache: ApiTimingMetric['cache']
  cacheKey: string
  caller: string
  durationMs: number
  startTimeMs: number
  endTimeMs: number
  timestamp: number
  ok: boolean
  blocking: boolean
  canMerge: boolean
  duplicate: boolean
  routePath: string
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
let activeAuthTokenVersion = 0
let sessionRecoveryHandler: SessionRecoveryHandler | null = null
let pendingSessionRecovery: Promise<boolean> | null = null

const frontendCacheTtlMs = 300_000
const sessionCacheVersion = 'v13.0'
const sessionCachePrefix = `lobo-api-cache:${sessionCacheVersion}:`
const sessionCacheLegacyPrefix = 'lobo-api-cache:'
const frontendResponseCache = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<unknown>>()
const apiTimingMetrics: ApiTimingMetric[] = []
const apiRequestHistory: ApiRequestAuditEntry[] = []
const clientDiagnosticMetrics: ClientDiagnosticMetric[] = []
const friendlySessionExpiredMessage = 'Session expired.'

let sessionCacheInitialized = false
let sessionCacheHits = 0
let sessionCacheMisses = 0
let sessionCacheWrites = 0
let sessionCacheClears = 0
let lastSessionRestoreMs = 0

export function setApiAuthToken(token: string) {
  if (token && !isLikelyGoogleJwt(token)) {
    activeAuthToken = ''
    activeAuthTokenVersion += 1
    frontendResponseCache.clear()
    inFlightRequests.clear()
    clearSessionResponseCache('invalid_api_token')
    void recordInvalidApiTokenRejected(token)
    recordClientDiagnostic(
      'invalidApiTokenRejected',
      'failure',
      0,
      'setApiAuthToken:invalid_google_jwt_shape',
    )
    return
  }

  if (!token) {
    clearSessionResponseCache('auth_token_cleared')
  } else if (activeAuthToken && activeAuthToken !== token) {
    clearSessionResponseCache('auth_token_changed')
  }

  activeAuthToken = token
  activeAuthTokenVersion += 1
  frontendResponseCache.clear()
  inFlightRequests.clear()
}

export function getActiveAuthTokenVersion() {
  return activeAuthTokenVersion
}

export function setSessionRecoveryHandler(handler: SessionRecoveryHandler | null) {
  sessionRecoveryHandler = handler
}

export function setApiOAuthClientId(clientId: string) {
  activeOAuthClientId = clientId
}

export async function request(
  action: string,
  options: ApiOptions = {},
  params: RequestParams = {},
): Promise<unknown> {
  return requestInternal(action, options, params, false)
}

async function requestInternal(
  action: string,
  options: ApiOptions,
  params: RequestParams,
  retriedAfterSessionRecovery: boolean,
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
  const sessionCacheKey = buildSessionCacheKey(action, params)
  const eventId = options.eventId ?? params.eventId ?? ''
  const routePath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : 'unknown'
  const caller = inferApiCaller()
  const duplicate = apiRequestHistory.some((entry) => entry.cacheKey === cacheKey)
  const cached = frontendResponseCache.get(cacheKey)
  const canShareInFlightRequest = !options.signal

  if (cached && cached.expiresAt > Date.now()) {
    const now = performance.now()
    recordApiTiming(action, 'hit', 0, true, now, now, cacheKey, routePath, caller, duplicate)
    return cached.payload
  }

  const sessionCached = readSessionResponseCache(sessionCacheKey)

  if (sessionCached) {
    frontendResponseCache.set(cacheKey, {
      expiresAt: sessionCached.expiresAt,
      payload: sessionCached.data,
    })
    const now = performance.now()
    recordApiTiming(action, 'hit', 0, true, now, now, cacheKey, routePath, caller, duplicate)
    return sessionCached.data
  }

  const inFlight = canShareInFlightRequest
    ? inFlightRequests.get(cacheKey)
    : null

  if (inFlight) {
    const now = performance.now()
    recordApiTiming(action, 'shared', 0, true, now, now, cacheKey, routePath, caller, duplicate)
    return inFlight
  }

  if (activeAuthToken) {
    await recordCredentialTransportDiagnostic(
      'requestBeforeFetch',
      action,
      'GET',
      caller,
      {
        authToken: activeAuthToken,
      },
    )
  }

  const requestId = createRequestId(action)
  const requestStartedAt = new Date().toISOString()
  const requestDiagnosticBase = buildApiRequestDiagnostic({
    action,
    caller,
    method: 'GET',
    requestId,
    startedAt: requestStartedAt,
    url: redactUrl(url.toString()),
  })
  recordApiRequestStarted(requestDiagnosticBase)

  const start = performance.now()
  let requestFinished = false
  const pending = fetch(url, {
    signal: options.signal,
  })
    .then(async (response) => {
      const responseText = await response.text()
      const payload = parseApiResponseText(responseText, action)
      requestFinished = true
      recordApiRequestFinished({
        ...requestDiagnosticBase,
        durationMs: Math.round(performance.now() - start),
        error: response.ok ? '' : readApiPayloadError(payload),
        finishedAt: new Date().toISOString(),
        ok: response.ok,
        pipelineDiagnostics: readPipelineDiagnostics(payload),
        responseSize: responseText.length,
        status: response.status,
      })

      if (!response.ok) {
        throw new Error(`${action} request failed with status ${response.status}`)
      }

      if (isExpiredCredentialPayload(payload)) {
        if (
          action !== 'session' &&
          !retriedAfterSessionRecovery &&
          !options.signal?.aborted
        ) {
          const recovered = await recoverExpiredSession()

          if (recovered) {
            return requestInternal(action, options, params, true)
          }
        }

        throw new Error(friendlySessionExpiredMessage)
      }

      frontendResponseCache.set(cacheKey, {
        expiresAt: Date.now() + frontendCacheTtlMs,
        payload,
      })
      writeSessionResponseCache(sessionCacheKey, eventId, payload)
      const end = performance.now()
      recordApiTiming(action, 'miss', end - start, true, start, end, cacheKey, routePath, caller, duplicate)

      return payload
    })
    .catch((error) => {
      const end = performance.now()
      if (!requestFinished) {
        recordApiRequestFinished({
          ...requestDiagnosticBase,
          durationMs: Math.round(end - start),
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date().toISOString(),
          ok: false,
          responseSize: 0,
          status: 0,
        })
      }
      recordApiTiming(action, 'miss', end - start, false, start, end, cacheKey, routePath, caller, duplicate)
      throw error
    })
    .finally(() => {
      if (canShareInFlightRequest) {
        inFlightRequests.delete(cacheKey)
      }
    })

  if (canShareInFlightRequest) {
    inFlightRequests.set(cacheKey, pending)
  }

  return pending
}

export async function postRequest(
  action: string,
  options: ApiOptions,
  params: RequestParams,
): Promise<unknown> {
  return postRequestInternal(action, options, params, false)
}

async function postRequestInternal(
  action: string,
  options: ApiOptions,
  params: RequestParams,
  retriedAfterSessionRecovery: boolean,
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

  if (action !== 'heartbeat') {
    frontendResponseCache.clear()
    inFlightRequests.clear()
    clearSessionResponseCache(`mutation:${action}`)
  }

  const cacheKey = `${url.toString()}|${body.toString()}`
  const routePath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : 'unknown'
  const caller = inferApiCaller()
  const duplicate = apiRequestHistory.some((entry) => entry.cacheKey === cacheKey)
  await recordCredentialTransportDiagnostic(
    'postRequestUrlSearchParamsBuilt',
    action,
    'POST',
    caller,
    {
      authToken: body.get('authToken') ?? '',
      credential: body.get('credential') ?? '',
      idToken: body.get('idToken') ?? '',
    },
  )
  await recordCredentialTransportDiagnostic(
    'postRequestBeforeFetch',
    action,
    'POST',
    caller,
    {
      authToken: body.get('authToken') ?? '',
      credential: body.get('credential') ?? '',
      idToken: body.get('idToken') ?? '',
    },
  )
  const requestId = createRequestId(action)
  const requestStartedAt = new Date().toISOString()
  const requestDiagnosticBase = buildApiRequestDiagnostic({
    action,
    caller,
    method: 'POST',
    requestId,
    startedAt: requestStartedAt,
    url: redactUrl(url.toString()),
  })
  recordApiRequestStarted(requestDiagnosticBase)
  const start = performance.now()
  let response: Response
  let responseText = ''
  let payload: unknown

  try {
    response = await fetch(url, {
      body,
      method: 'POST',
      signal: options.signal,
    })
    responseText = await response.text()
    payload = parseApiResponseText(responseText, action)
  } catch (error) {
    const end = performance.now()
    recordApiRequestFinished({
      ...requestDiagnosticBase,
      durationMs: Math.round(end - start),
      error: error instanceof Error ? error.message : String(error),
      finishedAt: new Date().toISOString(),
      ok: false,
      responseSize: responseText.length,
      status: 0,
    })
    recordApiTiming(action, 'mutation', end - start, false, start, end, cacheKey, routePath, caller, duplicate)
    throw error
  }

  const end = performance.now()

  recordApiRequestFinished({
    ...requestDiagnosticBase,
    durationMs: Math.round(end - start),
    error: response.ok ? '' : readApiPayloadError(payload),
    finishedAt: new Date().toISOString(),
    ok: response.ok,
    pipelineDiagnostics: readPipelineDiagnostics(payload),
    responseSize: responseText.length,
    status: response.status,
  })

  recordApiTiming(action, 'mutation', end - start, response.ok, start, end, cacheKey, routePath, caller, duplicate)

  if (!response.ok) {
    throw new Error(`${action} request failed with status ${response.status}`)
  }

  if (isExpiredCredentialPayload(payload)) {
    if (
      action !== 'session' &&
      !retriedAfterSessionRecovery &&
      !options.signal?.aborted
    ) {
      const recovered = await recoverExpiredSession()

      if (recovered) {
        return postRequestInternal(action, options, params, true)
      }
    }

    throw new Error(friendlySessionExpiredMessage)
  }

  return payload
}

async function recoverExpiredSession() {
  if (!sessionRecoveryHandler) {
    return false
  }

  pendingSessionRecovery ??= sessionRecoveryHandler()
    .catch(() => false)
    .finally(() => {
      pendingSessionRecovery = null
    })

  return pendingSessionRecovery
}

function buildApiRequestDiagnostic({
  action,
  caller,
  method,
  requestId,
  startedAt,
  url,
}: Pick<
  LoboApiRequestDiagnostic,
  'action' | 'caller' | 'method' | 'requestId' | 'startedAt' | 'url'
>): LoboApiRequestDiagnostic {
  return {
    action,
    caller,
    durationMs: 0,
    error: '',
    finishedAt: '',
    method,
    ok: false,
    requestId,
    responseSize: 0,
    retryCount: 0,
    route: getCurrentRoute(),
    startedAt,
    status: 0,
    url,
  }
}

function parseApiResponseText(responseText: string, action: string) {
  try {
    return JSON.parse(responseText) as unknown
  } catch (error) {
    throw new Error(
      `${action} response could not be parsed as JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      {
        cause: error,
      },
    )
  }
}

function readApiPayloadError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const record = payload as Record<string, unknown>
  return typeof record.error === 'string' ? record.error : ''
}

function isExpiredCredentialPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const record = payload as Record<string, unknown>
  const code = typeof record.code === 'string' ? record.code : ''

  return record.success === false && code === 'AUTH_GOOGLE_TOKEN_EXPIRED'
}

function readPipelineDiagnostics(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  const record = payload as Record<string, unknown>
  return record.pipelineDiagnostics
}

function redactUrl(value: string) {
  const url = new URL(value)
  url.searchParams.delete('authToken')
  url.searchParams.delete('credential')
  url.searchParams.delete('idToken')
  return url.toString()
}

function buildSessionCacheKey(action: string, params: RequestParams) {
  const serializedParams = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  return `${action}?${serializedParams}`
}

function getSessionStorageKey(cacheKey: string) {
  return `${sessionCachePrefix}${hashCacheKey(cacheKey)}`
}

function readSessionResponseCache(cacheKey: string): SessionCacheEntry | null {
  initializeSessionResponseCache()

  if (typeof window === 'undefined') {
    return null
  }

  const startedAt = performance.now()

  try {
    const raw = window.sessionStorage.getItem(getSessionStorageKey(cacheKey))

    if (!raw) {
      sessionCacheMisses += 1
      return null
    }

    const entry = JSON.parse(raw) as SessionCacheEntry

    if (
      entry.version !== sessionCacheVersion ||
      entry.cacheKey !== cacheKey ||
      entry.expiresAt <= Date.now()
    ) {
      window.sessionStorage.removeItem(getSessionStorageKey(cacheKey))
      sessionCacheMisses += 1
      return null
    }

    sessionCacheHits += 1
    lastSessionRestoreMs = performance.now() - startedAt
    recordClientDiagnostic(
      'sessionCacheRestore',
      'success',
      lastSessionRestoreMs,
      cacheKey,
    )
    return entry
  } catch (error) {
    sessionCacheMisses += 1
    recordClientDiagnostic(
      'sessionCacheRestore',
      'failure',
      performance.now() - startedAt,
      error instanceof Error ? error.message : String(error),
    )
    return null
  }
}

function writeSessionResponseCache(
  cacheKey: string,
  eventId: string,
  data: unknown,
) {
  initializeSessionResponseCache()

  if (typeof window === 'undefined') {
    return
  }

  const timestamp = Date.now()
  const entry: SessionCacheEntry = {
    version: sessionCacheVersion,
    timestamp,
    cacheKey,
    eventId,
    expiresAt: timestamp + frontendCacheTtlMs,
    data,
  }

  try {
    window.sessionStorage.setItem(
      getSessionStorageKey(cacheKey),
      JSON.stringify(entry),
    )
    sessionCacheWrites += 1
  } catch (error) {
    recordClientDiagnostic(
      'sessionCacheWrite',
      'failure',
      0,
      error instanceof Error ? error.message : String(error),
    )
  }
}

function clearSessionResponseCache(reason: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const keysToRemove: string[] = []

    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index)
      if (key?.startsWith(sessionCacheLegacyPrefix)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key))
    sessionCacheClears += 1
    recordClientDiagnostic(
      'sessionCacheCleared',
      'success',
      0,
      `${reason}:${keysToRemove.length}`,
    )
  } catch (error) {
    recordClientDiagnostic(
      'sessionCacheCleared',
      'failure',
      0,
      error instanceof Error ? error.message : String(error),
    )
  }
}

function initializeSessionResponseCache() {
  if (sessionCacheInitialized || typeof window === 'undefined') {
    return
  }

  sessionCacheInitialized = true

  try {
    const keysToRemove: string[] = []

    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index)
      if (
        key?.startsWith(sessionCacheLegacyPrefix) &&
        !key.startsWith(sessionCachePrefix)
      ) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key))
  } catch {
    // Session storage is optional. The in-memory cache remains authoritative.
  }
}

function hashCacheKey(value: string) {
  let hash = 5381

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }

  return (hash >>> 0).toString(36)
}

async function recordCredentialTransportDiagnostic(
  stage: string,
  action: string,
  transport: 'GET' | 'POST',
  caller: string,
  fields: {
    authToken?: string
    credential?: string
    idToken?: string
  },
) {
  if (typeof window === 'undefined') {
    return
  }

  const authToken = fields.authToken ?? ''
  const idToken = fields.idToken ?? ''
  const credential = fields.credential ?? ''
  const source = authToken
    ? 'authToken'
    : idToken
      ? 'idToken'
      : credential
        ? 'credential'
        : ''
  const token = source ? fields[source] ?? '' : ''

  if (!token) {
    return
  }

  const diagnostic: CredentialTransportDiagnostic = {
    action,
    caller,
    fields: {
      authToken: authToken !== '',
      credential: credential !== '',
      idToken: idToken !== '',
    },
    source,
    stage,
    timestamp: Date.now(),
    token: await getCredentialShapeDiagnostic(token),
    transport,
  }

  const diagnostics = window.__loboCredentialTransportDiagnostics ?? []
  diagnostics.push(diagnostic)

  if (diagnostics.length > 100) {
    diagnostics.splice(0, diagnostics.length - 100)
  }

  window.__loboCredentialTransportDiagnostics = diagnostics
}

async function recordInvalidApiTokenRejected(token: string) {
  if (typeof window === 'undefined') {
    return
  }

  const diagnostics = window.__loboCredentialTransportDiagnostics ?? []
  diagnostics.push({
    action: 'setApiAuthToken',
    caller: inferApiCaller(),
    fields: {
      authToken: true,
      credential: false,
      idToken: false,
    },
    source: 'authToken',
    stage: 'invalidApiTokenRejected',
    timestamp: Date.now(),
    token: await getCredentialShapeDiagnostic(token),
    transport: 'POST',
  })

  if (diagnostics.length > 100) {
    diagnostics.splice(0, diagnostics.length - 100)
  }

  window.__loboCredentialTransportDiagnostics = diagnostics
}

async function getCredentialShapeDiagnostic(token: string): Promise<CredentialShapeDiagnostic> {
  const parts = token.split('.')

  return {
    credentialLength: token.length,
    credentialPreviewEnd: token.slice(-8),
    credentialPreviewStart: token.slice(0, 8),
    credentialSha256: await hashCredential(token),
    credentialStartsWithEyJ: token.startsWith('eyJ'),
    format: parts.length === 3 ? 'jwt' : 'not_jwt',
    hasWhitespace: /\s/.test(token),
    headerLength: parts[0]?.length ?? 0,
    partCount: parts.length,
    payloadLength: parts[1]?.length ?? 0,
    signatureLength: parts[2]?.length ?? 0,
  }
}

async function hashCredential(token: string) {
  if (!window.crypto?.subtle) {
    return ''
  }

  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function getApiDiagnostics() {
  const metrics = [...apiTimingMetrics]
  const completed = metrics.filter((metric) => metric.durationMs > 0)
  const cacheHits = metrics.filter((metric) => metric.cache === 'hit').length
  const cacheMisses = metrics.filter((metric) => metric.cache === 'miss').length
  const sharedRequests = metrics.filter((metric) => metric.cache === 'shared').length
  const readRequestCount = metrics.filter((metric) => metric.cache !== 'mutation').length
  const recentRequests = apiRequestHistory.slice(-50)
  const duplicateRequests = recentRequests.filter((entry) => entry.duplicate)
  const duplicateGroups = recentRequests.reduce((groups, entry) => {
    if (!entry.duplicate) {
      return groups
    }

    const existing = groups.find((group) => group.cacheKey === entry.cacheKey)

    if (existing) {
      existing.count += 1
    } else {
      groups.push({
        cacheKey: entry.cacheKey,
        action: entry.action,
        routePath: entry.routePath,
        count: 1,
        lastDurationMs: entry.durationMs,
        lastTimestamp: entry.timestamp,
      })
    }

    return groups
  }, [] as Array<{
    cacheKey: string
    action: string
    routePath: string
    count: number
    lastDurationMs: number
    lastTimestamp: number
  }>)

  const topDuplicateRequests = duplicateGroups
    .slice()
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)

  return {
    cacheHitRatio:
      readRequestCount > 0 ? Math.round((cacheHits / readRequestCount) * 100) : 0,
    cacheHits,
    cacheMisses,
    sessionCache: {
      clears: sessionCacheClears,
      hitRatio:
        sessionCacheHits + sessionCacheMisses > 0
          ? Math.round(
              (sessionCacheHits / (sessionCacheHits + sessionCacheMisses)) * 100,
            )
          : 0,
      hits: sessionCacheHits,
      lastRestoreMs: Math.round(lastSessionRestoreMs),
      misses: sessionCacheMisses,
      version: sessionCacheVersion,
      writes: sessionCacheWrites,
    },
    client: {
      recent: clientDiagnosticMetrics.slice(-25),
    },
    recent: metrics.slice(-25),
    requestCount: metrics.length,
    recentRequests,
    duplicateRequestCount: duplicateRequests.length,
    topDuplicateRequests,
    uniqueCacheKeyCount: new Set(recentRequests.map((request) => request.cacheKey)).size,
    requestCountByRoute: recentRequests.reduce(
      (summary, request) => {
        const route = request.routePath
        if (!summary[route]) {
          summary[route] = []
        }
        summary[route].push(request)
        return summary
      },
      {} as Record<string, ApiRequestAuditEntry[]>,
    ),
    requestsThatCanBeCombined: duplicateGroups.map((group) => ({
      action: group.action,
      routePath: group.routePath,
      count: group.count,
      totalDurationMs: group.lastDurationMs * group.count,
      cacheKey: group.cacheKey,
    })),
    estimatedImprovementMs: duplicateRequests.reduce(
      (sum, request) => sum + request.durationMs,
      0,
    ),
    sharedRequests,
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

export function inferApiCaller() {
  if (typeof Error === 'undefined' || typeof window === 'undefined') {
    return 'unknown'
  }

  const stack = new Error().stack

  if (!stack) {
    return 'unknown'
  }

  const lines = stack.split('\n').slice(1)

  for (const line of lines) {
    const trimmed = line.trim()

    if (
      trimmed.includes('/src/services/apiCore.ts') ||
      trimmed.includes('apiCore.ts') ||
      trimmed.includes('/src/services/api.ts') ||
      trimmed.includes('api.ts')
    ) {
      continue
    }

    if (trimmed.startsWith('at ')) {
      return trimmed.replace(/^at\s+/, '')
    }
  }

  return lines[0]?.trim().replace(/^at\s+/, '') ?? 'unknown'
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
  startTimeMs: number,
  endTimeMs: number,
  cacheKey: string,
  routePath: string,
  caller: string,
  duplicate: boolean,
) {
  apiTimingMetrics.push({
    action,
    cache,
    durationMs: Math.round(durationMs),
    ok,
    startTimeMs: Math.round(startTimeMs),
    endTimeMs: Math.round(endTimeMs),
    timestamp: Date.now(),
  })

  apiRequestHistory.push({
    action,
    cache,
    cacheKey,
    caller,
    durationMs: Math.round(durationMs),
    startTimeMs: Math.round(startTimeMs),
    endTimeMs: Math.round(endTimeMs),
    timestamp: Date.now(),
    ok,
    blocking:
      typeof document !== 'undefined'
        ? document.readyState !== 'complete'
        : false,
    canMerge: duplicate || cache === 'shared',
    duplicate,
    routePath,
  })

  if (apiTimingMetrics.length > 100) {
    apiTimingMetrics.splice(0, apiTimingMetrics.length - 100)
  }
  if (apiRequestHistory.length > 200) {
    apiRequestHistory.splice(0, apiRequestHistory.length - 200)
  }
}
