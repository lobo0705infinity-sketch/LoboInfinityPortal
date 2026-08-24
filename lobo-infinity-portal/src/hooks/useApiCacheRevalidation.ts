import { useEffect, useRef } from 'react'
import {
  apiCacheRevalidatedEvent,
  isApiCacheRevalidation,
} from '../services/apiCore'

type ApiCacheRevalidationOptions<T> = {
  action: string
  apply: (data: T) => void
  params?: Record<string, string>
  read: () => Promise<T>
}

export function useApiCacheRevalidation<T>({
  action,
  apply,
  params = {},
  read,
}: ApiCacheRevalidationOptions<T>) {
  const applyRef = useRef(apply)
  const readRef = useRef(read)

  useEffect(() => {
    applyRef.current = apply
    readRef.current = read
  }, [apply, read])

  const paramsIdentity = JSON.stringify(
    Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
  )

  useEffect(() => {
    let active = true
    const exactParams = Object.fromEntries(JSON.parse(paramsIdentity)) as Record<string, string>

    const handleCacheRevalidated = (event: Event) => {
      if (!isApiCacheRevalidation(event, action, exactParams)) {
        return
      }

      // apiCore emits only after replacing its memory entry. The normalized
      // reread is local, so it cannot create a second network request.
      void readRef.current()
        .then((data) => {
          if (active) {
            applyRef.current(data)
          }
        })
        .catch(() => {
          // Keep the already-rendered stale data when background refresh fails.
        })
    }

    window.addEventListener(apiCacheRevalidatedEvent, handleCacheRevalidated)

    return () => {
      active = false
      window.removeEventListener(apiCacheRevalidatedEvent, handleCacheRevalidated)
    }
  }, [action, paramsIdentity])
}
