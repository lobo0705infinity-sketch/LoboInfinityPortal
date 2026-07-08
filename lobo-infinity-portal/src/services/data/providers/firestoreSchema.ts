import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore'

export const firestoreSchemaVersion = 1
export const firestorePortalVersion = '7.1.1'

export const requiredFirestoreCollections = [
  'events',
  'players',
  'games',
  'registrations',
  'teams',
  'pairings',
  'notifications',
  'missions',
  'factions',
  'analytics',
  'settings',
] as const

export type RequiredFirestoreCollection =
  (typeof requiredFirestoreCollections)[number]

export type FirestoreSchemaHealth = {
  collectionCounts: Record<string, number>
  collections: string[]
  defaultAnalyticsExists: boolean
  defaultSettingsExists: boolean
  initialized: boolean
  initializedAt: string
  latencyMs: number
  projectId: string
  provider: 'firestore'
  schemaVersion: number
  seedEventExists: boolean
  status: 'configured' | 'error' | 'healthy' | 'unconfigured'
}

const seedEventId = 'event-current-league'

export async function initializeFirestoreSchema(
  db: Firestore,
  projectId: string,
  options: {
    initializedBy?: string
    portalVersion?: string
  } = {},
): Promise<FirestoreSchemaHealth> {
  const start = performance.now()

  await Promise.all(
    requiredFirestoreCollections.map((collectionName) =>
      ensureCollectionMarker(db, collectionName),
    ),
  )

  const eventsSnapshot = await getDocs(query(collection(db, 'events'), limit(1)))
  const seedEventRef = doc(db, 'events', seedEventId)

  if (eventsSnapshot.empty) {
    await setDoc(seedEventRef, {
      createdAt: serverTimestamp(),
      description: 'Default league event created by the Firestore provider.',
      endDate: '',
      id: seedEventId,
      lifecycleStage: 'Planning',
      name: 'Current League',
      registration: 'Registration Closed',
      scoringModel: 'League',
      standingsModel: 'League Division Standings',
      startDate: '',
      status: 'Planning',
      type: 'League',
      updatedAt: serverTimestamp(),
    })
  }

  const defaultsRef = doc(db, 'settings', 'defaults')
  const analyticsRef = doc(db, 'analytics', 'default')
  const defaults = await getDoc(defaultsRef)
  const analytics = await getDoc(analyticsRef)

  if (!defaults.exists()) {
    await setDoc(defaultsRef, {
      activeProvider: 'google',
      createdAt: serverTimestamp(),
      managedBy: 'lobo-infinity-portal',
      provider: 'firestore',
      updatedAt: serverTimestamp(),
    })
  }

  if (!analytics.exists()) {
    await setDoc(analyticsRef, {
      createdAt: serverTimestamp(),
      games: 0,
      managedBy: 'lobo-infinity-portal',
      provider: 'firestore',
      updatedAt: serverTimestamp(),
    })
  }

  await setDoc(
    doc(db, 'settings', 'schema'),
    {
      initializedAt: serverTimestamp(),
      initializedBy: options.initializedBy ?? 'provider',
      portalVersion: options.portalVersion ?? firestorePortalVersion,
      provider: 'firestore',
      schemaVersion: firestoreSchemaVersion,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  const schema = await getDoc(doc(db, 'settings', 'schema'))
  const seedEvent = await getDoc(seedEventRef)
  const defaultSettings = await getDoc(defaultsRef)
  const defaultAnalytics = await getDoc(analyticsRef)
  const collectionCounts = await getCollectionCounts(db)

  return {
    collectionCounts,
    collections: [...requiredFirestoreCollections],
    defaultAnalyticsExists: defaultAnalytics.exists(),
    defaultSettingsExists: defaultSettings.exists(),
    initialized: schema.exists(),
    initializedAt: readString(schema.data(), 'initializedAt'),
    latencyMs: Math.round(performance.now() - start),
    projectId,
    provider: 'firestore',
    schemaVersion: readNumber(schema.data(), 'schemaVersion'),
    seedEventExists: seedEvent.exists(),
    status: schema.exists() && seedEvent.exists() && defaultSettings.exists() && defaultAnalytics.exists()
      ? 'healthy'
      : 'error',
  }
}

async function ensureCollectionMarker(
  db: Firestore,
  collectionName: RequiredFirestoreCollection,
) {
  await setDoc(
    doc(db, collectionName, '__schema'),
    {
      collection: collectionName,
      createdAt: serverTimestamp(),
      managedBy: 'lobo-infinity-portal',
      provider: 'firestore',
      schemaVersion: firestoreSchemaVersion,
    },
    { merge: true },
  )
}

async function getCollectionCounts(db: Firestore) {
  const entries = await Promise.all(
    requiredFirestoreCollections.map(async (collectionName) => {
      const snapshot = await getCountFromServer(collection(db, collectionName))

      return [
        collectionName,
        Math.max(0, snapshot.data().count - 1),
      ] as const
    }),
  )

  return Object.fromEntries(entries)
}

function readString(
  record: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = record?.[key]

  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    const timestamp = value as { toDate: () => Date }
    return timestamp.toDate().toISOString()
  }

  return ''
}

function readNumber(
  record: Record<string, unknown> | undefined,
  key: string,
): number {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
