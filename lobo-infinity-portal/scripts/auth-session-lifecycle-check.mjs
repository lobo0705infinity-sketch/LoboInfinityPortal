import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const coordinatorPath = resolve(
  root,
  'src/auth/CanonicalSessionLifecycleCoordinator.ts',
)
const coordinatorSource = read('src/auth/CanonicalSessionLifecycleCoordinator.ts')
const authContextSource = read('src/auth/AuthContext.tsx')
const apiCoreSource = read('src/services/apiCore.ts')
const authApiSource = read('backend/AuthApi.gs')
const coordinator = await loadCoordinator()

const checks = [
  {
    label: 'CanonicalSessionLifecycleCoordinator owns every session lifecycle operation',
    pass: [
      'createSession',
      'refreshSession',
      'recoverSession',
      'invalidateSession',
      'destroySession',
      'transitionSession',
    ].every((name) => coordinatorSource.includes(`function ${name}(`)),
  },
  {
    label: 'AuthContext delegates creation, refresh, and destruction to the coordinator',
    pass:
      authContextSource.includes('CanonicalSessionLifecycleCoordinator.createSession({') &&
      authContextSource.includes('CanonicalSessionLifecycleCoordinator.refreshSession({') &&
      authContextSource.includes('CanonicalSessionLifecycleCoordinator.destroySession({'),
  },
  {
    label: 'apiCore delegates recovery-handler ownership and recovery execution',
    pass:
      apiCoreSource.includes('CanonicalSessionLifecycleCoordinator.registerRecoveryHandler(handler)') &&
      apiCoreSource.includes('return CanonicalSessionLifecycleCoordinator.recoverSession()') &&
      !apiCoreSource.includes('let sessionRecoveryHandler') &&
      !apiCoreSource.includes('let pendingSessionRecovery'),
  },
  {
    label: 'Backend authentication and session response implementation remain unchanged',
    pass:
      functionHash(authApiSource, 'getAuthSession') ===
        '5b47dc0fe0b73e0041d2b1185ca09a86a80948fed7e8da444a7d395230307346' &&
      functionHash(authApiSource, 'getRequestUser') ===
        'e0f6356607fe6c8b9cf642729b4db363e96684e8cb3c494f8dfff13cd2c9b452' &&
      functionHash(authApiSource, 'verifyGoogleIdentityToken') ===
        'f20598e31bfad7e83225aeb81128a6909650bdedda2b98fa2c1542327dabcd13',
  },
  {
    label: 'Session creation behavior is identical',
    pass:
      await verifyCreationBehavior() &&
      await verifyRejectedCreationBehavior() &&
      await verifyFailedCreationBehavior(),
  },
  {
    label: 'Session refresh behavior is identical',
    pass:
      await verifyRefreshBehavior() &&
      await verifyInvalidCredentialRefreshBehavior() &&
      await verifyFailedRefreshBehavior(),
  },
  {
    label: 'Session invalidation behavior is identical',
    pass: verifyInvalidationBehavior(),
  },
  {
    label: 'Session destruction behavior is identical',
    pass: verifyDestructionBehavior(),
  },
  {
    label: 'Session recovery behavior is identical and shares one in-flight recovery',
    pass: await verifyRecoveryBehavior(),
  },
]

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

if (checks.some((check) => !check.pass)) {
  process.exitCode = 1
}

