/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  type AuthSession,
  type PortalPermissions,
  type PortalUser,
  type UserRole,
} from '../services/api'
import { getSession, getSettings } from '../services/lightApi'
import {
  getActiveAuthTokenVersion,
  recordClientDiagnostic,
  setApiAuthToken,
  setApiOAuthClientId,
  setSessionRecoveryHandler,
} from '../services/apiCore'
import {
  buildAuthSessionSnapshot,
  getCurrentRoute,
  recordAuthTransition,
} from '../services/diagnostics'
import {
  signOutOfFirebase,
} from '../firebase/firebaseAuthBridge'
import {
  clearCachedIdentityReport,
  getCachedIdentityReport,
  synchronizeIdentity,
  type UnifiedIdentityReport,
} from '../services/identity/IdentityService'
import { isLikelyGoogleJwt } from './googleJwt'

type GoogleCredentialResponse = {
  credential?: string
}

type GooglePromptNotification = {
  getDismissedReason?: () => string
  getMomentType?: () => string
  getNotDisplayedReason?: () => string
  getSkippedReason?: () => string
  isDismissedMoment?: () => boolean
  isDisplayed?: () => boolean
  isNotDisplayed?: () => boolean
  isSkippedMoment?: () => boolean
}

type GoogleAccounts = {
  id: {
    cancel: () => void
    initialize: (config: {
      auto_select?: boolean
      callback: (response: GoogleCredentialResponse) => void
      client_id: string
    }) => void
    prompt: (callback?: (notification: GooglePromptNotification) => void) => void
    renderButton: (
      element: HTMLElement,
      options: {
        shape?: string
        size?: string
        text?: string
        theme?: string
        type?: string
      },
    ) => void
  }
}

declare global {
  interface Window {
    __loboAuthDiagnostics?: AuthFlowDiagnostics
    google?: {
      accounts: GoogleAccounts
    }
  }
}

type AuthContextValue = {
  authenticated: boolean
  authState: 'authenticated' | 'initializing' | 'unauthenticated'
  code: string
  diagnostics: Record<string, unknown>
  error: string
  googleReady: boolean
  hasPermission: (permission: string) => boolean
  identity: UnifiedIdentityReport | null
  initialization: AuthInitializationMetrics
  isAtLeastRole: (role: UserRole) => boolean
  oauthConfigured: boolean
  permissions: PortalPermissions
  refreshSession: () => Promise<boolean>
  renderSignInButton: (element: HTMLElement) => void
  signOut: () => void
  stage: string
  status: 'loading' | 'ready'
  user: PortalUser
}

type AuthFlowFailure = {
  appsScriptRejectedCredential: boolean
  automaticBrowserRetry: boolean
  code: string
  gisReturnedCredential: boolean
  message: string
  retryCount: number
  stage: string
  timestamp: string
}

type AuthFlowEvent = {
  detail?: Record<string, unknown>
  elapsedMs: number
  event: string
  timestamp: string
}

type AuthFlowDiagnostics = {
  automaticBrowserRetryCount: number
  events: AuthFlowEvent[]
  failures: AuthFlowFailure[]
  gisReturnedCredential: boolean
  retryCount: number
  timings: {
    authContextStateUpdateMs: number
    gisButtonInteractiveMs: number
    gisClickToCredentialMs: number
    gisLibraryLoadMs: number
    portalAuthenticatedMs: number
  }
}

type AuthInitializationMetrics = {
  completedAt: string
  googleCredentialMs: number
  googleReadyMs: number
  sessionVerificationMs: number
  settingsMs: number
  totalMs: number
}

const roleOrder: UserRole[] = [
  'Guest',
  'League Member',
  'Assistant Commissioner',
  'Commissioner',
]

