import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as signOutFirebase,
} from 'firebase/auth'
import { getFirebaseRuntime, getFirebaseRuntimeConfig } from './firebaseConfig'

let identityToolkitFetchIntercepted = false

function summarizeBody(body: BodyInit | null | undefined) {
  if (!body) {
    return null
  }

  if (typeof body === 'string') {
    return body
      .replace(/id_token=[^&]+/, 'id_token=[REDACTED]')
      .replace(/access_token=[^&]+/, 'access_token=[REDACTED]')
  }

  if (body instanceof FormData) {
    const entries: Record<string, string> = {}
    body.forEach((value, key) => {
      entries[key] = key === 'id_token' || key === 'access_token'
        ? '[REDACTED]'
        : String(value)
    })
    return entries
  }

  if (body instanceof URLSearchParams) {
    const entries: Record<string, string> = {}
    body.forEach((value, key) => {
      entries[key] = key === 'id_token' || key === 'access_token'
        ? '[REDACTED]'
        : value
    })
    return entries
  }

  return String(body)
}

function getFetchRequestDetails(input: URL | RequestInfo, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return {
    url,
    method: init?.method || (typeof input === 'string' ? 'GET' : input instanceof URL ? 'GET' : input.method),
    headers: init?.headers,
    body: summarizeBody(init?.body),
  }
}

function installIdentityToolkitFetchInterceptor() {
  if (identityToolkitFetchIntercepted || typeof window === 'undefined' || !window.fetch) {
    return
  }

  identityToolkitFetchIntercepted = true
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: URL | RequestInfo, init?: RequestInit) => {
    const request = getFetchRequestDetails(input, init)
    const shouldLog = request.url.includes('identitytoolkit.googleapis.com/v1/accounts:signInWithIdp')

    if (shouldLog) {
      console.debug('[FirebaseAuthBridge] intercepted fetch request to Identity Toolkit', request)
    }

    const response = await originalFetch(input, init)
    if (shouldLog) {
      const responseClone = response.clone()
      let responseBody: unknown

      try {
        responseBody = await responseClone.json()
      } catch {
        responseBody = await responseClone.text()
      }

      console.debug('[FirebaseAuthBridge] intercepted fetch response from Identity Toolkit', {
        url: request.url,
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
      })
    }

    return response
  }
}

export type FirebaseIdentityBridgeResult = {
  claims: Record<string, unknown>
  code: string
  email: string
  errorBody?: unknown
  leaguePlayer: string
  playerId: string
  reason: string
  role: string
  signedIn: boolean
  uid: string
}

