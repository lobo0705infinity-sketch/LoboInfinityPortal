// This is the existing event's permanent ID, including its historical URL slug.
// Renaming its display label must never create a second event or orphan records.
export const TOP40_EVENT_ID = 'event-lobo-s-american-top-40'
export const TOP40_EVENT_NAME = "Lobo's Top 40"

export function eventDisplayName(eventId: string, storedName: string) {
  return eventId === TOP40_EVENT_ID ? TOP40_EVENT_NAME : storedName
}
