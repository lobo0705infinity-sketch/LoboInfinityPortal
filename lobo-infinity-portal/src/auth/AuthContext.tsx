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
  apiClient,
  setApiAuthToken,
  setApiOAuthClientId,
  type AuthSession,
  type PortalPermissions,
  type PortalUser,
  type UserRole,
} from '../services/api'

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
  error: string
  googleReady: boolean
  hasPermission: (permission: string) => boolean
  isAtLeastRole: (role: UserRole) => boolean
  oauthConfigured: boolean
  permissions: PortalPermissions
  refreshSession: () => Promise<void>
  renderSignInButton: (element: HTMLElement) => void
  signOut: () => void
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

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    authenticated: false,
    error: '',
    oauthConfigured: false,
    permissions: {},
    user: guestUser,
  })
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [googleReady, setGoogleReady] = useState(false)
  const clientIdRef = useRef(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')

  const applyCredential = useCallback(async (credential: string) => {
    window.localStorage.setItem(authStorageKey, credential)
    setApiAuthToken(credential)
    const nextSession = await apiClient.getSession()

    if (!nextSession.authenticated) {
      window.localStorage.removeItem(authStorageKey)
      setApiAuthToken('')
    }

    setSession(nextSession)
  }, [])

  const refreshSession = useCallback(async () => {
    const storedToken = window.localStorage.getItem(authStorageKey) ?? ''
    setApiAuthToken(storedToken)

    try {
      const nextSession = await apiClient.getSession()
      setSession(nextSession)

      if (!nextSession.authenticated) {
        window.localStorage.removeItem(authStorageKey)
        setApiAuthToken('')
      }
    } catch (error) {
      window.localStorage.removeItem(authStorageKey)
      setApiAuthToken('')
      setSession((current) => ({
        ...current,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Session unavailable.',
        permissions: {},
        user: guestUser,
      }))
    } finally {
      setStatus('ready')
    }
  }, [])

  useEffect(() => {
    async function bootstrap() {
      try {
        const settings = await apiClient.getSettings()
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
      if (!window.google || !clientIdRef.current) {
        return
      }

      window.google.accounts.id.initialize({
        auto_select: true,
        callback: (response) => {
          if (response.credential) {
            void applyCredential(response.credential)
          }
        },
        client_id: clientIdRef.current,
      })
      setGoogleReady(true)
      window.google.accounts.id.prompt()
    }

    if (existing) {
      initializeGoogle()
      return
    }

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
      error: '',
      permissions: {},
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