export async function signInToFirebaseWithGoogleToken(idToken: string) {
  if (!idToken || !getFirebaseRuntimeConfig()) {
    console.warn('[FirebaseAuthBridge] missing firebase config or idToken', {
      hasIdToken: Boolean(idToken),
      firebaseConfigConfigured: Boolean(getFirebaseRuntimeConfig()),
    })

    return {
      claims: {},
      code: 'FIREBASE_CONFIG_MISSING',
      email: '',
      leaguePlayer: '',
      playerId: '',
      signedIn: false,
      uid: '',
      role: '',
      reason: 'Firebase is not configured.',
    } satisfies FirebaseIdentityBridgeResult
  }

  try {
    const runtime = getFirebaseRuntime()
    const auth = getAuth(runtime.app)
    console.groupCollapsed('[FirebaseAuthBridge] signInToFirebaseWithGoogleToken')
    console.debug('[FirebaseAuthBridge] auth initialized', {
      currentUserBefore: auth.currentUser?.uid ?? null,
      authDomain: runtime.config.authDomain,
      projectId: runtime.config.projectId,
      idTokenLength: idToken.length,
      firebaseAppName: runtime.app.name,
    })

    installIdentityToolkitFetchInterceptor()

    const credential = GoogleAuthProvider.credential(idToken)

    const credentialDebug: Record<string, unknown> = {
      providerId: credential.providerId,
      tokenType: 'GoogleIdToken',
      credentialSource: 'GoogleAuthProvider.credential(idToken)',
      rawIdTokenLength: idToken.length,
    }

    if ('accessToken' in credential && credential.accessToken) {
      credentialDebug.googleAccessTokenPresent = true
      credentialDebug.googleAccessTokenLength = String(credential.accessToken).length
    } else {
      credentialDebug.googleAccessTokenPresent = false
    }

    console.debug('[FirebaseAuthBridge] credential created', credentialDebug)

    console.debug('[FirebaseAuthBridge] signInWithCredential payload', {
      postUrl: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp',
      requestBody: {
        postBody: `id_token=[REDACTED]&providerId=google.com${credentialDebug.googleAccessTokenPresent ? '&access_token=[REDACTED]' : ''}`,
        returnSecureToken: true,
        returnIdpCredential: true,
      },
      excludeSecrets: true,
    })

    const result = await signInWithCredential(auth, credential)
    const tokenResult = await result.user.getIdTokenResult()

    console.debug('[FirebaseAuthBridge] signInWithCredential resolved', {
      uid: result.user.uid,
      email: result.user.email,
      providerData: result.user.providerData.map((provider) => provider.providerId),
      currentUserAfter: auth.currentUser?.uid ?? null,
      tokenClaims: tokenResult.claims,
    })
    console.groupEnd()

    return {
      claims: tokenResult.claims,
      code: 'FIREBASE_AUTH_SUCCESS',
      email: result.user.email ?? '',
      leaguePlayer: readClaim(tokenResult.claims.leaguePlayer),
      playerId: readClaim(tokenResult.claims.playerId),
      role: readClaim(tokenResult.claims.role),
      reason: '',
      signedIn: true,
      uid: result.user.uid,
    } satisfies FirebaseIdentityBridgeResult
  } catch (error) {
    const code = readFirebaseErrorCode(error)
    const reason = formatFirebaseAuthError(error)
    const errorBody = extractFirebaseErrorBody(error)

    console.warn('[FirebaseAuthBridge] signInWithCredential failed', {
      code,
      reason,
      errorBody,
      error,
    })

    return {
      claims: {},
      code,
      email: '',
      errorBody,
      leaguePlayer: '',
      playerId: '',
      signedIn: false,
      uid: '',
      role: '',
      reason,
    } satisfies FirebaseIdentityBridgeResult
  }
}

export async function signOutOfFirebase() {
  if (!getFirebaseRuntimeConfig()) {
    return
  }

  try {
    const runtime = getFirebaseRuntime()
    await signOutFirebase(getAuth(runtime.app))
  } catch {
    // Portal sign-out should not be blocked by Firestore pre-migration auth.
  }
}

function readClaim(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readFirebaseErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') {
      return code
    }
  }

  return 'FIREBASE_AUTH_FAILED'
}

function formatFirebaseAuthError(error: unknown) {
  const code = readFirebaseErrorCode(error)
  const message = error instanceof Error
    ? error.message
    : 'Firebase Auth sign-in failed.'

  if (code === 'auth/operation-not-allowed') {
    return `${code}: Google sign-in is not enabled in Firebase Authentication. Enable the Google provider for the Firebase project.`
  }

  if (code === 'auth/invalid-credential' || code === 'auth/invalid-id-token') {
    return `${code}: Firebase rejected the Google credential. Verify the Google OAuth client is authorized for Firebase Authentication.`
  }

  if (code === 'auth/network-request-failed') {
    return `${code}: Firebase Authentication could not be reached from the browser.`
  }

  return `${code}: ${message}`
}

function extractFirebaseErrorBody(error: unknown) {
  if (error && typeof error === 'object') {
    if ('customData' in error && error !== null) {
      const customData = (error as { customData?: unknown }).customData
      if (customData && typeof customData === 'object') {
        return customData
      }
    }

    if ('message' in error && error !== null) {
      return { message: (error as { message?: unknown }).message }
    }
  }

  return null
}