async function verifyCreationBehavior() {
  const events = []
  const authenticated = session({ authenticated: true, code: 'AUTH_OK' })
  let finalSession = null
  let finalReason = ''

  await coordinator.createSession({
    ...commonOwners(events, (transition, reason) => {
      finalSession = applyTransition(transition, session())
      finalReason = reason
    }),
    activateCredential: (credential) => events.push(`activate:${credential}`),
    credential: 'credential',
    lifecycleCompleted: () => events.push('complete'),
    lifecycleStarted: () => events.push('start'),
    onCredentialActivated: () => events.push('activated'),
    onCredentialPersisted: () => events.push('persisted'),
    onSessionRejected: () => events.push('rejected'),
    onSessionRequestException: () => events.push('exception'),
    onSessionRequestFailed: () => events.push('failed'),
    onSessionResolved: () => events.push('resolved'),
    persistCredential: (credential) => events.push(`persist:${credential}`),
    requestSession: async () => authenticated,
    shouldInvalidateCredential: terminalCode,
    startedAt: performance.now(),
    synchronizeIdentity: async () => events.push('identity'),
  })

  assert.deepEqual(events, [
    'start',
    'persist:credential',
    'persisted',
    'activated',
    'activate:credential',
    'resolved',
    'identity',
    'transition:google_sign_in',
    'complete',
  ])
  assert.deepEqual(finalSession, authenticated)
  assert.equal(finalReason, 'google_sign_in')
  return true
}

async function verifyRefreshBehavior() {
  const events = []
  const authenticated = session({ authenticated: true, code: 'AUTH_OK' })
  let finalSession = null

  const recovered = await coordinator.refreshSession({
    ...commonOwners(events, (transition, reason) => {
      finalSession = applyTransition(transition, session())
      events.push(`transition:${reason}`)
    }, false),
    activateCredential: (credential) => events.push(`activate:${credential}`),
    describeCredential: async () => ({}),
    isCredentialValid: () => true,
    lifecycleCompleted: () => events.push('complete'),
    lifecycleStarted: () => events.push('start'),
    onCredentialActivated: () => events.push('activated'),
    onCredentialRead: () => events.push('read'),
    onInvalidStoredCredential: () => events.push('invalid'),
    onSessionRequestException: () => events.push('exception'),
    onSessionRequestFailed: () => events.push('failed'),
    onSessionResolved: () => events.push('resolved'),
    onVerificationCompleted: () => events.push('verified'),
    readPersistedCredential: () => 'credential',
    requestSession: async () => authenticated,
    shouldInvalidateCredential: terminalCode,
    startedAt: performance.now(),
    synchronizeIdentity: async () => events.push('identity'),
  })

  assert.equal(recovered, true)
  assert.deepEqual(finalSession, authenticated)
  assert.deepEqual(events, [
    'start',
    'read',
    'activated',
    'activate:credential',
    'resolved',
    'identity',
    'transition:session_restored',
    'verified',
    'complete',
  ])
  return true
}

async function verifyRejectedCreationBehavior() {
  const events = []
  const rejected = session({
    authenticated: false,
    code: 'AUTH_GOOGLE_TOKEN_EXPIRED',
    error: 'Google credential has expired.',
    stage: 'googleTokenVerification',
  })
  let finalSession = null

  await coordinator.createSession({
    ...commonOwners(events, (transition, reason) => {
      finalSession = applyTransition(transition, session())
      events.push(`transition:${reason}`)
    }, false),
    activateCredential: () => events.push('activate'),
    credential: 'credential',
    lifecycleCompleted: () => events.push('complete'),
    lifecycleStarted: () => events.push('start'),
    onCredentialActivated: () => events.push('activated'),
    onCredentialPersisted: () => events.push('persisted'),
    onSessionRejected: () => events.push('rejected'),
    onSessionRequestException: () => events.push('exception'),
    onSessionRequestFailed: () => events.push('failed'),
    onSessionResolved: () => events.push('resolved'),
    persistCredential: () => events.push('persist'),
    requestSession: async () => rejected,
    shouldInvalidateCredential: terminalCode,
    startedAt: performance.now(),
    synchronizeIdentity: async () => events.push('identity'),
  })

  assert.deepEqual(finalSession, rejected)
  assert.deepEqual(events, [
    'start',
    'persist',
    'persisted',
    'activated',
    'activate',
    'resolved',
    'persisted-cleared',
    'active-cleared',
    'rejected',
    'identity-cleared',
    'transition:session_rejected',
    'complete',
  ])
  return true
}

