import type { AuthSession, PortalUser } from '../services/api'

type SessionTransition =
  | AuthSession
  | ((current: AuthSession) => AuthSession)

type SessionTransitionReason =
  | 'google_sign_in'
  | 'manual_sign_out'
  | 'session_expiration'
  | 'session_refresh_result'
  | 'session_rejected'
  | 'session_request_failed'
  | 'session_restored'
  | 'token_invalidation'

type SessionStateOwner = {
  clearIdentity: () => void
  guestUser: PortalUser
  transitionSession: (
    transition: SessionTransition,
    reason: SessionTransitionReason,
  ) => void
}

type SessionCredentialOwner = {
  clearActiveCredential: () => void
  clearPersistedCredential: () => void
}

type SessionRequestOwner = {
  requestSession: () => Promise<AuthSession>
  shouldInvalidateCredential: (code: string) => boolean
}

type SessionIdentityOwner = {
  synchronizeIdentity: (
    session: AuthSession,
    credential: string,
  ) => Promise<void>
}

type SessionCreationOptions =
  & SessionCredentialOwner
  & SessionIdentityOwner
  & SessionRequestOwner
  & SessionStateOwner
  & {
    activateCredential: (credential: string) => void
    credential: string
    lifecycleCompleted: (elapsedMs: number) => void
    lifecycleStarted: () => void
    onCredentialActivated: (credential: string) => void
    onCredentialPersisted: (credential: string) => void
    onSessionRejected: (session: AuthSession) => void
    onSessionRequestException: (error: unknown, elapsedMs: number) => void
    onSessionRequestFailed: (error: unknown) => void
    onSessionResolved: (session: AuthSession, elapsedMs: number) => void
    persistCredential: (credential: string) => void
    startedAt: number
  }

type SessionRefreshOptions =
  & SessionCredentialOwner
  & SessionIdentityOwner
  & SessionRequestOwner
  & SessionStateOwner
  & {
    activateCredential: (credential: string) => void
    describeCredential: (credential: string) => Promise<unknown>
    isCredentialValid: (credential: string) => boolean
    lifecycleCompleted: () => void
    lifecycleStarted: () => void
    onCredentialActivated: (credential: string) => void
    onCredentialRead: (credential: string) => void
    onInvalidStoredCredential: (
      credentialDiagnostics: unknown,
      elapsedMs: number,
    ) => void
    onSessionRequestException: (error: unknown, elapsedMs: number) => void
    onSessionRequestFailed: (error: unknown, hadCredential: boolean) => void
    onSessionResolved: (session: AuthSession, elapsedMs: number) => void
    onVerificationCompleted: (elapsedMs: number) => void
    readPersistedCredential: () => string
    startedAt: number
  }

type SessionDestructionOptions = SessionCredentialOwner & SessionStateOwner & {
  cancelGoogleIdentity: () => void
  destroyExternalIdentity: () => void
}

type SessionInvalidationOptions = SessionCredentialOwner & {
  clearIdentity?: () => void
}

type SessionRecoveryHandler = () => Promise<boolean>

let sessionRecoveryHandler: SessionRecoveryHandler | null = null
let pendingSessionRecovery: Promise<boolean> | null = null

async function createSession(options: SessionCreationOptions) {
  options.lifecycleStarted()
  options.persistCredential(options.credential)
  options.onCredentialPersisted(options.credential)
  options.onCredentialActivated(options.credential)
  options.activateCredential(options.credential)

  try {
    const nextSession = await options.requestSession()
    options.onSessionResolved(nextSession, performance.now() - options.startedAt)

    if (
      !nextSession.authenticated &&
      options.shouldInvalidateCredential(nextSession.code)
    ) {
      invalidateSession({
        clearActiveCredential: options.clearActiveCredential,
        clearPersistedCredential: options.clearPersistedCredential,
      })
    }

    if (!nextSession.authenticated) {
      options.onSessionRejected(nextSession)
    }

    if (nextSession.authenticated) {
      await options.synchronizeIdentity(nextSession, options.credential)
    } else {
      options.clearIdentity()
    }

    transitionSession(
      options,
      nextSession,
      nextSession.authenticated ? 'google_sign_in' : 'session_rejected',
    )
  } catch (error) {
    options.onSessionRequestException(error, performance.now() - options.startedAt)
    invalidateSession({
      ...options,
      clearIdentity: options.clearIdentity,
    })
    options.onSessionRequestFailed(error)
    transitionSession(
      options,
      buildUnavailableSessionTransition(
        options.guestUser,
        error,
      ),
      'session_request_failed',
    )
  } finally {
    options.lifecycleCompleted(performance.now() - options.startedAt)
  }
}

