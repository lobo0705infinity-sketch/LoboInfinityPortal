import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as signOutFirebase,
} from 'firebase/auth'
import { getFirebaseRuntime, getFirebaseRuntimeConfig } from './firebaseConfig'

export type FirebaseIdentityBridgeResult = {
  claims: Record<string, unknown>
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
      email: '',
      leaguePlayer: '',
      playerId: '',
      signedIn: false,
      uid: '',
      role: '',
      reason: error instanceof Error ? error.message : 'Firebase Auth sign-in failed.',
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
