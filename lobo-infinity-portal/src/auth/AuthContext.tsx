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
  recordClientDiagnostic,
  setApiAuthToken,
  setApiOAuthClientId,
} from '../services/apiCore'
import {
  signOutOfFirebase,
} from '../firebase/firebaseAuthBridge'
import {
  clearCachedIdentityReport,
  getCachedIdentityReport,
  synchronizeIdentity,
  type UnifiedIdentityReport,
} from '../services/identity/IdentityService'

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleAccounts = {
  id: {
    cancel: () => void
    initialize: (config: {
      auto_select?: boolean
      callback: (response: GoogleCredentialResponse) => void
      client_id: string
    }) => void
    prompt: () => void
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
  refreshSession: () => Promise<void>
  renderSignInButton: (element: HTMLElement) => void
  signOut: () => void
  stage: string
  status: 'loading' | 'ready'
  user: PortalUser
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

const terminalAuthCodes = new Set([
  'AUTH_EMAIL_UNVERIFIED',
  'AUTH_GOOGLE_TOKEN_AUDIENCE_MISMATCH',
  'AUTH_GOOGLE_TOKEN_EXPIRED',
  'AUTH_GOOGLE_TOKEN_INVALID',
  'AUTH_GOOGLE_TOKEN_MISSING',
  'AUTH_GOOGLE_TOKEN_MALFORMED',
  'AUTH_OAUTH_CLIENT_MISSING',
])

function shouldClearStoredAuthToken(code: string) {
  return code === '' || terminalAuthCodes.has(code)
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
  const clientIdRef = useRef(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')
  const googleInitializedClientIdRef = useRef('')
  const googlePromptedRef = useRef(false)
  const googleScriptRequestedRef = useRef(false)

  const applyCredential = useCallback(async (credential: string) => {
    const start = performance.now()
    setStatus('loading')
    recordClientDiagnostic('oauth', 'attempt', 0, 'credential_received')
    window.localStorage.setItem(authStorageKey, credential)
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
        window.localStorage.removeItem(authStorageKey)
        setApiAuthToken('')
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
  }, [])

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
        window.google.accounts.id.initialize({
          auto_select: true,
          callback: (response) => {
            if (response.credential) {
              void applyCredential(response.credential)
            }
          },
          client_id: clientId,
        })
        googleInitializedClientIdRef.current = clientId
      }

      setGoogleReady(true)

      if (!googlePromptedRef.current) {
        googlePromptedRef.current = true
        window.google.accounts.id.prompt()
      }

      return true
    }

    if (initializeGoogle()) {
      return performance.now() - start
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
        existing.addEventListener('load', finish, { once: true })
        existing.addEventListener('error', finish, { once: true })
        return
      }

      if (googleScriptRequestedRef.current) {
        return
      }

      googleScriptRequestedRef.current = true
      const script = document.createElement('script')
      script.async = true
      script.defer = true
      script.onload = finish
      script.onerror = finish
      script.src = 'https://accounts.google.com/gsi/client'
      document.head.appendChild(script)
    })

    initializeGoogle()

    return performance.now() - start
  }, [applyCredential])

  const refreshSession = useCallback(async () => {
    const start = performance.now()
    setStatus('loading')
    const storedToken = window.localStorage.getItem(authStorageKey) ?? ''
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

      setSession(nextSession)
      setInitialization((current) => ({
        ...current,
        completedAt: new Date().toISOString(),
        sessionVerificationMs: Math.round(performance.now() - start),
      }))
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
      setStatus('ready')
    }
  }, [])

  useEffect(() => {
    async function bootstrap() {
      const startedAt = performance.now()
      let settingsMs = 0
      let googleReadyMs = 0
      let sessionVerificationMs = 0

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
      await refreshSession()
      sessionVerificationMs = performance.now() - sessionStartedAt

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
        )} session:${Math.round(sessionVerificationMs)}`,
      )
    }

    void bootstrap()
  }, [ensureGoogleClientReady, refreshSession])

  const signOut = useCallback(() => {
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

    element.innerHTML = ''
    window.google.accounts.id.renderButton(element, {
      shape: 'pill',
      size: 'medium',
      text: 'signin_with',
      theme: 'filled_black',
      type: 'standard',
    })
  }, [])

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
      error: session.error,
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
