import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  buildCapabilityNavigation,
  type EventNavigationConfig,
} from '../config/eventNavigation'
import { preloadRoute } from '../services/routePreload'
import LeagueCrest from './LeagueCrest'
import PortalIcon from './PortalIcon'
import {
  authenticatedTopLevelItems,
  commissionerItems,
  communityItems,
  topLevelItems,
  type NavigationItem,
} from './sidebarNavigation'
import { useSelectedEventNavigation } from './useSelectedEventNavigation'

type MobileNavigationDrawerProps = {
  authenticated: boolean
  commissioner: boolean
  onClose: () => void
}

const expandedEventStorageKey = 'le'

function readExpandedEventId() {
  try {
    return window.sessionStorage.getItem(expandedEventStorageKey) || ''
  } catch {
    return ''
  }
}

function writeExpandedEventId(eventId: string) {
  try {
    window.sessionStorage.setItem(expandedEventStorageKey, eventId)
  } catch {
    // Navigation memory is an enhancement; links remain deterministic.
  }
}

function MobileSidebarSection({
  items,
  label,
  onNavigate,
}: {
  items: NavigationItem[]
  label: string
  onNavigate: () => void
}) {
  const labelId = `mobile-sidebar-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <section className="sidebar-section" aria-labelledby={labelId}>
      <p className="sidebar-section-label" id={labelId}>{label}</p>
      {items.map((item) => (
        <MobileSidebarLink
          item={item}
          key={item.to}
          onNavigate={onNavigate}
        />
      ))}
    </section>
  )
}

function MobileEventGroup({
  event,
  expanded,
  onNavigate,
  onToggle,
}: {
  event: EventNavigationConfig
  expanded: boolean
  onNavigate: () => void
  onToggle: () => void
}) {
  const items = buildCapabilityNavigation(event)

  return (
    <div className="sidebar-event-group">
      <button
        aria-expanded={expanded}
        className="sidebar-event-summary"
        onClick={onToggle}
        type="button"
      >
          <span>{event.label}</span>
          <small>{event.type}</small>
      </button>
      {expanded ? (
        <div className="sidebar-subnav">
          {items.map((item) => (
            <MobileSidebarLink
              item={item}
              key={`${event.id}-${item.label}`}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function MobileSidebarLink({
  item,
  onNavigate,
}: {
  item: NavigationItem
  onNavigate: () => void
}) {
  const location = useLocation()
  const active = `${location.pathname}${location.search}${location.hash}` === item.to

  return (
    <Link
      className={active ? 'sidebar-button active' : 'sidebar-button'}
      onClick={onNavigate}
      onMouseEnter={() => preloadRoute(item.to)}
      to={item.to}
    >
      <span className="sidebar-icon" aria-hidden="true">
        <PortalIcon name={item.icon} />
      </span>
      <span>{item.label}</span>
    </Link>
  )
}

function MobileNavigationDrawer({
  authenticated,
  commissioner,
  onClose,
}: MobileNavigationDrawerProps) {
  const {
    eventOptions,
    prefetchEventNavigation,
    selectEvent,
    selectedEventId,
  } = useSelectedEventNavigation()
  const [expandedEventId, setExpandedEventId] = useState(() =>
    selectedEventId || readExpandedEventId(),
  )
  const knownExpandedEvent = eventOptions.some((event) => event.id === expandedEventId)
  const resolvedExpandedEventId =
    knownExpandedEvent ? expandedEventId : selectedEventId

  function handleEventChange(eventId: string) {
    expandEvent(eventId)
    selectEvent(eventId)
    onClose()
  }

  function expandEvent(eventId: string) {
    setExpandedEventId(eventId)
    writeExpandedEventId(eventId)
  }

  return (
    <aside
      aria-label="Mobile navigation"
      aria-modal="true"
      className="mobile-menu-sheet sidebar"
      id="mobile-navigation-menu"
      role="dialog"
    >
      <div className="sidebar-brand mobile-menu-heading">
        <LeagueCrest compact />
        <div>
          <strong>Lobo</strong>
          <small>Infinity League</small>
        </div>
        <button aria-label="Close navigation menu" onClick={onClose} type="button">
          Close
        </button>
      </div>
      <nav className="sidebar-nav" aria-label="Mobile portal sections">
        {topLevelItems.map((item) => (
          <MobileSidebarLink item={item} key={item.to} onNavigate={onClose} />
        ))}
        {authenticated ? (
          authenticatedTopLevelItems.map((item) => (
            <MobileSidebarLink item={item} key={item.to} onNavigate={onClose} />
          ))
        ) : null}

        <section className="sidebar-section" aria-labelledby="mobile-sidebar-my-events">
          <p className="sidebar-section-label" id="mobile-sidebar-my-events">My Events</p>
          {eventOptions.length > 1 ? (
            <MobileEventSelector
              eventOptions={eventOptions}
              onChange={handleEventChange}
              onPrefetch={prefetchEventNavigation}
              selectedEventId={selectedEventId}
            />
          ) : null}
          {eventOptions.length === 0 ? (
            <MobileNoEventsNavigation commissioner={commissioner} onNavigate={onClose} />
          ) : (
            eventOptions.map((event) => (
              <MobileEventGroup
                event={event}
                expanded={resolvedExpandedEventId === event.id}
                key={event.id}
                onNavigate={onClose}
                onToggle={() => expandEvent(event.id)}
              />
            ))
          )}
        </section>

        <MobileSidebarSection
          items={communityItems}
          label="Community"
          onNavigate={onClose}
        />
        {commissioner ? (
          <MobileSidebarSection
            items={commissionerItems}
            label="Commissioner"
            onNavigate={onClose}
          />
        ) : null}
      </nav>
    </aside>
  )
}

function MobileNoEventsNavigation({
  commissioner,
  onNavigate,
}: {
  commissioner: boolean
  onNavigate: () => void
}) {
  return (
    <div className="sidebar-event-group">
      <p className="sidebar-section-label">No Active Events</p>
      <div className="sidebar-subnav">
        <Link onClick={onNavigate} to="/players">Browse Community</Link>
      {commissioner ? (
          <Link onClick={onNavigate} to="/commissioner/event-manager">Create Event</Link>
      ) : null}
        <Link onClick={onNavigate} to="/events">View Past Events</Link>
      </div>
    </div>
  )
}

function MobileEventSelector({
  eventOptions,
  onChange,
  onPrefetch,
  selectedEventId,
}: {
  eventOptions: EventNavigationConfig[]
  onChange: (eventId: string) => void
  onPrefetch: () => void
  selectedEventId: string
}) {
  return (
    <label className="sidebar-event-selector">
      <span>Event Selector</span>
      <select
        aria-label="Select event"
        onChange={(event) => {
          const selector = event.currentTarget
          selector.disabled = true
          window.setTimeout(() => {
            selector.disabled = false
          }, 560)
          onChange(event.target.value)
        }}
        onFocus={onPrefetch}
        onMouseDown={onPrefetch}
        onPointerDown={onPrefetch}
        value={selectedEventId}
      >
        {eventOptions.map((event) => (
          <option key={event.id} value={event.id}>
            {event.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default MobileNavigationDrawer
