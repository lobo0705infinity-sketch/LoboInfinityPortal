import { getAuth, onAuthStateChanged, type Auth } from 'firebase/auth'
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import {
  getFirebaseEnvironmentDiagnostics,
  getFirebaseRuntime,
  getFirebaseRuntimeConfig,
} from '../../../firebase/firebaseConfig'
import {
  firestorePortalVersion,
  initializeFirestoreSchema,
} from './firestoreSchema'

export type FirestoreBootstrapCheck = {
  detail: string
  status: 'FAIL' | 'PASS' | 'WARN'
}

export type FirestoreBootstrapReport = {
  accessMatrix: FirestoreAccessMatrixEntry[]
  authentication: FirestoreBootstrapCheck
  collectionsInitialized: FirestoreBootstrapCheck
  connection: FirestoreBootstrapCheck
  environment: ReturnType<typeof getFirebaseEnvironmentDiagnostics>
  errors: string[]
  fallback: {
    active: boolean
    message: string
    provider: 'Google Sheets'
  }
  generatedAt: string
  indexes: FirestoreBootstrapCheck
  latencyMs: number
  overallHealth: 'FAIL' | 'PASS' | 'WARN'
  projectId: string
  provider: string
  readTest: FirestoreBootstrapCheck
  region: string
  schema: FirestoreBootstrapCheck & {
    version: number
  }
  security: FirestoreBootstrapCheck
  securityRulesVersion: string
  seed: FirestoreBootstrapCheck
  sdk: FirestoreBootstrapCheck
  user: {
    email: string
    role: string
    signedIn: boolean
  }
  writeTest: FirestoreBootstrapCheck
}

let bootstrapRun: Promise<FirestoreBootstrapReport> | null = null
export const firestoreSecurityRulesVersion = 'v7.3.2-firestore-security-rules'
const firebaseAuthWaitMs = 4000

type FirestoreAccessMatrixEntry = {
  assistantCommissioner: string
  collection: string
  commissioner: string
  player: string
  public: string
}

export const firestoreAccessMatrix: FirestoreAccessMatrixEntry[] = [
  {
    assistantCommissioner: 'Read; manage operational records where delegated',
    collection: 'events',
    commissioner: 'Create, update, archive',
    player: 'Read public event data',
    public: 'Read public event data',
  },
  {
    assistantCommissioner: 'Read',
    collection: 'players',
    commissioner: 'Manage player records',
    player: 'Read; update own player document',
    public: 'Read public player data',
  },
  {
    assistantCommissioner: 'Read; update/approve results',
    collection: 'games',
    commissioner: 'Full management',
    player: 'Read; submit games',
    public: 'Read public game data',
  },
  {
    assistantCommissioner: 'Manage registrations',
    collection: 'registrations',
    commissioner: 'Full management',
    player: 'Read; create and update own registration',
    public: 'Read public registration summaries',
  },
  {
    assistantCommissioner: 'Manage teams and rosters',
    collection: 'teams',
    commissioner: 'Full management',
    player: 'Read public teams',
    public: 'Read public teams',
  },
  {
    assistantCommissioner: 'Manage pairings',
    collection: 'pairings',
    commissioner: 'Full management',
    player: 'Read public pairings',
    public: 'Read public pairings',
  },
  {
    assistantCommissioner: 'Create and manage operational notifications',
    collection: 'notifications',
    commissioner: 'Full management',
    player: 'Read and update own notification state',
    public: 'No access',
  },
  {
    assistantCommissioner: 'Manage reference data',
    collection: 'missions/factions/analytics',
    commissioner: 'Full management',
    player: 'Read public analytics',
    public: 'Read public analytics',
  },
  {
    assistantCommissioner: 'No system writes',
    collection: 'settings',
    commissioner: 'Manage settings, schema, security, migration',
    player: 'Read public bootstrap settings only',
    public: 'Read public bootstrap settings only',
  },
]

export function getFirestoreBootstrapReport() {
  if (!bootstrapRun) {
    bootstrapRun = runFirestoreBootstrap()
  }

  return bootstrapRun
}

