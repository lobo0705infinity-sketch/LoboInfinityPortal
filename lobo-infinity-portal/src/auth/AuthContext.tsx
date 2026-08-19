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
  type SetStateAction,
} from 'react'
import {
  type AuthSession,
  type PortalPermissions,
  type PortalUser,
  type UserRole,
} from '../services/api'
import {
  getSession,
  getSettings,
  nativeLogin as requestNativeLogin,
  nativeLogout as requestNativeLogout,
} from '../services/lightApi'
import {
  getActiveApiAuthToken,
  getActiveAuthTokenVersion,
  getActiveNativeSessionToken,
  recordClientDiagnostic,
  setApiAuthToken,
  setApiNativeSessionToken,
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
import { CanonicalSessionLifecycleCoordinator } from './CanonicalSessionLifecycleCoordinator'
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
        width?: number
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

type SignInButtonRenderOptions = {
  width?: number
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
  renderSignInButton: (
    element: HTMLElement,
    options?: SignInButtonRenderOptions,
  ) => void
  signInWithPassword: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
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
  canonicalPlayer: '',
  leaguePlayer: '',
  playerDisplayName: '',
  leagueDivision: '',
  role: 'Guest',
  enabled: false,
  favoriteFaction: '',
  discordName: '',
  profileVisibility: 'Public',
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
const nativeSessionStorageKey = 'lobo-session-token'
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

  const clearSessionIdentity = useCallback(() => {
    setIdentity(null)
    clearCachedIdentityReport()
  }, [])

  const synchronizeSessionIdentity = useCallback(async (
    nextSession: AuthSession,
    credential: string,
  ) => {
    const report = await synchronizeIdentity(nextSession, credential)
    setIdentity(report)
    recordClientDiagnostic(
      'identitySynchronization',
      report.synchronized ? 'success' : 'failure',
      0,
      `${report.identityHealth}:${report.mismatches[0] || 'synchronized'}`,
    )
  }, [])

  const transitionSessionState = useCallback((
    transition: SetStateAction<AuthSession>,
    reason: string,
  ) => {
    pendingStateUpdateAtRef.current = performance.now()
    authTransitionReasonRef.current = reason
    setSession(transition)
  }, [])

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
    await CanonicalSessionLifecycleCoordinator.createSession({
      activateCredential: setApiAuthToken,
      clearActiveCredential: () => setApiAuthToken(''),
      clearIdentity: clearSessionIdentity,
      clearPersistedCredential: () => window.localStorage.removeItem(authStorageKey),
      credential,
      guestUser,
      lifecycleCompleted: (elapsedMs) => {
        setInitialization((current) => ({
          ...current,
          completedAt: new Date().toISOString(),
          googleCredentialMs: Math.round(elapsedMs),
        }))
        setStatus('ready')
      },
      lifecycleStarted: () => {
        setStatus('loading')
        recordClientDiagnostic('oauth', 'attempt', 0, 'credential_received')
      },
      onCredentialActivated: (value) =>
        recordCredentialBoundary('setApiAuthTokenFromApplyCredential', value),
      onCredentialPersisted: (value) =>
        recordCredentialBoundary('localStorageCredentialWritten', value, {
          storageKey: authStorageKey,
        }),
      onSessionRejected: (nextSession) => recordAuthFailure({
        appsScriptRejectedCredential: Boolean(credential),
        automaticBrowserRetry: false,
        code: nextSession.code || 'AUTH_SESSION_REJECTED',
        gisReturnedCredential: true,
        message: nextSession.error || 'Apps Script rejected credential.',
        retryCount,
        stage: nextSession.stage || 'session',
      }),
      onSessionRequestException: (error, elapsedMs) => recordClientDiagnostic(
        'oauth',
        'failure',
        elapsedMs,
        error instanceof Error ? error.message : 'session_request_failed',
      ),
      onSessionRequestFailed: (error) => recordAuthFailure({
        appsScriptRejectedCredential: false,
        automaticBrowserRetry: false,
        code: 'AUTH_SESSION_REQUEST_FAILED',
        gisReturnedCredential: true,
        message: error instanceof Error ? error.message : 'session_request_failed',
        retryCount,
        stage: 'frontendSession',
      }),
      onSessionResolved: (nextSession, elapsedMs) => recordClientDiagnostic(
        'oauth',
        nextSession.authenticated ? 'success' : 'failure',
        elapsedMs,
        `${nextSession.stage || 'session'}:${nextSession.code || 'NO_CODE'}`,
      ),
      persistCredential: (value) =>
        window.localStorage.setItem(authStorageKey, value),
      requestSession: () => {
        logAuthContextSessionForensic('applyCredential.sessionRequestEntered')
        return getSession()
      },
      shouldInvalidateCredential: shouldClearStoredAuthToken,
      startedAt: start,
      synchronizeIdentity: synchronizeSessionIdentity,
      transitionSession: transitionSessionState,
    })
  }, [
    clearSessionIdentity,
    recordAuthFailure,
    recordAuthFlowEvent,
    recordCredentialBoundary,
    synchronizeSessionIdentity,
    transitionSessionState,
    updateAuthFlowDiagnostics,
  ])

  const signInWithPassword = useCallback(async (
    email: string,
    password: string,
  ) => {
    setStatus('loading')

    try {
      const result = await requestNativeLogin(email, password)
      const nextSession: AuthSession = {
        authenticated: result.authenticated,
        code: result.code,
        diagnostics: result.diagnostics,
        error: result.error,
        oauthConfigured: Boolean(clientIdRef.current),
        permissions: result.permissions,
        stage: result.stage,
        user: result.user,
      }

      if (!result.success || !result.authenticated || !result.sessionToken) {
        transitionSessionState(nextSession, 'native_login_rejected')
        return false
      }

      window.localStorage.setItem(nativeSessionStorageKey, result.sessionToken)
      setApiNativeSessionToken(result.sessionToken)
      setApiAuthToken('')
      clearSessionIdentity()
      transitionSessionState(nextSession, 'native_login')
      return true
    } catch {
      transitionSessionState({
        authenticated: false,
        code: 'AUTH_LOGIN_FAILED',
        diagnostics: {},
        error: 'Unable to sign in.',
        oauthConfigured: Boolean(clientIdRef.current),
        permissions: {},
        stage: 'credentialVerification',
        user: guestUser,
      }, 'native_login_failed')
      return false
    } finally {
      setStatus('ready')
    }
  }, [clearSessionIdentity, transitionSessionState])

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
    const nativeSessionToken =
      window.localStorage.getItem(nativeSessionStorageKey) ?? ''

    if (nativeSessionToken) {
      refreshSessionRunningRef.current = true
      setStatus('loading')
      setApiNativeSessionToken(nativeSessionToken)
      setApiAuthToken('')

      try {
        const nextSession = await getSession()

        if (nextSession.authenticated) {
          clearSessionIdentity()
          transitionSessionState(nextSession, 'native_session_restored')
          return true
        }

        window.localStorage.removeItem(nativeSessionStorageKey)
        setApiNativeSessionToken('')
        transitionSessionState(nextSession, 'native_session_rejected')
        return false
      } catch {
        window.localStorage.removeItem(nativeSessionStorageKey)
        setApiNativeSessionToken('')
        transitionSessionState({
          authenticated: false,
          code: 'AUTH_SESSION_REQUEST_FAILED',
          diagnostics: {},
          error: 'Unable to restore session.',
          oauthConfigured: Boolean(clientIdRef.current),
          permissions: {},
          stage: 'sessionValidation',
          user: guestUser,
        }, 'native_session_restore_failed')
        return false
      } finally {
        refreshSessionRunningRef.current = false
        setStatus('ready')
      }
    }

    setApiNativeSessionToken('')
    const credentialAtRefreshStart =
      window.localStorage.getItem(authStorageKey) ?? ''
    return CanonicalSessionLifecycleCoordinator.refreshSession({
      activateCredential: setApiAuthToken,
      clearActiveCredential: () => {
        if (getActiveApiAuthToken() === credentialAtRefreshStart) {
          setApiAuthToken('')
        }
      },
      clearIdentity: clearSessionIdentity,
      clearPersistedCredential: () => {
        if (
          (window.localStorage.getItem(authStorageKey) ?? '') ===
          credentialAtRefreshStart
        ) {
          window.localStorage.removeItem(authStorageKey)
        }
      },
      describeCredential: getCredentialDiagnostics,
      guestUser,
      isCredentialValid: isLikelyGoogleJwt,
      lifecycleCompleted: () => {
        refreshSessionRunningRef.current = false
        setStatus('ready')
      },
      lifecycleStarted: () => {
        refreshSessionRunningRef.current = true
        setStatus('loading')
      },
      onCredentialActivated: (storedToken) =>
        recordCredentialBoundary('setApiAuthTokenFromRefreshSession', storedToken),
      onCredentialRead: (storedToken) =>
        recordCredentialBoundary('localStorageCredentialReadForRefresh', storedToken, {
          storageKey: authStorageKey,
        }),
      onInvalidStoredCredential: (storedTokenFormat, elapsedMs) => {
        recordAuthFlowEvent('invalidStoredTokenCleared', {
          storageKey: authStorageKey,
          token: storedTokenFormat,
        })
        recordClientDiagnostic(
          'oauthRefresh',
          'failure',
          elapsedMs,
          'frontendStoredCredential:AUTH_GOOGLE_TOKEN_MALFORMED',
        )
      },
      onSessionRequestException: (error, elapsedMs) => recordClientDiagnostic(
        'oauthRefresh',
        'failure',
        elapsedMs,
        error instanceof Error ? error.message : 'session_request_failed',
      ),
      onSessionRequestFailed: (error, hadCredential) => recordAuthFailure({
        appsScriptRejectedCredential: false,
        automaticBrowserRetry: hadCredential,
        code: 'AUTH_SESSION_REQUEST_FAILED',
        gisReturnedCredential: hadCredential,
        message: error instanceof Error ? error.message : 'session_request_failed',
        retryCount: retryCountRef.current,
        stage: 'frontendSessionRefresh',
      }),
      onSessionResolved: (nextSession, elapsedMs) => recordClientDiagnostic(
        'oauthRefresh',
        nextSession.authenticated ? 'success' : 'failure',
        elapsedMs,
        `${nextSession.stage || 'session'}:${nextSession.code || 'NO_CODE'}`,
      ),
      onVerificationCompleted: (elapsedMs) => setInitialization((current) => ({
        ...current,
        completedAt: new Date().toISOString(),
        sessionVerificationMs: Math.round(elapsedMs),
      })),
      readPersistedCredential: () => credentialAtRefreshStart,
      requestSession: () => {
        logAuthContextSessionForensic('refreshSession.sessionRequestEntered')
        return getSession()
      },
      shouldInvalidateCredential: shouldClearStoredAuthToken,
      startedAt: start,
      synchronizeIdentity: synchronizeSessionIdentity,
      transitionSession: transitionSessionState,
    })
  }, [
    clearSessionIdentity,
    recordAuthFailure,
    recordAuthFlowEvent,
    recordCredentialBoundary,
    synchronizeSessionIdentity,
    transitionSessionState,
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

  const signOut = useCallback(async () => {
    const nativeSessionToken =
      window.localStorage.getItem(nativeSessionStorageKey) ??
      getActiveNativeSessionToken()

    if (nativeSessionToken) {
      try {
        await requestNativeLogout(nativeSessionToken)
      } finally {
        window.localStorage.removeItem(nativeSessionStorageKey)
        setApiNativeSessionToken('')
        setApiAuthToken('')
        clearSessionIdentity()
        transitionSessionState({
          authenticated: false,
          code: 'AUTH_LOGGED_OUT',
          diagnostics: {},
          error: '',
          oauthConfigured: Boolean(clientIdRef.current),
          permissions: {},
          stage: 'sessionDestruction',
          user: guestUser,
        }, 'native_logout')
        setStatus('ready')
      }
      return
    }

    CanonicalSessionLifecycleCoordinator.destroySession({
      cancelGoogleIdentity: () => window.google?.accounts.id.cancel(),
      clearActiveCredential: () => setApiAuthToken(''),
      clearIdentity: clearSessionIdentity,
      clearPersistedCredential: () => window.localStorage.removeItem(authStorageKey),
      destroyExternalIdentity: () => void signOutOfFirebase(),
      guestUser,
      transitionSession: transitionSessionState,
    })
  }, [clearSessionIdentity, transitionSessionState])

  const renderSignInButton = useCallback((
    element: HTMLElement,
    options: SignInButtonRenderOptions = {},
  ) => {
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
      width: options.width,
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
      signInWithPassword,
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
      signInWithPassword,
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

function logAuthContextSessionForensic(stage: string) {
  const fields = {
    stage,
    timestamp: new Date().toISOString(),
    requestUrl: '',
    apiAction: 'session',
    httpMethod: 'POST',
    httpStatus: '',
    responseContentType: '',
    responseBodyPreview: '',
    exceptionName: '',
    exceptionMessage: '',
    exceptionStack: '',
    requestId: '',
  }

  Object.entries(fields).forEach(([field, value]) => {
    console.info(`[auth-session-forensic]\n${field}=${value}`)
  })
}

export default AuthProvider
