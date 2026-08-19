/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthSession, PortalPermissions, PortalUser, UserRole } from '../services/api'
import { commissionerLogin, commissionerLogout, getSession, setupCommissionerPassword } from '../services/lightApi'
import { getActiveNativeSessionToken, setApiNativeSessionToken, setSessionRecoveryHandler } from '../services/apiCore'
import type { UnifiedIdentityReport } from '../services/identity/IdentityService'

type AuthContextValue = {
  authenticated: boolean
  authState: 'authenticated' | 'initializing' | 'unauthenticated'
  code: string
  diagnostics: Record<string, unknown>
  error: string
  hasPermission: (permission: string) => boolean
  identity: UnifiedIdentityReport | null
  initialization: { completedAt: string; googleCredentialMs: number; googleReadyMs: number; sessionVerificationMs: number; settingsMs: number; totalMs: number }
  isAtLeastRole: (role: UserRole) => boolean
  permissions: PortalPermissions
  refreshSession: () => Promise<boolean>
  createCommissionerPassword: (password: string) => Promise<boolean>
  signInWithPassword: (password: string) => Promise<boolean>
  signOut: () => Promise<void>
  stage: string
  status: 'loading' | 'ready'
  user: PortalUser
}

const guestUser: PortalUser = {
  email: '', displayName: 'Guest', canonicalPlayer: '', leaguePlayer: '', playerDisplayName: '', leagueDivision: '',
  role: 'Guest', enabled: false, favoriteFaction: '', discordName: '', profileVisibility: 'Public', avatarUrl: '',
  created: '', lastLogin: '', lastSeen: '', notificationPreferences: {}, themePreference: 'system', dismissedAlerts: [],
  readAlerts: [], archivedAlerts: [], lastPage: '', searchHistory: [],
}
const emptySession: AuthSession = { authenticated: false, code: '', diagnostics: {}, error: '', oauthConfigured: false, permissions: {}, stage: '', user: guestUser }
const storageKey = 'lobo-session-token'
const roleOrder: UserRole[] = ['Guest', 'League Member', 'Assistant Commissioner', 'Commissioner']
const AuthContext = createContext<AuthContextValue | null>(null)

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>(emptySession)
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [initialization, setInitialization] = useState({ completedAt: '', googleCredentialMs: 0, googleReadyMs: 0, sessionVerificationMs: 0, settingsMs: 0, totalMs: 0 })

  const refreshSession = useCallback(async () => {
    const startedAt = performance.now()
    const token = window.localStorage.getItem(storageKey) ?? ''
    if (!token) { setApiNativeSessionToken(''); setSession(emptySession); setStatus('ready'); return false }
    setApiNativeSessionToken(token)
    try {
      const next = await getSession()
      if (!next.authenticated || next.user.role !== 'Commissioner') {
        window.localStorage.removeItem(storageKey)
        setApiNativeSessionToken('')
      }
      setSession(next.authenticated && next.user.role === 'Commissioner' ? next : emptySession)
      return next.authenticated && next.user.role === 'Commissioner'
    } catch {
      window.localStorage.removeItem(storageKey); setApiNativeSessionToken(''); setSession(emptySession); return false
    } finally {
      const elapsed = Math.round(performance.now() - startedAt)
      setInitialization((current) => ({ ...current, completedAt: new Date().toISOString(), sessionVerificationMs: elapsed, totalMs: elapsed }))
      setStatus('ready')
    }
  }, [])

  const acceptAuthentication = useCallback((result: Awaited<ReturnType<typeof commissionerLogin>>) => {
    if (!result.success || !result.authenticated || result.user.role !== 'Commissioner' || !result.sessionToken) {
      setSession({ ...emptySession, code: result.code, error: result.error, stage: result.stage })
      return false
    }
    window.localStorage.setItem(storageKey, result.sessionToken)
    setApiNativeSessionToken(result.sessionToken)
    setSession({ authenticated: true, code: result.code, diagnostics: result.diagnostics, error: '', oauthConfigured: false, permissions: result.permissions, stage: result.stage, user: result.user })
    return true
  }, [])

  const signInWithPassword = useCallback(async (password: string) => {
    setStatus('loading')
    try {
      return acceptAuthentication(await commissionerLogin(password))
    } catch {
      setSession({ ...emptySession, code: 'AUTH_LOGIN_FAILED', error: 'Unable to sign in.', stage: 'credentialVerification' })
      return false
    } finally { setStatus('ready') }
  }, [acceptAuthentication])

  const createCommissionerPassword = useCallback(async (password: string) => {
    setStatus('loading')
    try {
      return acceptAuthentication(await setupCommissionerPassword(password))
    } catch {
      setSession({ ...emptySession, code: 'AUTH_SETUP_FAILED', error: 'Unable to configure Commissioner access.', stage: 'credentialSetup' })
      return false
    } finally { setStatus('ready') }
  }, [acceptAuthentication])

  const signOut = useCallback(async () => {
    const token = window.localStorage.getItem(storageKey) ?? getActiveNativeSessionToken()
    try { if (token) await commissionerLogout(token) } finally {
      window.localStorage.removeItem(storageKey); setApiNativeSessionToken(''); setSession(emptySession); setStatus('ready')
    }
  }, [])

  useEffect(() => { const timer = window.setTimeout(() => void refreshSession(), 0); return () => window.clearTimeout(timer) }, [refreshSession])
  useEffect(() => { setSessionRecoveryHandler(refreshSession); return () => setSessionRecoveryHandler(null) }, [refreshSession])

  const value = useMemo<AuthContextValue>(() => ({
    authenticated: session.authenticated,
    authState: status === 'loading' ? 'initializing' : session.authenticated ? 'authenticated' : 'unauthenticated',
    code: session.code, diagnostics: session.diagnostics, error: session.error,
    hasPermission: (permission) => session.permissions[permission] === true,
    identity: null, initialization,
    isAtLeastRole: (role) => roleOrder.indexOf(session.user.role) >= roleOrder.indexOf(role),
    permissions: session.permissions, refreshSession, createCommissionerPassword, signInWithPassword, signOut,
    stage: session.stage, status, user: session.user,
  }), [createCommissionerPassword, initialization, refreshSession, session, signInWithPassword, signOut, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider.'); return context }
export default AuthProvider
