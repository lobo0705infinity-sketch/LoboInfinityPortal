import type { AuthSession } from '../api'
import {
  signInToFirebaseWithGoogleToken,
  type FirebaseIdentityBridgeResult,
} from '../../firebase/firebaseAuthBridge'

export const identityVersion = '7.3.4'

export type IdentitySynchronizationStatus =
  | 'FAILED'
  | 'PASS'
  | 'SYNC_REQUIRED'
  | 'UNAUTHENTICATED'

export type UnifiedIdentityReport = {
  appsScript: IdentityStage
  claimVersion: string
  expectedClaims: IdentityClaims
  firebase: IdentityStage & {
    claims: Record<string, unknown>
    code: string
    uid: string
  }
  generatedAt: string
  google: IdentityStage
  identityHealth: IdentitySynchronizationStatus
  mismatches: string[]
  playerMapping: IdentityStage
  portalSession: IdentityStage
  synchronized: boolean
  version: string
}

export type IdentityStage = {
  detail: string
  email: string
  leaguePlayer: string
  role: string
  status: IdentitySynchronizationStatus
}

export type IdentityClaims = {
  assistantCommissioner: boolean
  commissioner: boolean
  leaguePlayer: string
  playerId: string
  registeredEvents: string[]
  role: string
}

const identityStorageKey = 'lobo-unified-identity-report'

export async function synchronizeIdentity(
  session: AuthSession,
  googleIdToken: string,
): Promise<UnifiedIdentityReport> {
  const expectedClaims = buildExpectedClaims(session)
  const firebase = session.authenticated && googleIdToken
    ? await signInToFirebaseWithGoogleToken(googleIdToken)
    : emptyFirebaseIdentity('Portal session is not authenticated.')
  const report = buildIdentityReport(session, firebase, expectedClaims)

  cacheIdentityReport(report)

  return report
}

export function getCachedIdentityReport(): UnifiedIdentityReport | null {
  try {
    const raw = window.localStorage.getItem(identityStorageKey)
    return raw ? (JSON.parse(raw) as UnifiedIdentityReport) : null
  } catch {
    return null
  }
}

export function clearCachedIdentityReport() {
  window.localStorage.removeItem(identityStorageKey)
}

export function buildExpectedClaims(session: AuthSession): IdentityClaims {
  const role = session.user.role

  return {
    assistantCommissioner:
      role === 'Assistant Commissioner' || role === 'Commissioner',
    commissioner: role === 'Commissioner',
    leaguePlayer: session.user.leaguePlayer,
    playerId: session.user.leaguePlayer,
    registeredEvents: [],
    role,
  }
}

function buildIdentityReport(
  session: AuthSession,
  firebase: FirebaseIdentityBridgeResult,
  expectedClaims: IdentityClaims,
): UnifiedIdentityReport {
  if (!session.authenticated) {
    return {
      appsScript: stage('UNAUTHENTICATED', session, 'Apps Script session is not authenticated.'),
      claimVersion: identityVersion,
      expectedClaims,
      firebase: firebaseStage(firebase),
      generatedAt: new Date().toISOString(),
      google: stage('UNAUTHENTICATED', session, 'Google session is not authenticated.'),
      identityHealth: 'UNAUTHENTICATED',
      mismatches: ['No authenticated portal session.'],
      playerMapping: stage('UNAUTHENTICATED', session, 'No league player mapping.'),
      portalSession: stage('UNAUTHENTICATED', session, 'Portal session is unauthenticated.'),
      synchronized: false,
      version: identityVersion,
    }
  }

  const mismatches = compareClaims(expectedClaims, firebase)
  const firebaseStatus = firebase.signedIn
    ? mismatches.length === 0
      ? 'PASS'
      : 'SYNC_REQUIRED'
    : 'FAILED'
  const identityHealth = firebaseStatus === 'PASS' ? 'PASS' : firebaseStatus

  return {
    appsScript: stage('PASS', session, 'Apps Script validated the Google session.'),
    claimVersion: identityVersion,
    expectedClaims,
    firebase: {
      ...firebaseStage(firebase),
      status: firebaseStatus,
    },
    generatedAt: new Date().toISOString(),
    google: stage('PASS', session, 'Google OAuth token accepted by portal session validation.'),
    identityHealth,
    mismatches,
    playerMapping: session.user.leaguePlayer
      ? stage('PASS', session, 'League player mapping resolved.')
      : stage('FAILED', session, 'League player mapping is missing.'),
    portalSession: stage('PASS', session, 'Portal session is authenticated.'),
    synchronized: identityHealth === 'PASS',
    version: identityVersion,
  }
}

function compareClaims(
  expected: IdentityClaims,
  firebase: FirebaseIdentityBridgeResult,
) {
  const mismatches: string[] = []

  if (!firebase.signedIn) {
    mismatches.push(firebase.reason || 'Firebase Authentication is not established.')
    return mismatches
  }

  if (firebase.role !== expected.role) {
    mismatches.push(
      `Role claim mismatch. Apps Script=${expected.role || 'none'} Firebase=${firebase.role || 'none'}.`,
    )
  }

  if (firebase.leaguePlayer !== expected.leaguePlayer) {
    mismatches.push(
      `leaguePlayer claim mismatch. Apps Script=${expected.leaguePlayer || 'none'} Firebase=${firebase.leaguePlayer || 'none'}.`,
    )
  }

  const commissionerClaim = firebase.claims.commissioner === true
  if (commissionerClaim !== expected.commissioner) {
    mismatches.push(
      `commissioner claim mismatch. Apps Script=${expected.commissioner} Firebase=${commissionerClaim}.`,
    )
  }

  const assistantClaim = firebase.claims.assistantCommissioner === true
  if (assistantClaim !== expected.assistantCommissioner) {
    mismatches.push(
      `assistantCommissioner claim mismatch. Apps Script=${expected.assistantCommissioner} Firebase=${assistantClaim}.`,
    )
  }

  return mismatches
}

function firebaseStage(firebase: FirebaseIdentityBridgeResult) {
  return {
    claims: firebase.claims,
    code: firebase.code,
    detail: firebase.signedIn
      ? 'Firebase Authentication session established.'
      : firebase.reason || 'Firebase Authentication is unavailable.',
    email: firebase.email,
    leaguePlayer: firebase.leaguePlayer,
    role: firebase.role,
    status: firebase.signedIn ? 'PASS' : 'FAILED',
    uid: firebase.uid,
  } satisfies UnifiedIdentityReport['firebase']
}

function stage(
  status: IdentitySynchronizationStatus,
  session: AuthSession,
  detail: string,
): IdentityStage {
  return {
    detail,
    email: session.user.email,
    leaguePlayer: session.user.leaguePlayer,
    role: session.user.role,
    status,
  }
}

function emptyFirebaseIdentity(reason: string): FirebaseIdentityBridgeResult {
  return {
    claims: {},
    code: 'FIREBASE_AUTH_SKIPPED',
    email: '',
    leaguePlayer: '',
    playerId: '',
    reason,
    role: '',
    signedIn: false,
    uid: '',
  }
}

function cacheIdentityReport(report: UnifiedIdentityReport) {
  window.localStorage.setItem(identityStorageKey, JSON.stringify(report))
}