async function verifyFailedCreationBehavior() {
  const events = []
  let finalSession = null

  await coordinator.createSession({
    ...commonOwners(events, (transition, reason) => {
      finalSession = applyTransition(transition, session())
      events.push(`transition:${reason}`)
    }, false),
    activateCredential: () => events.push('activate'),
    credential: 'credential',
    lifecycleCompleted: () => events.push('complete'),
    lifecycleStarted: () => events.push('start'),
    onCredentialActivated: () => events.push('activated'),
    onCredentialPersisted: () => events.push('persisted'),
    onSessionRejected: () => events.push('rejected'),
    onSessionRequestException: () => events.push('exception'),
    onSessionRequestFailed: () => events.push('failed'),
    onSessionResolved: () => events.push('resolved'),
    persistCredential: () => events.push('persist'),
    requestSession: async () => {
      throw new Error('session_request_failed')
    },
    shouldInvalidateCredential: terminalCode,
    startedAt: performance.now(),
    synchronizeIdentity: async () => events.push('identity'),
  })

  assert.equal(finalSession.authenticated, false)
  assert.equal(finalSession.code, 'AUTH_SESSION_REQUEST_FAILED')
  assert.deepEqual(events, [
    'start',
    'persist',
    'persisted',
    'activated',
    'activate',
    'exception',
    'persisted-cleared',
    'active-cleared',
    'identity-cleared',
    'failed',
    'transition:session_request_failed',
    'complete',
  ])
  return true
}

async function verifyInvalidCredentialRefreshBehavior() {
  const events = []
  let finalSession = session({ authenticated: true, code: 'AUTH_OK' })

  const recovered = await coordinator.refreshSession({
    ...commonOwners(events, (transition, reason) => {
      finalSession = applyTransition(transition, finalSession)
      events.push(`transition:${reason}`)
    }, false),
    activateCredential: () => events.push('activate'),
    describeCredential: async () => ({ format: 'not_jwt' }),
    isCredentialValid: () => false,
    lifecycleCompleted: () => events.push('complete'),
    lifecycleStarted: () => events.push('start'),
    onCredentialActivated: () => events.push('activated'),
    onCredentialRead: () => events.push('read'),
    onInvalidStoredCredential: () => events.push('invalid'),
    onSessionRequestException: () => events.push('exception'),
    onSessionRequestFailed: () => events.push('failed'),
    onSessionResolved: () => events.push('resolved'),
    onVerificationCompleted: () => events.push('verified'),
    readPersistedCredential: () => 'invalid',
    requestSession: async () => session(),
    shouldInvalidateCredential: terminalCode,
    startedAt: performance.now(),
    synchronizeIdentity: async () => events.push('identity'),
  })

  assert.equal(recovered, false)
  assert.equal(finalSession.authenticated, false)
  assert.deepEqual(events, [
    'start',
    'read',
    'persisted-cleared',
    'active-cleared',
    'identity-cleared',
    'invalid',
    'transition:token_invalidation',
    'verified',
    'complete',
  ])
  return true
}

async function verifyFailedRefreshBehavior() {
  const events = []
  let finalSession = null

  const recovered = await coordinator.refreshSession({
    ...commonOwners(events, (transition, reason) => {
      finalSession = applyTransition(transition, session())
      events.push(`transition:${reason}`)
    }, false),
    activateCredential: () => events.push('activate'),
    describeCredential: async () => ({}),
    isCredentialValid: () => true,
    lifecycleCompleted: () => events.push('complete'),
    lifecycleStarted: () => events.push('start'),
    onCredentialActivated: () => events.push('activated'),
    onCredentialRead: () => events.push('read'),
    onInvalidStoredCredential: () => events.push('invalid'),
    onSessionRequestException: () => events.push('exception'),
    onSessionRequestFailed: () => events.push('failed'),
    onSessionResolved: () => events.push('resolved'),
    onVerificationCompleted: () => events.push('verified'),
    readPersistedCredential: () => 'credential',
    requestSession: async () => {
      throw new Error('session_request_failed')
    },
    shouldInvalidateCredential: terminalCode,
    startedAt: performance.now(),
    synchronizeIdentity: async () => events.push('identity'),
  })

  assert.equal(recovered, false)
  assert.equal(finalSession.code, 'AUTH_SESSION_REQUEST_FAILED')
  assert.deepEqual(events, [
    'start',
    'read',
    'activated',
    'activate',
    'exception',
    'persisted-cleared',
    'active-cleared',
    'identity-cleared',
    'failed',
    'transition:session_request_failed',
    'complete',
  ])
  return true
}

