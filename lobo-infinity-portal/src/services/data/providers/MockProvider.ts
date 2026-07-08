import type { DataProvider } from '../DataProvider'
import { firestoreProvider } from './FirestoreProvider'

export const mockProvider: DataProvider = {
  ...firestoreProvider,
  getHealth: async () => ({
    errors: ['Mock provider is not backed by fixtures yet.'],
    initialized: false,
    latencyMs: 0,
    mode: 'mock',
    provider: 'mock',
    status: 'unconfigured',
  }),
  metadata: {
    kind: 'mock',
    name: 'Mock Provider',
    storage: 'Local test fixtures',
  },
}
