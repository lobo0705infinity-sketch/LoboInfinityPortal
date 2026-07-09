import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as signOutFirebase,
} from 'firebase/auth'
import { getFirebaseRuntime, getFirebaseRuntimeConfig } from './firebaseConfig'

export type FirebaseIdentityBridgeResult = {
  claims: Record<string, unknown>
  code: string
  email: string
  leaguePlayer: string
  playerId: string
  reason: string
  role: string
  signedIn: boolean
  uid: string
}

export async function signInToFirebaseWithGoogleToken(idToken: string) {
  if (!idToken || !getFirebaseRuntimeConfig()) {
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
    const credential = GoogleAuthProvider.credential(idToken)
    const result = await signInWithCredential(auth, credential)
    const tokenResult = await result.user.getIdTokenResult()

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
    return {
      claims: {},
      code: readFirebaseErrorCode(error),
      email: '',
      leaguePlayer: '',
      playerId: '',
      signedIn: false,
      uid: '',
      role: '',
      reason: formatFirebaseAuthError(error),
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
