// This is the existing event's permanent database ID.
// Renaming its display label must never create a second event or orphan records.
export const TOP40_EVENT_ID = 'event-lobo-s-american-top-40'
export const TOP40_EVENT_NAME = "Lobo's Top 40"

export function eventDisplayName(eventId: string, storedName: string) {
  return eventId === TOP40_EVENT_ID ? TOP40_EVENT_NAME : storedName
}

export const TOP40_EVENT_SLUG = 'lobos-top-40'

export function eventUrlSlug(eventId: string) {
  return eventId === TOP40_EVENT_ID ? TOP40_EVENT_SLUG : eventId
}

export function resolveEventId(slug: string | undefined) {
  return slug === TOP40_EVENT_SLUG ? TOP40_EVENT_ID : slug
}
