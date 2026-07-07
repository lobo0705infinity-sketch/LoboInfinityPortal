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
  code: string
  diagnostics: Record<string, unknown>
  error: string
  googleReady: boolean
  hasPermission: (permission: string) => boolean
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
  const clientIdRef = useRef(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')
  const googleInitializedClientIdRef = useRef('')
  const googlePromptedRef = useRef(false)
  const googleScriptRequestedRef = useRef(false)

  const applyCredential = useCallback(async (credential: string) => {
    const start = performance.now()
    recordClientDiagnostic('oauth', 'attempt', 0, 'credential_received')
    window.localStorage.setItem(authStorageKey, credential)
    setApiAuthToken(credential)
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

    setSession(nextSession)
  }, [])

  const refreshSession = useCallback(async () => {
    const start = performance.now()
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
      setSession(nextSession)

      if (
        !nextSession.authenticated &&
        shouldClearStoredAuthToken(nextSession.code)
      ) {
        window.localStorage.removeItem(authStorageKey)
        setApiAuthToken('')
      }
    } catch (error) {
      recordClientDiagnostic(
        'oauthRefresh',
        'failure',
        performance.now() - start,
        error instanceof Error ? error.message : 'session_request_failed',
      )
      window.localStorage.removeItem(authStorageKey)
      setApiAuthToken('')
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
      try {
        const settings = await getSettings()
        clientIdRef.current =
          clientIdRef.current || settings.googleOAuthClientId || ''
        setApiOAuthClientId(clientIdRef.current)
      } catch {
        clientIdRef.current = clientIdRef.current || ''
        setApiOAuthClientId(clientIdRef.current)
      }

      await refreshSession()
    }

    void bootstrap()
  }, [refreshSession])

  useEffect(() => {
    if (!clientIdRef.current) {
      return
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    )

    function initializeGoogle() {
      const clientId = clientIdRef.current

      if (!window.google || !clientId) {
        return
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
    }

    if (window.google) {
      initializeGoogle()
      return
    }

    if (existing) {
      existing.addEventListener('load', initializeGoogle, { once: true })
      return
    }

    if (googleScriptRequestedRef.current) {
      return
    }

    googleScriptRequestedRef.current = true
    const script = document.createElement('script')
    script.async = true
    script.defer = true
    script.onload = initializeGoogle
    script.src = 'https://accounts.google.com/gsi/client'
    document.head.appendChild(script)
  }, [applyCredential, status])

  const signOut = useCallback(() => {
    window.localStorage.removeItem(authStorageKey)
    setApiAuthToken('')
    window.google?.accounts.id.cancel()
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
      code: session.code,
      diagnostics: session.diagnostics,
      error: session.error,
      googleReady,
      hasPermission: (permission) => session.permissions[permission] === true,
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
    [googleReady, refreshSession, renderSignInButton, session, signOut, status],
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
