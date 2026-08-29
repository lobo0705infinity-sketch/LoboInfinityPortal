import type { EventBracketData, EventHomeData } from './api'

export type PublicEventProjection = {
  bracket: EventBracketData
  eventId: string
  generatedAt: string
  home: EventHomeData
  schemaVersion: number
}

type PublicEventProjectionResponse = {
  projection?: PublicEventProjection
  success?: boolean
  error?: string
}

export async function getPublicEventProjection(
  eventId: string,
  options: { signal?: AbortSignal } = {},
) {
  const startedAt = performance.now()
  const response = await fetch(
    `/api/public-event-projection?eventId=${encodeURIComponent(eventId)}`,
    { signal: options.signal },
  )
  const payload = (await response.json()) as PublicEventProjectionResponse

  if (!response.ok || payload.success !== true || !payload.projection) {
    throw new Error(payload.error || 'Public event projection could not be loaded.')
  }

  if (
    payload.projection.eventId !== eventId ||
    payload.projection.home.event.id !== eventId ||
    payload.projection.bracket.eventId !== eventId
  ) {
    throw new Error('Public event projection event isolation failed.')
  }

  performance.measure('lobo:public-event-projection', {
    start: startedAt,
    end: performance.now(),
    detail: {
      eventId,
      generatedAt: payload.projection.generatedAt,
    },
  })

  return payload.projection
}
