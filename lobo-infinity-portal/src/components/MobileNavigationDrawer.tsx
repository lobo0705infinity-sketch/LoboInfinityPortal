import { NavLink } from 'react-router-dom'
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
  leagueItems,
  topLevelItems,
  type NavigationItem,
} from './sidebarNavigation'
import { useSelectedEventNavigation } from './useSelectedEventNavigation'

type MobileNavigationDrawerProps = {
  authenticated: boolean
  commissioner: boolean
  onClose: () => void
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
        <MobileSidebarLink item={item} key={item.to} onNavigate={onNavigate} />
      ))}
    </section>
  )
}

function MobileEventGroup({
  defaultOpen = false,
  event,
  heading,
  onNavigate,
}: {
  defaultOpen?: boolean
  event: EventNavigationConfig
  heading?: string
  onNavigate: () => void
}) {
  const items = buildCapabilityNavigation(event)

  return (
    <section className="sidebar-section">
      {heading ? <p className="sidebar-section-label">{heading}</p> : null}
      <details className="sidebar-event-group" open={defaultOpen}>
        <summary className="sidebar-event-summary">
          <span>{event.label}</span>
          <small>{event.type}</small>
        </summary>
        <div className="sidebar-subnav">
          {items.map((item) => (
            <MobileSidebarLink
              item={item}
              key={`${event.id}-${item.label}`}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </details>
    </section>
  )
}

function MobileSidebarLink({
  item,
  onNavigate,
}: {
  item: NavigationItem
  onNavigate: () => void
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        isActive ? 'sidebar-button active' : 'sidebar-button'
      }
      end
      onClick={onNavigate}
      onMouseEnter={() => preloadRoute(item.to)}
      to={item.to}
    >
      <span className="sidebar-icon" aria-hidden="true">
        <PortalIcon name={item.icon} />
      </span>
      <span>{item.label}</span>
    </NavLink>
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
    selectedEvent,
    selectedEventId,
  } = useSelectedEventNavigation()

  function handleEventChange(eventId: string) {
    selectEvent(eventId)
    onClose()
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

        <section className="sidebar-section" aria-labelledby="mobile-sidebar-current-event">
          <p className="sidebar-section-label" id="mobile-sidebar-current-event">Current Event</p>
          <MobileEventSelector
            eventOptions={eventOptions}
            onChange={handleEventChange}
            onPrefetch={prefetchEventNavigation}
            selectedEventId={selectedEventId}
          />
          <MobileEventGroup defaultOpen event={selectedEvent} onNavigate={onClose} />
          <MobileSidebarLink
            item={{
              icon: 'standings',
              label: 'Past Events',
              to: '/events',
            }}
            onNavigate={onClose}
          />
        </section>

        <MobileSidebarSection items={leagueItems} label="League" onNavigate={onClose} />
        <MobileSidebarSection items={communityItems} label="Community" onNavigate={onClose} />
        {commissioner ? (
          <MobileSidebarSection
            items={commissionerItems}
            label="Commissioner Tools"
            onNavigate={onClose}
          />
        ) : null}
      </nav>
    </aside>
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
        aria-label="Select current event"
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
