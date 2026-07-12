import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  currentEventNavigation,
  eventNavigationOptions,
  getEventNavigationConfig,
} from '../config/eventNavigation'

const selectedEventStorageKey = 'lobo-selected-event-id'

function readStoredEventId() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.sessionStorage.getItem(selectedEventStorageKey) || ''
  } catch {
    return ''
  }
}

function writeStoredEventId(eventId: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(selectedEventStorageKey, eventId)
  } catch {
    // Session storage is an enhancement; navigation still works without it.
  }
}

function getRouteEventId(pathname: string, search: string) {
  const queryEventId = new URLSearchParams(search).get('eventId')

  if (queryEventId) {
    return queryEventId
  }

  const eventMatch = pathname.match(/^\/event\/([^/?#]+)/)

  return eventMatch ? decodeURIComponent(eventMatch[1]) : ''
}

function resolveKnownEventId(eventId: string) {
  return getEventNavigationConfig(eventId)?.id || ''
}

export function useSelectedEventNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationHelperRef = useRef<Promise<typeof import('./eventWorkspaceNavigation')> | null>(null)
  const routeEventId = useMemo(
    () => resolveKnownEventId(getRouteEventId(location.pathname, location.search)),
    [location.pathname, location.search],
  )
  const [manualEventId, setManualEventId] = useState(() => {
    return (
      resolveKnownEventId(readStoredEventId()) ||
      currentEventNavigation.id
    )
  })

  useEffect(() => {
    if (!routeEventId) {
      return
    }

    writeStoredEventId(routeEventId)
  }, [routeEventId])

  const selectedEventId = routeEventId || manualEventId

  const selectedEvent =
    getEventNavigationConfig(selectedEventId) ?? currentEventNavigation

  function loadNavigationHelper() {
    navigationHelperRef.current ??= import('./eventWorkspaceNavigation')
    return navigationHelperRef.current
  }

  function selectEvent(eventId: string) {
    const knownEventId = resolveKnownEventId(eventId) || currentEventNavigation.id
    const targetEvent = getEventNavigationConfig(knownEventId) ?? currentEventNavigation

    if (targetEvent.id === selectedEvent.id) {
      return
    }

    setManualEventId(knownEventId)
    writeStoredEventId(knownEventId)
    void loadNavigationHelper().then((helper) => {
      helper.startEventWorkspaceTransition(targetEvent)
      helper.rememberWorkspaceRoute(
        selectedEvent.id,
        location.pathname,
        location.search,
        location.hash,
      )
      navigate(helper.resolveEventWorkspacePath(
        targetEvent,
        location.pathname,
        location.search,
        location.hash,
      ))
    })
  }

  function prefetchEventNavigation() {
    void loadNavigationHelper().then((helper) => {
      eventNavigationOptions.forEach(helper.precomputeEventNavigation)
    })
  }

  return {
    eventOptions: eventNavigationOptions,
    prefetchEventNavigation,
    selectEvent,
    selectedEventId: selectedEvent.id,
  }
}
