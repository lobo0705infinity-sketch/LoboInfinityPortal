import type { AuthSession } from './api'

export type LoboApiRequestDiagnostic = {
  action: string
  pipelineDiagnostics?: unknown
  caller: string
  durationMs: number
  error: string
  finishedAt: string
  method: 'GET' | 'POST'
  ok: boolean
  requestId: string
  responseSize: number
  retryCount: number
  route: string
  startedAt: string
  status: number
  url: string
}

export type LoboRouteDiagnostic = {
  durationMs: number
  error: string
  event:
    | 'chunkDownload'
    | 'chunkFailure'
    | 'finishedRender'
    | 'firstRender'
    | 'moduleEvaluated'
    | 'routeRequested'
    | 'routeUnmount'
  name: string
  pathname: string
  timestamp: string
}

export type LoboAuthTransition = {
  activeAuthTokenChanged: boolean
  currentRoute: string
  localStorageTokenChanged: boolean
  next: AuthSessionSnapshot
  previous: AuthSessionSnapshot
  reason: string
  refreshSessionRunning: boolean
  timestamp: string
}

export type LoboApplicationError = {
  auth: {
    authenticated: boolean
    code: string
    email: string
    player: string
    role: string
    stage: string
    status: string
  }
  browser: string
  buildVersion: string
  component: string
  componentStack: string
  errorId: string
  inFlightRequests: LoboApiRequestDiagnostic[]
  jsStack: string
  lazyChunk: string
  message: string
  name: string
  pathname: string
  route: string
  time: string
}

type AuthSessionSnapshot = {
  authenticated: boolean
  code: string
  email: string
  player: string
  role: string
  stage: string
}

type LoboDiagnosticsState = {
  apiRequests: LoboApiRequestDiagnostic[]
  appErrors: LoboApplicationError[]
  authTransitions: LoboAuthTransition[]
  inFlightRequests: Record<string, LoboApiRequestDiagnostic>
  routeDiagnostics: LoboRouteDiagnostic[]
  standings: Array<Record<string, unknown>>
}

declare global {
  interface Window {
    __loboDiagnostics?: LoboDiagnosticsState
  }
}

export function getDiagnosticsState(): LoboDiagnosticsState {
  if (typeof window === 'undefined') {
    return {
      apiRequests: [],
      appErrors: [],
      authTransitions: [],
      inFlightRequests: {},
      routeDiagnostics: [],
      standings: [],
    }
  }

  window.__loboDiagnostics ??= {
    apiRequests: [],
    appErrors: [],
    authTransitions: [],
    inFlightRequests: {},
    routeDiagnostics: [],
    standings: [],
  }

  return window.__loboDiagnostics
}

export function getBuildVersion() {
  return (
    import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ||
    import.meta.env.VITE_APP_VERSION ||
    'local'
  )
}

export function createRequestId(action: string) {
  return `${action}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function getCurrentRoute() {
  if (typeof window === 'undefined') {
    return 'unknown'
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function recordApiRequestStarted(request: LoboApiRequestDiagnostic) {
  const state = getDiagnosticsState()
  state.inFlightRequests[request.requestId] = request
}

export function recordApiRequestFinished(request: LoboApiRequestDiagnostic) {
  const state = getDiagnosticsState()
  delete state.inFlightRequests[request.requestId]
  pushLimited(state.apiRequests, request, 150)
}

export function getInFlightApiRequests() {
  return Object.values(getDiagnosticsState().inFlightRequests)
}

export function recordRouteDiagnostic(event: LoboRouteDiagnostic) {
  pushLimited(getDiagnosticsState().routeDiagnostics, event, 200)
}

export function recordAuthTransition(transition: LoboAuthTransition) {
  pushLimited(getDiagnosticsState().authTransitions, transition, 100)
  console.debug('[AuthContext] auth transition', transition)
}

export function recordStandingsDiagnostic(event: Record<string, unknown>) {
  pushLimited(
    getDiagnosticsState().standings,
    {
      ...event,
      pathname: typeof window === 'undefined' ? 'unknown' : window.location.pathname,
      timestamp: new Date().toISOString(),
    },
    100,
  )
}

export function buildAuthSessionSnapshot(session: AuthSession): AuthSessionSnapshot {
  return {
    authenticated: session.authenticated,
    code: session.code,
    email: session.user.email,
    player: session.user.leaguePlayer,
    role: session.user.role,
    stage: session.stage,
  }
}

export function appendApplicationError(error: LoboApplicationError) {
  pushLimited(getDiagnosticsState().appErrors, error, 25)
}

export function getBrowserSummary() {
  if (typeof navigator === 'undefined') {
    return 'unknown'
  }

  return navigator.userAgent
}

function pushLimited<T>(items: T[], item: T, limit: number) {
  items.push(item)

  if (items.length > limit) {
    items.splice(0, items.length - limit)
  }
}