function verifyInvalidationBehavior() {
  const events = []
  coordinator.invalidateSession({
    clearActiveCredential: () => events.push('active-cleared'),
    clearIdentity: () => events.push('identity-cleared'),
    clearPersistedCredential: () => events.push('persisted-cleared'),
  })
  assert.deepEqual(events, [
    'persisted-cleared',
    'active-cleared',
    'identity-cleared',
  ])
  return true
}

function verifyDestructionBehavior() {
  const events = []
  let finalSession = session({ authenticated: true, code: 'AUTH_OK' })

  coordinator.destroySession({
    ...commonOwners(events, (transition, reason) => {
      finalSession = applyTransition(transition, finalSession)
      events.push(`transition:${reason}`)
    }, false),
    cancelGoogleIdentity: () => events.push('google-cancelled'),
    destroyExternalIdentity: () => events.push('firebase-destroyed'),
  })

  assert.deepEqual(events, [
    'persisted-cleared',
    'active-cleared',
    'google-cancelled',
    'firebase-destroyed',
    'identity-cleared',
    'transition:manual_sign_out',
  ])
  assert.equal(finalSession.authenticated, false)
  assert.equal(finalSession.user.role, 'Guest')
  return true
}

async function verifyRecoveryBehavior() {
  let calls = 0
  let resolveRecovery
  coordinator.registerRecoveryHandler(() => {
    calls += 1
    return new Promise((resolve) => {
      resolveRecovery = resolve
    })
  })

  const first = coordinator.recoverSession()
  const second = coordinator.recoverSession()
  assert.equal(calls, 1)
  resolveRecovery(true)
  assert.equal(await first, true)
  assert.equal(await second, true)

  coordinator.registerRecoveryHandler(null)
  assert.equal(await coordinator.recoverSession(), false)
  return true
}

function commonOwners(events, transitionSession, recordTransition = true) {
  return {
    clearActiveCredential: () => events.push('active-cleared'),
    clearIdentity: () => events.push('identity-cleared'),
    clearPersistedCredential: () => events.push('persisted-cleared'),
    guestUser: {
      email: '',
      role: 'Guest',
    },
    transitionSession: (transition, reason) => {
      if (recordTransition) {
        events.push(`transition:${reason}`)
      }
      transitionSession(transition, reason)
    },
  }
}

function applyTransition(transition, current) {
  return typeof transition === 'function' ? transition(current) : transition
}

function terminalCode(code) {
  return code === 'AUTH_GOOGLE_TOKEN_EXPIRED'
}

function session(overrides = {}) {
  return {
    authenticated: false,
    code: '',
    diagnostics: {},
    error: '',
    oauthConfigured: true,
    permissions: {},
    stage: '',
    user: {
      email: '',
      role: 'Guest',
    },
    ...overrides,
  }
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')
}

function functionHash(source, name) {
  return createHash('sha256').update(extractFunction(source, name)).digest('hex')
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)
  const braceStart = source.indexOf('{', start)
  let depth = 0

  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }

  return ''
}

async function loadCoordinator() {
  const source = readFileSync(coordinatorPath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
    fileName: coordinatorPath,
  }).outputText
  const url = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  const module = await import(url)
  return module.CanonicalSessionLifecycleCoordinator
}