const guestUser: PortalUser = {
  email: '',
  displayName: 'Guest',
  leaguePlayer: '',
  playerDisplayName: '',
  leagueDivision: '',
  role: 'Guest',
  enabled: false,
  favoriteFaction: '',
  avatarUrl: '',
  created: '',
  lastLogin: '',
  lastSeen: '',
  notificationPreferences: {},
  themePreference: 'system',
  dismissedAlerts: [],
  readAlerts: [],
  archivedAlerts: [],
  lastPage: '',
  searchHistory: [],
}

const AuthContext = createContext<AuthContextValue | null>(null)

const authStorageKey = 'lobo-google-id-token'
const googleInitializationTimeoutMs = 1200

const initialInitializationMetrics: AuthInitializationMetrics = {
  completedAt: '',
  googleCredentialMs: 0,
  googleReadyMs: 0,
  sessionVerificationMs: 0,
  settingsMs: 0,
  totalMs: 0,
}

const initialAuthFlowDiagnostics: AuthFlowDiagnostics = {
  automaticBrowserRetryCount: 0,
  events: [],
  failures: [],
  gisReturnedCredential: false,
  retryCount: 0,
  timings: {
    authContextStateUpdateMs: 0,
    gisButtonInteractiveMs: 0,
    gisClickToCredentialMs: 0,
    gisLibraryLoadMs: 0,
    portalAuthenticatedMs: 0,
  },
}

const terminalAuthCodes = new Set([
  'AUTH_EMAIL_UNVERIFIED',
  'AUTH_GOOGLE_TOKEN_AUDIENCE_MISMATCH',
  'AUTH_GOOGLE_TOKEN_EXPIRED',
  'AUTH_GOOGLE_TOKEN_INVALID',
  'AUTH_GOOGLE_TOKEN_MISSING',
  'AUTH_GOOGLE_TOKEN_MALFORMED',
  'AUTH_OAUTH_CLIENT_MISSING',
])

const friendlySessionExpiredMessage = 'Session expired.'

function shouldClearStoredAuthToken(code: string) {
  return code === '' || terminalAuthCodes.has(code)
}

function getJwtFormatDiagnostics(token: string) {
  const parts = token.split('.')

  return {
    credentialLength: token.length,
    credentialPreviewEnd: token.slice(-8),
    credentialPreviewStart: token.slice(0, 8),
    credentialStartsWithEyJ: token.startsWith('eyJ'),
    headerLength: parts[0]?.length ?? 0,
    payloadLength: parts[1]?.length ?? 0,
    signatureLength: parts[2]?.length ?? 0,
    partCount: parts.length,
    format: parts.length === 3 ? 'jwt' : 'not_jwt',
    hasWhitespace: /\s/.test(token),
  }
}