export async function runFirestoreBootstrap(): Promise<FirestoreBootstrapReport> {
  const startedAt = performance.now()
  const environment = getFirebaseEnvironmentDiagnostics()
  const provider = String(import.meta.env.VITE_DATA_PROVIDER ?? 'google')
  const region = String(import.meta.env.VITE_FIREBASE_REGION ?? 'default')
  const config = getFirebaseRuntimeConfig()

  if (!config) {
    return buildReport({
      authentication: fail('Firebase config unavailable.'),
      collectionsInitialized: fail('Schema initialization skipped.'),
      connection: fail('Firestore was not initialized.'),
      environment,
      errors: environment.missing.length > 0
        ? [`Missing Firebase variables: ${environment.missing.join(', ')}`]
        : ['Firebase configuration is incomplete.'],
      indexes: warn('No Firestore index check was run.'),
      latencyMs: performance.now() - startedAt,
      projectId: '',
      provider,
      readTest: fail('Read test skipped.'),
      region,
      schema: { ...fail('Schema unavailable.'), version: 0 },
      security: warn('Security rules cannot be verified without Firestore.'),
      securityRulesVersion: firestoreSecurityRulesVersion,
      seed: fail('Seed check skipped.'),
      sdk: fail('Firebase SDK did not initialize.'),
      user: {
        email: '',
        role: 'Anonymous',
        signedIn: false,
      },
      writeTest: fail('Write test skipped.'),
    })
  }

  try {
    const runtime = getFirebaseRuntime()
    const auth = getAuth(runtime.app)
    const user = await getCurrentFirebaseUser(auth)

    if (!user.signedIn) {
      return buildReport({
        authentication: fail(
          'Firebase Authentication did not complete. Firestore Bootstrap waits for Firebase Auth before read/write probes.',
        ),
        collectionsInitialized: fail('Schema initialization skipped until Firebase Auth succeeds.'),
        connection: pass('Firebase SDK initialized. Firestore client is available.'),
        environment,
        errors: [
          'Firebase Authentication has no current user. Verify Google provider is enabled in Firebase Authentication and the portal Google credential can sign into Firebase.',
        ],
        indexes: warn('No Firestore index check was run.'),
        latencyMs: performance.now() - startedAt,
        projectId: runtime.config.projectId,
        provider,
        readTest: fail('Read test skipped until Firebase Auth succeeds.'),
        region,
        schema: { ...fail('Schema unavailable until Firebase Auth succeeds.'), version: 0 },
        security: fail('Firestore rules will deny writes without Firebase Authentication.'),
        securityRulesVersion: firestoreSecurityRulesVersion,
        seed: fail('Seed check skipped until Firebase Auth succeeds.'),
        sdk: pass('Firebase SDK initialized.'),
        user,
        writeTest: fail('Write test skipped until Firebase Auth succeeds.'),
      })
    }

    const probeRef = doc(runtime.db, 'settings', 'bootstrapProbe')
    const schemaRef = doc(runtime.db, 'settings', 'schema')

    const schema = await initializeFirestoreSchema(
      runtime.db,
      runtime.config.projectId,
      {
        initializedBy: 'bootstrap',
        portalVersion: firestorePortalVersion,
      },
    )
    const schemaSnapshot = await getDoc(schemaRef)
    await setDoc(
      probeRef,
      {
        checkedAt: serverTimestamp(),
        provider: 'firestore',
        purpose: 'bootstrap-write-test',
      },
      { merge: true },
    )
    await deleteDoc(probeRef)

    return buildReport({
      authentication: auth
        ? pass(`Firebase Auth current user established for ${user.email || 'authenticated user'}.`)
        : warn('Firebase Auth SDK was not available.'),
      collectionsInitialized: schema.status === 'healthy'
        ? pass(`${schema.collections.length} collections initialized.`)
        : fail('One or more required collections failed initialization.'),
      connection: pass('Firestore initialized and responded.'),
      environment,
      errors: environment.missing.length > 0
        ? [`Missing Firebase variables: ${environment.missing.join(', ')}`]
        : [],
      indexes: warn('No composite indexes are required for bootstrap checks.'),
      latencyMs: performance.now() - startedAt,
      projectId: runtime.config.projectId,
      provider,
      readTest: schemaSnapshot.exists()
        ? pass('settings/schema read succeeded.')
        : fail('settings/schema was not readable.'),
      region,
      schema: {
        ...(schema.schemaVersion === 1
          ? pass('settings/schema is present.')
          : fail('settings/schema has an unexpected version.')),
        version: schema.schemaVersion,
      },
      security: pass('Client read/write probe completed with current rules.'),
      securityRulesVersion: firestoreSecurityRulesVersion,
      seed:
        schema.seedEventExists &&
        schema.defaultSettingsExists &&
        schema.defaultAnalyticsExists
          ? pass('Current League, default settings, and default analytics are present.')
          : fail('One or more required seed documents are missing.'),
      sdk: pass('Firebase SDK initialized.'),
      user,
      writeTest: pass('Temporary settings/bootstrapProbe write and cleanup succeeded.'),
    })
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Unknown Firestore bootstrap failure.'

    return buildReport({
      authentication: warn('Firebase Auth availability was not verified.'),
      collectionsInitialized: fail('Schema initialization failed.'),
      connection: fail(message),
      environment,
      errors: [message],
      indexes: warn('No Firestore index check was run.'),
      latencyMs: performance.now() - startedAt,
      projectId: config.projectId,
      provider,
      readTest: fail('Read test failed.'),
      region,
      schema: { ...fail('Schema unavailable.'), version: 0 },
      security: warn('Security status could not be verified.'),
      securityRulesVersion: firestoreSecurityRulesVersion,
      seed: fail('Seed check failed.'),
      sdk: fail('Firebase SDK or Firestore initialization failed.'),
      user: {
        email: '',
        role: 'Unknown',
        signedIn: false,
      },
      writeTest: fail('Write test failed.'),
    })
  }
}

