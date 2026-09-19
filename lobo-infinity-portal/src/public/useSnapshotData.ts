import { useEffect, useState } from 'react'
import { getPublicSnapshotDataset, type PublicSnapshotDataset } from '../services/publicSnapshot'

export function useSnapshotData<T>(dataset: PublicSnapshotDataset) {
  const [state, setState] = useState<{ data?: T; error?: string }>({})
  useEffect(() => {
    const controller = new AbortController()
    getPublicSnapshotDataset<T>(dataset, controller.signal)
      .then((data) => setState({ data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ error: error instanceof Error ? error.message : `Could not load ${dataset}.json` })
      })
    return () => controller.abort()
  }, [dataset])
  return state
}