async function refreshSession(options: SessionRefreshOptions) {
  options.lifecycleStarted()
  const storedCredential = options.readPersistedCredential()

  try {
    if (storedCredential) {
      options.onCredentialRead(storedCredential)

      if (!options.isCredentialValid(storedCredential)) {
        const credentialDiagnostics =
          await options.describeCredential(storedCredential)
        invalidateSession({
          ...options,
          clearIdentity: options.clearIdentity,
        })
        options.onInvalidStoredCredential(
          credentialDiagnostics,
          performance.now() - options.startedAt,
        )
        transitionSession(
          options,
          buildGuestSessionTransition(options.guestUser),
          'token_invalidation',
        )
        options.onVerificationCompleted(performance.now() - options.startedAt)
        return false
      }

      options.onCredentialActivated(storedCredential)
    }

    options.activateCredential(storedCredential)

    const nextSession = await options.requestSession()
    options.onSessionResolved(nextSession, performance.now() - options.startedAt)

    if (
      !nextSession.authenticated &&
      options.shouldInvalidateCredential(nextSession.code)
    ) {
      invalidateSession({
        clearActiveCredential: options.clearActiveCredential,
        clearPersistedCredential: options.clearPersistedCredential,
      })
    }

    if (nextSession.authenticated && storedCredential) {
      await options.synchronizeIdentity(nextSession, storedCredential)
    } else {
      options.clearIdentity()
    }

    transitionSession(
      options,
      nextSession,
      nextSession.authenticated
        ? 'session_restored'
        : nextSession.code === 'AUTH_GOOGLE_TOKEN_EXPIRED'
          ? 'session_expiration'
          : 'session_refresh_result',
    )
    options.onVerificationCompleted(performance.now() - options.startedAt)
    return nextSession.authenticated
  } catch (error) {
    options.onSessionRequestException(error, performance.now() - options.startedAt)
    invalidateSession({
      ...options,
      clearIdentity: options.clearIdentity,
    })
    options.onSessionRequestFailed(error, Boolean(storedCredential))
    transitionSession(
      options,
      buildUnavailableSessionTransition(
        options.guestUser,
        error,
      ),
      'session_request_failed',
    )
    return false
  } finally {
    options.lifecycleCompleted()
  }
}

function invalidateSession(options: SessionInvalidationOptions) {
  options.clearPersistedCredential()
  options.clearActiveCredential()
  options.clearIdentity?.()
}

function destroySession(options: SessionDestructionOptions) {
  options.clearPersistedCredential()
  options.clearActiveCredential()
  options.cancelGoogleIdentity()
  options.destroyExternalIdentity()
  options.clearIdentity()
  transitionSession(
    options,
    buildGuestSessionTransition(options.guestUser),
    'manual_sign_out',
  )
}

function registerRecoveryHandler(handler: SessionRecoveryHandler | null) {
  sessionRecoveryHandler = handler
}

async function recoverSession() {
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

function transitionSession(
  owner: SessionStateOwner,
  transition: SessionTransition,
  reason: SessionTransitionReason,
) {
  owner.transitionSession(transition, reason)
}

function buildGuestSessionTransition(guestUser: PortalUser) {
  return (current: AuthSession): AuthSession => ({
    ...current,
    authenticated: false,
    code: '',
    diagnostics: {},
    error: '',
    permissions: {},
    stage: '',
    user: guestUser,
  })
}

function buildUnavailableSessionTransition(
  guestUser: PortalUser,
  error: unknown,
) {
  return (current: AuthSession): AuthSession => ({
    ...current,
    authenticated: false,
    code: 'AUTH_SESSION_REQUEST_FAILED',
    diagnostics: {},
    error: error instanceof Error ? error.message : 'Session unavailable.',
    permissions: {},
    stage: 'frontendSession',
    user: guestUser,
  })
}

export const CanonicalSessionLifecycleCoordinator = Object.freeze({
  createSession,
  destroySession,
  invalidateSession,
  recoverSession,
  refreshSession,
  registerRecoveryHandler,
})
