import { getEventNavigationConfig } from '../config/eventNavigation'

const CURRENT_LEAGUE_EVENT_ID = 'event-current-league'
const INTERNAL_CURRENT_LEAGUE_NAMES = new Set([
  'current league',
  CURRENT_LEAGUE_EVENT_ID,
])

export function getConfiguredEventDisplayName({
  eventId,
  eventName,
  fallback = 'Not Assigned',
}: {
  eventId?: string | null
  eventName?: string | null
  fallback?: string
}) {
  const normalizedEventId = eventId?.trim() ?? ''
  const normalizedEventName = eventName?.trim() ?? ''
  const isInternalCurrentLeagueName = INTERNAL_CURRENT_LEAGUE_NAMES.has(
    normalizedEventName.toLowerCase(),
  )
  const configuredEventId =
    normalizedEventId || (isInternalCurrentLeagueName ? CURRENT_LEAGUE_EVENT_ID : '')
  const configuredLabel = configuredEventId
    ? getEventNavigationConfig(configuredEventId)?.label ?? ''
    : ''

  if (
    configuredLabel &&
    (!normalizedEventName ||
      isInternalCurrentLeagueName ||
      normalizedEventName === normalizedEventId)
  ) {
    return configuredLabel
  }

  return normalizedEventName || configuredLabel || fallback
}
