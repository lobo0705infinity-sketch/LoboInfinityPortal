import type { DataProvider } from '../DataProvider'
import { firestoreProvider } from './FirestoreProvider'

export const mockProvider: DataProvider = {
  ...firestoreProvider,
  metadata: {
    kind: 'mock',
    name: 'Mock Provider',
    storage: 'Local test fixtures',
  },
}
