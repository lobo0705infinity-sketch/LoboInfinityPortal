import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as signOutFirebase,
} from 'firebase/auth'
import { getFirebaseRuntime, getFirebaseRuntimeConfig } from './firebaseConfig'

export async function signInToFirebaseWithGoogleToken(idToken: string) {
  if (!idToken || !getFirebaseRuntimeConfig()) {
    return {
      signedIn: false,
      reason: 'Firebase is not configured.',
    }
  }

  try {
    const runtime = getFirebaseRuntime()
    const auth = getAuth(runtime.app)
    const credential = GoogleAuthProvider.credential(idToken)
    const result = await signInWithCredential(auth, credential)
    const tokenResult = await result.user.getIdTokenResult()

    return {
      email: result.user.email ?? '',
      role: readClaim(tokenResult.claims.role),
      signedIn: true,
    }
  } catch (error) {
    return {
      signedIn: false,
      reason: error instanceof Error ? error.message : 'Firebase Auth sign-in failed.',
    }
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