function buildReport(
  report: Omit<
    FirestoreBootstrapReport,
    'accessMatrix' | 'fallback' | 'generatedAt' | 'overallHealth'
  >,
): FirestoreBootstrapReport {
  const checks = [
    report.authentication,
    report.collectionsInitialized,
    report.connection,
    report.indexes,
    report.readTest,
    report.schema,
    report.security,
    report.seed,
    report.sdk,
    report.writeTest,
  ]
  const hasFailure = checks.some((check) => check.status === 'FAIL')
  const hasWarning = checks.some((check) => check.status === 'WARN')
  const overallHealth = hasFailure ? 'FAIL' : hasWarning ? 'WARN' : 'PASS'

  return {
    ...report,
    accessMatrix: firestoreAccessMatrix,
    fallback: {
      active: hasFailure,
      message: hasFailure
        ? 'Firestore unavailable. Google Sheets remains active. No production impact.'
        : 'Firestore bootstrap passed. Google Sheets remains the production source until provider configuration changes.',
      provider: 'Google Sheets',
    },
    generatedAt: new Date().toISOString(),
    latencyMs: Math.round(report.latencyMs),
    overallHealth,
  }
}

async function getCurrentFirebaseUser(auth: Auth) {
  const currentUser = auth.currentUser ?? await waitForFirebaseUser(auth)

  if (!currentUser) {
    return {
      email: '',
      role: 'Anonymous',
      signedIn: false,
    }
  }

  const token = await currentUser.getIdTokenResult()

  return {
    email: currentUser.email ?? '',
    role: typeof token.claims.role === 'string' ? token.claims.role : 'No role claim',
    signedIn: true,
  }
}

function waitForFirebaseUser(auth: Auth) {
  return new Promise<Auth['currentUser']>((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe()
      resolve(auth.currentUser)
    }, firebaseAuthWaitMs)

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout)
      unsubscribe()
      resolve(user)
    })
  })
}

function pass(detail: string): FirestoreBootstrapCheck {
  return {
    detail,
    status: 'PASS',
  }
}

function warn(detail: string): FirestoreBootstrapCheck {
  return {
    detail,
    status: 'WARN',
  }
}

function fail(detail: string): FirestoreBootstrapCheck {
  return {
    detail,
    status: 'FAIL',
  }
}