async function getCredentialDiagnostics(token: string) {
  const diagnostics = getJwtFormatDiagnostics(token)

  if (!window.crypto?.subtle) {
    return {
      ...diagnostics,
      credentialSha256: '',
    }
  }

  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )

  return {
    ...diagnostics,
    credentialSha256: Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    authenticated: false,
    code: '',
    diagnostics: {},
    error: '',
    oauthConfigured: false,
    permissions: {},
    stage: '',
    user: guestUser,
  })
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [googleReady, setGoogleReady] = useState(false)
  const [identity, setIdentity] = useState<UnifiedIdentityReport | null>(
    getCachedIdentityReport,
  )
  const [initialization, setInitialization] = useState<AuthInitializationMetrics>(
    initialInitializationMetrics,
  )
  const [authFlowDiagnostics, setAuthFlowDiagnostics] = useState<AuthFlowDiagnostics>(
    initialAuthFlowDiagnostics,
  )
  const clientIdRef = useRef(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')
  const googleInitializedClientIdRef = useRef('')
  const googlePromptedRef = useRef(false)
  const googleScriptRequestedRef = useRef(false)
  const authFlowStartedAtRef = useRef(performance.now())
  const lastButtonClickAtRef = useRef(0)
  const pendingStateUpdateAtRef = useRef(0)
  const retryCountRef = useRef(0)
  const browserRetryCountRef = useRef(0)
  const previousSessionRef = useRef(session)
  const previousStorageTokenRef = useRef(
    typeof window === 'undefined'
      ? ''
      : window.localStorage.getItem(authStorageKey) ?? '',
  )
  const previousAuthTokenVersionRef = useRef(getActiveAuthTokenVersion())
  const refreshSessionRunningRef = useRef(false)
  const authTransitionReasonRef = useRef('initial')

  const updateAuthFlowDiagnostics = useCallback((
    updater: (current: AuthFlowDiagnostics) => AuthFlowDiagnostics,
  ) => {
    setAuthFlowDiagnostics((current) => {
      const next = updater(current)
      window.__loboAuthDiagnostics = next
      return next
    })
  }, [])

  const recordAuthFlowEvent = useCallback((
    event: string,
    detail?: Record<string, unknown>,
  ) => {
    updateAuthFlowDiagnostics((current) => ({
      ...current,
      events: [
        ...current.events.slice(-49),
        {
          detail,
          elapsedMs: Math.round(performance.now() - authFlowStartedAtRef.current),
          event,
          timestamp: new Date().toISOString(),
        },
      ],
    }))
  }, [updateAuthFlowDiagnostics])

  const recordAuthFailure = useCallback((failure: Omit<AuthFlowFailure, 'timestamp'>) => {
    updateAuthFlowDiagnostics((current) => ({
      ...current,
      failures: [
        ...current.failures.slice(-24),
        {
          ...failure,
          timestamp: new Date().toISOString(),
        },
      ],
    }))
  }, [updateAuthFlowDiagnostics])

  const recordCredentialBoundary = useCallback((
    boundary: string,
    credential: string,
    detail: Record<string, unknown> = {},
  ) => {
    void getCredentialDiagnostics(credential)
      .then((credentialDiagnostics) => {
        recordAuthFlowEvent(boundary, {
          ...detail,
          credential: credentialDiagnostics,
        })
      })
      .catch((error) => {
        recordAuthFlowEvent(boundary, {
          ...detail,
          credential: getJwtFormatDiagnostics(credential),
          credentialDiagnosticError: error instanceof Error ? error.message : String(error),
        })
      })
  }, [recordAuthFlowEvent])

  useEffect(() => {
    window.__loboAuthDiagnostics = authFlowDiagnostics
  }, [authFlowDiagnostics])

  useEffect(() => {
    const previousSession = previousSessionRef.current
    const currentStorageToken =
      window.localStorage.getItem(authStorageKey) ?? ''
    const currentAuthTokenVersion = getActiveAuthTokenVersion()
    const changed =
      previousSession.authenticated !== session.authenticated ||
      previousSession.code !== session.code ||
      previousSession.stage !== session.stage ||
      previousSession.user.email !== session.user.email ||
      previousSession.user.leaguePlayer !== session.user.leaguePlayer ||
      previousSession.user.role !== session.user.role ||
      previousStorageTokenRef.current !== currentStorageToken ||
      previousAuthTokenVersionRef.current !== currentAuthTokenVersion

    if (changed) {
      recordAuthTransition({
        activeAuthTokenChanged:
          previousAuthTokenVersionRef.current !== currentAuthTokenVersion,
        currentRoute: getCurrentRoute(),
        localStorageTokenChanged:
          previousStorageTokenRef.current !== currentStorageToken,
        next: buildAuthSessionSnapshot(session),
        previous: buildAuthSessionSnapshot(previousSession),
        reason: authTransitionReasonRef.current,
        refreshSessionRunning: refreshSessionRunningRef.current,
        timestamp: new Date().toISOString(),
      })
    }

    previousSessionRef.current = session
    previousStorageTokenRef.current = currentStorageToken
    previousAuthTokenVersionRef.current = currentAuthTokenVersion
    authTransitionReasonRef.current = 'state_update'
  }, [session])

  useEffect(() => {
    if (pendingStateUpdateAtRef.current <= 0) {
      return
    }

    const stateUpdateMs = performance.now() - pendingStateUpdateAtRef.current
    pendingStateUpdateAtRef.current = 0

    updateAuthFlowDiagnostics((current) => ({
      ...current,
      timings: {
        ...current.timings,
        authContextStateUpdateMs: Math.round(stateUpdateMs),
        portalAuthenticatedMs: session.authenticated
          ? Math.round(performance.now() - authFlowStartedAtRef.current)
          : current.timings.portalAuthenticatedMs,
      },
    }))
    recordAuthFlowEvent('authContextStateUpdated', {
      authenticated: session.authenticated,
      code: session.code,
      durationMs: Math.round(stateUpdateMs),
      stage: session.stage,
    })
  }, [recordAuthFlowEvent, session.authenticated, session.code, session.stage, updateAuthFlowDiagnostics])

  const applyCredential = useCallback(async (credential: string) => {
    const start = performance.now()
    retryCountRef.current += 1
    const retryCount = retryCountRef.current
    const clickToCredentialMs = lastButtonClickAtRef.current > 0
      ? start - lastButtonClickAtRef.current
      : 0
    const jwtFormat =
      await getCredentialDiagnostics(credential)
    updateAuthFlowDiagnostics((current) => ({
      ...current,
      gisReturnedCredential: true,
      retryCount,
      timings: {
        ...current.timings,
        gisClickToCredentialMs: Math.round(clickToCredentialMs),
      },
    }))
    recordAuthFlowEvent('gisCredentialReceived', {
      clickToCredentialMs: Math.round(clickToCredentialMs),
      jwtFormat,
      retryCount,
    })
    if (!isLikelyGoogleJwt(credential)) {
      recordAuthFlowEvent('invalidCredentialRejected', {
        jwtFormat,
        reason: 'invalid_google_jwt_shape',
      })
      recordAuthFailure({
        appsScriptRejectedCredential: false,
        automaticBrowserRetry: false,
        code: 'AUTH_GOOGLE_TOKEN_MALFORMED',
        gisReturnedCredential: true,
        message: 'Google credential was rejected before storage because it is not a JWT.',
        retryCount,
        stage: 'frontendCredentialValidation',
      })
      recordClientDiagnostic(
        'oauth',
        'failure',
        performance.now() - start,
        'frontendCredentialValidation:AUTH_GOOGLE_TOKEN_MALFORMED',
      )
      setStatus('ready')
      return
    }
    setStatus('loading')
    recordClientDiagnostic('oauth', 'attempt', 0, 'credential_received')
    window.localStorage.setItem(authStorageKey, credential)
    recordCredentialBoundary('localStorageCredentialWritten', credential, {
      storageKey: authStorageKey,
    })
    recordCredentialBoundary('setApiAuthTokenFromApplyCredential', credential)
    setApiAuthToken(credential)

    try {
      const nextSession = await getSession()
      recordClientDiagnostic(
        'oauth',
        nextSession.authenticated ? 'success' : 'failure',
        performance.now() - start,
        `${nextSession.stage || 'session'}:${nextSession.code || 'NO_CODE'}`,
      )

      if (
        !nextSession.authenticated &&
        shouldClearStoredAuthToken(nextSession.code)
      ) {
        authTransitionReasonRef.current = 'token_invalidation'
        window.localStorage.removeItem(authStorageKey)
        setApiAuthToken('')
      }

      if (!nextSession.authenticated) {
        recordAuthFailure({
          appsScriptRejectedCredential: Boolean(credential),
          automaticBrowserRetry: false,
          code: nextSession.code || 'AUTH_SESSION_REJECTED',
          gisReturnedCredential: true,
          message: nextSession.error || 'Apps Script rejected credential.',
          retryCount,
          stage: nextSession.stage || 'session',
        })
      }

      if (nextSession.authenticated) {
        const report = await synchronizeIdentity(nextSession, credential)
        setIdentity(report)
        recordClientDiagnostic(
          'identitySynchronization',
          report.synchronized ? 'success' : 'failure',
          0,
          `${report.identityHealth}:${report.mismatches[0] || 'synchronized'}`,
        )
      } else {
        setIdentity(null)
        clearCachedIdentityReport()
      }

      pendingStateUpdateAtRef.current = performance.now()
      authTransitionReasonRef.current = nextSession.authenticated
        ? 'google_sign_in'
        : 'session_rejected'
      setSession(nextSession)
    } catch (error) {
      recordClientDiagnostic(
        'oauth',
        'failure',
        performance.now() - start,
        error instanceof Error ? error.message : 'session_request_failed',
      )
      window.localStorage.removeItem(authStorageKey)
      setApiAuthToken('')
      setIdentity(null)
      clearCachedIdentityReport()
      recordAuthFailure({
        appsScriptRejectedCredential: false,
        automaticBrowserRetry: false,
        code: 'AUTH_SESSION_REQUEST_FAILED',
        gisReturnedCredential: true,
        message: error instanceof Error ? error.message : 'session_request_failed',
        retryCount,
        stage: 'frontendSession',
      })
      pendingStateUpdateAtRef.current = performance.now()
      authTransitionReasonRef.current = 'session_request_failed'
      setSession((current) => ({
        ...current,
        authenticated: false,
        code: 'AUTH_SESSION_REQUEST_FAILED',
        diagnostics: {},
        error: error instanceof Error ? error.message : 'Session unavailable.',
        permissions: {},
        stage: 'frontendSession',
        user: guestUser,
      }))
    } finally {
      setInitialization((current) => ({
        ...current,
        completedAt: new Date().toISOString(),
        googleCredentialMs: Math.round(performance.now() - start),
      }))
      setStatus('ready')
    }
  }, [
    recordAuthFailure,
    recordAuthFlowEvent,
    recordCredentialBoundary,
    updateAuthFlowDiagnostics,
  ])

  const ensureGoogleClientReady = useCallback(async () => {
    const start = performance.now()
    const clientId = clientIdRef.current

    if (!clientId) {
      return 0
    }

    function initializeGoogle() {
      if (!window.google || !clientId) {
        return false
      }

      if (googleInitializedClientIdRef.current !== clientId) {
        recordAuthFlowEvent('gisInitializeStart', {
          clientIdPresent: Boolean(clientId),
        })
        window.google.accounts.id.initialize({
          auto_select: true,
          callback: (response) => {
            if (response.credential) {
              recordCredentialBoundary('gisCredentialCallback', response.credential)
              void applyCredential(response.credential)
              return
            }
            recordAuthFailure({
              appsScriptRejectedCredential: false,
              automaticBrowserRetry: false,
              code: 'GIS_CREDENTIAL_MISSING',
              gisReturnedCredential: false,
              message: 'GIS callback did not include a credential.',
              retryCount: retryCountRef.current,
              stage: 'gisCredentialCallback',
            })
          },
          client_id: clientId,
        })
        googleInitializedClientIdRef.current = clientId
        recordAuthFlowEvent('gisInitializeComplete')
      }

      setGoogleReady(true)

      if (!googlePromptedRef.current) {
        googlePromptedRef.current = true
        window.google.accounts.id.prompt((notification) => {
          const momentType = notification.getMomentType?.() || ''
          const skipped = notification.isSkippedMoment?.() || false
          const notDisplayed = notification.isNotDisplayed?.() || false
          const dismissed = notification.isDismissedMoment?.() || false

          recordAuthFlowEvent('gisPromptMoment', {
            dismissed,
            dismissedReason: notification.getDismissedReason?.() || '',
            displayed: notification.isDisplayed?.() || false,
            momentType,
            notDisplayed,
            notDisplayedReason: notification.getNotDisplayedReason?.() || '',
            skipped,
            skippedReason: notification.getSkippedReason?.() || '',
          })

          if (skipped || notDisplayed) {
            browserRetryCountRef.current += 1
            updateAuthFlowDiagnostics((current) => ({
              ...current,
              automaticBrowserRetryCount: browserRetryCountRef.current,
            }))
            recordAuthFailure({
              appsScriptRejectedCredential: false,
              automaticBrowserRetry: true,
              code: skipped
                ? notification.getSkippedReason?.() || 'GIS_PROMPT_SKIPPED'
                : notification.getNotDisplayedReason?.() || 'GIS_PROMPT_NOT_DISPLAYED',
              gisReturnedCredential: false,
              message: 'GIS prompt did not return an interactive credential flow.',
              retryCount: retryCountRef.current,
              stage: 'gisPrompt',
            })
          }
        })
      }

      return true
    }

    if (initializeGoogle()) {
      const readyMs = performance.now() - start
      updateAuthFlowDiagnostics((current) => ({
        ...current,
        timings: {
          ...current.timings,
          gisLibraryLoadMs: current.timings.gisLibraryLoadMs || Math.round(readyMs),
        },
      }))
      return readyMs
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    )

    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, googleInitializationTimeoutMs)

      function finish() {
        window.clearTimeout(timeout)
        resolve()
      }

      if (existing) {
        recordAuthFlowEvent('gisScriptExisting')
        existing.addEventListener('load', finish, { once: true })
        existing.addEventListener('error', finish, { once: true })
        return
      }

      if (googleScriptRequestedRef.current) {
        return
      }

      googleScriptRequestedRef.current = true
      const script = document.createElement('script')
      const scriptStartedAt = performance.now()
      script.async = true
      script.defer = true
      script.onload = () => {
        const loadMs = performance.now() - scriptStartedAt
        updateAuthFlowDiagnostics((current) => ({
          ...current,
          timings: {
            ...current.timings,
            gisLibraryLoadMs: Math.round(loadMs),
          },
        }))
        recordAuthFlowEvent('gisScriptLoaded', {
          durationMs: Math.round(loadMs),
        })
        finish()
      }
      script.onerror = () => {
        recordAuthFailure({
          appsScriptRejectedCredential: false,
          automaticBrowserRetry: false,
          code: 'GIS_SCRIPT_LOAD_FAILED',
          gisReturnedCredential: false,
          message: 'GIS client script failed to load.',
          retryCount: retryCountRef.current,
          stage: 'gisLibraryLoad',
        })
        finish()
      }
      script.src = 'https://accounts.google.com/gsi/client'
      recordAuthFlowEvent('gisScriptRequested')
      document.head.appendChild(script)
    })

    initializeGoogle()

    return performance.now() - start
  }, [
    applyCredential,
    recordAuthFailure,
    recordAuthFlowEvent,
    recordCredentialBoundary,
    updateAuthFlowDiagnostics,
  ])

  const refreshSession = useCallback(async () => {
    const start = performance.now()
    refreshSessionRunningRef.current = true
    setStatus('loading')
    const storedToken = window.localStorage.getItem(authStorageKey) ?? ''
    if (storedToken) {
      recordCredentialBoundary('localStorageCredentialReadForRefresh', storedToken, {
        storageKey: authStorageKey,
      })
      if (!isLikelyGoogleJwt(storedToken)) {
        const storedTokenFormat = await getCredentialDiagnostics(storedToken)
        window.localStorage.removeItem(authStorageKey)
        setApiAuthToken('')
        setIdentity(null)
        clearCachedIdentityReport()
        recordAuthFlowEvent('invalidStoredTokenCleared', {
          storageKey: authStorageKey,
          token: storedTokenFormat,
        })
        recordClientDiagnostic(
          'oauthRefresh',
          'failure',
          performance.now() - start,
          'frontendStoredCredential:AUTH_GOOGLE_TOKEN_MALFORMED',
        )
        pendingStateUpdateAtRef.current = performance.now()
        authTransitionReasonRef.current = 'token_invalidation'
        setSession((current) => ({
          ...current,
          authenticated: false,
          code: '',
          diagnostics: {},
          error: '',
          permissions: {},
          stage: '',
          user: guestUser,
        }))
        setInitialization((current) => ({
          ...current,
          completedAt: new Date().toISOString(),
          sessionVerificationMs: Math.round(performance.now() - start),
        }))
        setStatus('ready')
        refreshSessionRunningRef.current = false
        return false
      }
      recordCredentialBoundary('setApiAuthTokenFromRefreshSession', storedToken)
    }
    setApiAuthToken(storedToken)

    try {
      const nextSession = await getSession()
      recordClientDiagnostic(
        'oauthRefresh',
        nextSession.authenticated ? 'success' : 'failure',
        performance.now() - start,
        `${nextSession.stage || 'session'}:${nextSession.code || 'NO_CODE'}`,
      )

      if (
        !nextSession.authenticated &&
        shouldClearStoredAuthToken(nextSession.code)
      ) {
        authTransitionReasonRef.current = 'token_invalidation'
        window.localStorage.removeItem(authStorageKey)
        setApiAuthToken('')
      }

      if (nextSession.authenticated && storedToken) {
        const report = await synchronizeIdentity(nextSession, storedToken)
        setIdentity(report)
        recordClientDiagnostic(
          'identitySynchronization',
          report.synchronized ? 'success' : 'failure',
          0,
          `${report.identityHealth}:${report.mismatches[0] || 'synchronized'}`,
        )
      } else {
        setIdentity(null)
        clearCachedIdentityReport()
      }

      pendingStateUpdateAtRef.current = performance.now()
      authTransitionReasonRef.current = nextSession.authenticated
        ? 'session_restored'
        : nextSession.code === 'AUTH_GOOGLE_TOKEN_EXPIRED'
          ? 'session_expiration'
          : 'session_refresh_result'
      setSession(nextSession)
      setInitialization((current) => ({
        ...current,
        completedAt: new Date().toISOString(),
        sessionVerificationMs: Math.round(performance.now() - start),
      }))
      return nextSession.authenticated
    } catch (error) {
      recordClientDiagnostic(
        'oauthRefresh',
        'failure',
        performance.now() - start,
        error instanceof Error ? error.message : 'session_request_failed',
      )
      window.localStorage.removeItem(authStorageKey)
      setApiAuthToken('')
      setIdentity(null)
      clearCachedIdentityReport()
      recordAuthFailure({
        appsScriptRejectedCredential: false,
        automaticBrowserRetry: Boolean(storedToken),
        code: 'AUTH_SESSION_REQUEST_FAILED',
        gisReturnedCredential: Boolean(storedToken),
        message: error instanceof Error ? error.message : 'session_request_failed',
        retryCount: retryCountRef.current,
        stage: 'frontendSessionRefresh',
      })
      pendingStateUpdateAtRef.current = performance.now()
      authTransitionReasonRef.current = 'session_request_failed'
      setSession((current) => ({
        ...current,
        authenticated: false,
        code: 'AUTH_SESSION_REQUEST_FAILED',
        diagnostics: {},
        error: error instanceof Error ? error.message : 'Session unavailable.',
        permissions: {},
        stage: 'frontendSession',
        user: guestUser,
      }))
      return false
    } finally {
      refreshSessionRunningRef.current = false
      setStatus('ready')
    }
  }, [
    recordAuthFailure,
    recordAuthFlowEvent,
    recordCredentialBoundary,
  ])

  useEffect(() => {
    setSessionRecoveryHandler(async () => {
      const recovered = await refreshSession()

      if (!recovered) {
        alert(friendlySessionExpiredMessage)
      }

      return recovered
    })

    return () => {
      setSessionRecoveryHandler(null)
    }
  }, [refreshSession])

  useEffect(() => {
    async function bootstrap() {
      const startedAt = performance.now()
      let settingsMs = 0
      let googleReadyMs = 0
      const sessionVerificationMs = 0

      try {
        const settingsStartedAt = performance.now()
        const settings = await getSettings()
        settingsMs = performance.now() - settingsStartedAt
        clientIdRef.current =
          clientIdRef.current || settings.googleOAuthClientId || ''
        setApiOAuthClientId(clientIdRef.current)
      } catch {
        clientIdRef.current = clientIdRef.current || ''
        setApiOAuthClientId(clientIdRef.current)
      }

      googleReadyMs = await ensureGoogleClientReady()

      const sessionStartedAt = performance.now()
      void refreshSession()

      const totalMs = performance.now() - startedAt
      setInitialization((current) => ({
        ...current,
        completedAt: new Date().toISOString(),
        googleReadyMs: Math.round(googleReadyMs),
        sessionVerificationMs: Math.round(sessionVerificationMs),
        settingsMs: Math.round(settingsMs),
        totalMs: Math.round(totalMs),
      }))
      recordClientDiagnostic(
        'authInitialization',
        'success',
        totalMs,
        `settings:${Math.round(settingsMs)} google:${Math.round(
          googleReadyMs,
        )} session:background`,
      )

      recordAuthFlowEvent('refreshSessionBackgroundStarted', {
        startedAfterMs: Math.round(performance.now() - sessionStartedAt),
      })
    }

    void bootstrap()
  }, [ensureGoogleClientReady, recordAuthFlowEvent, refreshSession])

  const signOut = useCallback(() => {
    authTransitionReasonRef.current = 'manual_sign_out'
    window.localStorage.removeItem(authStorageKey)
    setApiAuthToken('')
    window.google?.accounts.id.cancel()
    void signOutOfFirebase()
    setIdentity(null)
    clearCachedIdentityReport()
    setSession((current) => ({
      ...current,
      authenticated: false,
      code: '',
      diagnostics: {},
      error: '',
      permissions: {},
      stage: '',
      user: guestUser,
    }))
  }, [])

  const renderSignInButton = useCallback((element: HTMLElement) => {
    if (!window.google || !clientIdRef.current) {
      return
    }

    const renderStartedAt = performance.now()
    element.innerHTML = ''
    element.addEventListener(
      'pointerdown',
      () => {
        lastButtonClickAtRef.current = performance.now()
        recordAuthFlowEvent('gisButtonPointerDown')
      },
      { once: false },
    )
    window.google.accounts.id.renderButton(element, {
      shape: 'pill',
      size: 'medium',
      text: 'signin_with',
      theme: 'filled_black',
      type: 'standard',
    })
    window.requestAnimationFrame(() => {
      const interactiveMs = performance.now() - authFlowStartedAtRef.current
      updateAuthFlowDiagnostics((current) => ({
        ...current,
        timings: {
          ...current.timings,
          gisButtonInteractiveMs: Math.round(interactiveMs),
        },
      }))
      recordAuthFlowEvent('gisButtonInteractive', {
        durationMs: Math.round(performance.now() - renderStartedAt),
        timeSinceAuthStartMs: Math.round(interactiveMs),
      })
    })
  }, [recordAuthFlowEvent, updateAuthFlowDiagnostics])

  const value = useMemo<AuthContextValue>(
    () => ({
      authenticated: session.authenticated,
      authState:
        status === 'loading'
          ? 'initializing'
          : session.authenticated
            ? 'authenticated'
            : 'unauthenticated',
      code: session.code,
      diagnostics: session.diagnostics,
      error:
        session.code === 'AUTH_GOOGLE_TOKEN_EXPIRED'
          ? friendlySessionExpiredMessage
          : session.error,
      googleReady,
      hasPermission: (permission) => session.permissions[permission] === true,
      identity,
      initialization,
      isAtLeastRole: (role) =>
        roleOrder.indexOf(session.user.role) >= roleOrder.indexOf(role),
      oauthConfigured: Boolean(clientIdRef.current) || session.oauthConfigured,
      permissions: session.permissions,
      refreshSession,
      renderSignInButton,
      signOut,
      stage: session.stage,
      status,
      user: session.user,
    }),
    [
      googleReady,
      identity,
      initialization,
      refreshSession,
      renderSignInButton,
      session,
      signOut,
      status,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }

  return context
}

export default AuthProvider
