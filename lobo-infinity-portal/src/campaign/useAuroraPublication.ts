import { useEffect, useState } from 'react'
import { validateAuroraPublicState } from '../../shared/aurora-public-state.mjs'
import type { AuroraPublication } from './auroraTypes'

export function useAuroraPublication() {
  const [publication, setPublication] = useState<AuroraPublication | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    fetch('/api/aurora-campaign', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Published campaign state is temporarily unavailable.')
      const result = await response.json()
      if (typeof result.revision !== 'string' || typeof result.publishedAt !== 'string') throw new Error('Campaign publication is invalid.')
      const state = validateAuroraPublicState(result.state) as AuroraPublication['state']
      if (!controller.signal.aborted) setPublication({ ...result, state })
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Campaign publication is unavailable.') })
    return () => controller.abort()
  }, [attempt])
  return { publication, error, reload: () => setAttempt(value => value + 1) }
}
