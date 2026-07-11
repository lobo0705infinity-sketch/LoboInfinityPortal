import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  buildCapabilityNavigation,
  type EventNavigationConfig,
} from '../config/eventNavigation'
import LeagueCrest from './LeagueCrest'
import PortalIcon, { type PortalIconName } from './PortalIcon'
import { useSelectedEventNavigation } from './useSelectedEventNavigation'

type NavigationItem = {
  icon: PortalIconName
  label: string
  to: string
}

const topLevelItems: NavigationItem[] = [
  {
    icon: 'dashboard',
    label: 'Dashboard',
    to: '/',
  },
]

const authenticatedTopLevelItems: NavigationItem[] = [
  {
    icon: 'players',
    label: 'My Profile',
    to: '/profile',
  },
]

const leagueItems: NavigationItem[] = [
  {
    icon: 'players',
    label: 'Players',
    to: '/players',
  },
  {
    icon: 'hall',
    label: 'Hall of Fame',
    to: '/hall-of-fame',
  },
  {
    icon: 'analytics',
    label: 'Intelligence',
    to: '/analytics',
  },
  {
    icon: 'compare',
    label: 'Compare',
    to: '/compare',
  },
  {
    icon: 'missions',
    label: 'Missions',
    to: '/missions',
  },
  {
    icon: 'rules',
    label: 'Rules',
    to: '/rules',
  },
]

const communityItems: NavigationItem[] = [
  {
    icon: 'news',
    label: 'News',
    to: '/news',
  },
  {
    icon: 'timeline',
    label: 'Timeline',
    to: '/timeline',
  },
  {
    icon: 'streams',
    label: 'Streams',
    to: '/streams',
  },
  {
    icon: 'army',
    label: 'Army Lists',
    to: '/army-lists',
  },
  {
    icon: 'bell',
    label: 'Alerts',
    to: '/notifications',
  },
]

const commissionerItems: NavigationItem[] = [
  {
    icon: 'submit',
    label: 'Operations',
    to: '/commissioner',
  },
  {
    icon: 'standings',
    label: 'Event Manager',
    to: '/commissioner/event-manager',
  },
  {
    icon: 'bell',
    label: 'Automation',
    to: '/automation',
  },
  {
    icon: 'analytics',
    label: 'Integrity',
    to: '/integrity',
  },
  {
    icon: 'analytics',
    label: 'Diagnostics',
    to: '/diagnostics',
  },
]

function Sidebar() {
  const auth = useAuth()
  const {
    eventOptions,
    prefetchEventNavigation,
    selectEvent,
    selectedEvent,
    selectedEventId,
  } = useSelectedEventNavigation()

  return (
    <aside className="sidebar" aria-label="League navigation">
      <div className="sidebar-brand">
        <LeagueCrest compact />
        <div>
          <strong>Lobo</strong>
          <small>Infinity League</small>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Portal sections">
        {topLevelItems.map((item) => (
          <SidebarLink item={item} key={item.to} />
        ))}
        {auth.authenticated
          ? authenticatedTopLevelItems.map((item) => (
              <SidebarLink item={item} key={item.to} />
            ))
          : null}

        <section className="sidebar-section" aria-labelledby="sidebar-current-event">
          <p className="sidebar-section-label" id="sidebar-current-event">Current Event</p>
          <EventSelector
            eventOptions={eventOptions}
            onChange={selectEvent}
            onPrefetch={prefetchEventNavigation}
            selectedEventId={selectedEventId}
          />
          <EventGroup defaultOpen event={selectedEvent} />
          <SidebarLink
            item={{
              icon: 'standings',
              label: 'Past Events',
              to: '/events',
            }}
          />
        </section>

        <SidebarSection items={leagueItems} label="League" />
        <SidebarSection items={communityItems} label="Community" />
        {auth.isAtLeastRole('Commissioner') ? (
          <SidebarSection items={commissionerItems} label="Commissioner Tools" />
        ) : null}
      </nav>
    </aside>
  )
}

function EventSelector({
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

function SidebarSection({
  items,
  label,
  onNavigate,
}: {
  items: NavigationItem[]
  label: string
  onNavigate?: () => void
}) {
  const labelId = `sidebar-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <section className="sidebar-section" aria-labelledby={labelId}>
      <p className="sidebar-section-label" id={labelId}>{label}</p>
      {items.map((item) => (
        <SidebarLink item={item} key={item.to} onNavigate={onNavigate} />
      ))}
    </section>
  )
}

function EventGroup({
  defaultOpen = false,
  event,
  heading,
  onNavigate,
}: {
  defaultOpen?: boolean
  event: EventNavigationConfig
  heading?: string
  onNavigate?: () => void
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
            <SidebarLink item={item} key={`${event.id}-${item.label}`} onNavigate={onNavigate} />
          ))}
        </div>
      </details>
    </section>
  )
}

function SidebarLink({
  item,
  onNavigate,
}: {
  item: NavigationItem
  onNavigate?: () => void
}) {
  const location = useLocation()
  const active = `${location.pathname}${location.search}${location.hash}` === item.to

  return (
    <Link
      className={active ? 'sidebar-button active' : 'sidebar-button'}
      onClick={onNavigate}
      to={item.to}
    >
      <span className="sidebar-icon" aria-hidden="true">
        <PortalIcon name={item.icon} />
      </span>
      <span>{item.label}</span>
    </Link>
  )
}

export default Sidebar
