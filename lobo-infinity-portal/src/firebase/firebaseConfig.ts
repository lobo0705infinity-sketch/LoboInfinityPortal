import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

export type FirebaseRuntimeConfig = {
  apiKey: string
  appId: string
  authDomain: string
  measurementId?: string
  messagingSenderId: string
  projectId: string
  storageBucket: string
}

export type FirebaseRuntime = {
  app: FirebaseApp
  config: FirebaseRuntimeConfig
  db: Firestore
}

export function getFirebaseRuntimeConfig(): FirebaseRuntimeConfig | null {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  }

  const requiredValues = [
    config.apiKey,
    config.appId,
    config.authDomain,
    config.messagingSenderId,
    config.projectId,
    config.storageBucket,
  ]

  return requiredValues.every((value) => value.trim().length > 0) ? config : null
}

let runtime: FirebaseRuntime | null = null

export function getFirebaseRuntime(): FirebaseRuntime {
  if (runtime) {
    return runtime
  }

  const config = getFirebaseRuntimeConfig()

  if (!config) {
    throw new Error(
      'Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, and VITE_FIREBASE_APP_ID.',
    )
  }

  const app = getApps()[0] ?? initializeApp(config)
  const db = getFirestore(app)

  runtime = {
    app,
    config,
    db,
  }

  return runtime
}
