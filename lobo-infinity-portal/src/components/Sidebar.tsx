import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDiscordCommunityLink } from '../config/communityLinks'
import {
  buildCapabilityNavigation,
  type EventNavigationConfig,
} from '../config/eventNavigation'
import LeagueCrest from './LeagueCrest'
import PortalIcon from './PortalIcon'
import SponsorCredit from './SponsorCredit'
import {
  authenticatedTopLevelItems,
  commissionerItems,
  communityItems,
  getJoinCommunityNavigationItem,
  topLevelItems,
  type NavigationItem,
} from './sidebarNavigation'
import { useSelectedEventNavigation } from './useSelectedEventNavigation'
import { useSettings } from '../contexts/SettingsContext'

function Sidebar() {
  const auth = useAuth()
  const { settings } = useSettings()
  const {
    eventOptions,
    prefetchEventNavigation,
    selectEvent,
    selectedEventId,
  } = useSelectedEventNavigation()
  const selectedEvent = eventOptions.find((event) => event.id === selectedEventId)
  const discordLink = getDiscordCommunityLink(settings)
  const joinCommunityItem = getJoinCommunityNavigationItem(
    settings?.joinCommunityFormUrl ?? '',
  )
  const resolvedCommunityItems = discordLink
    ? [
        ...communityItems,
        {
          external: true,
          icon: 'discord' as const,
          label: discordLink.label,
          to: discordLink.url,
        },
      ]
    : communityItems

  function changeSelectedEvent(eventId: string) {
    selectEvent(eventId)
  }

  return (
    <aside className="sidebar" aria-label="Portal navigation">
      <div className="sidebar-brand-stack">
        <div className="sidebar-brand">
          <LeagueCrest compact />
          <div>
            <strong>Lobo</strong>
            <small>Infinity League</small>
          </div>
        </div>
        <SponsorCredit placement="sidebar" />
      </div>

      <nav className="sidebar-nav" aria-label="Portal sections">
        {topLevelItems.map((item) => (
          <SidebarLink item={item} key={item.to} />
        ))}
        {joinCommunityItem ? (
          <SidebarLink item={joinCommunityItem} />
        ) : null}
        {auth.authenticated
          ? authenticatedTopLevelItems.map((item) => (
              <SidebarLink item={item} key={item.to} />
            ))
          : null}

        <section className="sidebar-section" aria-labelledby="sidebar-my-events">
          <p className="sidebar-section-label" id="sidebar-my-events">My Events</p>
          {eventOptions.length > 1 ? (
            <EventSelector
              eventOptions={eventOptions}
              onChange={changeSelectedEvent}
              onPrefetch={prefetchEventNavigation}
              selectedEventId={selectedEventId}
            />
          ) : null}
          {eventOptions.length === 0 ? (
            <NoEventsNavigation commissioner={auth.isAtLeastRole('Commissioner')} />
          ) : selectedEvent ? <EventGroup event={selectedEvent} /> : null}
        </section>

        <SidebarSection
          items={resolvedCommunityItems}
          label="Community"
        />
        <SidebarSection
          items={auth.isAtLeastRole('Commissioner')
            ? commissionerItems
            : [{ icon: 'dashboard', label: 'Commissioner', to: '/commissioner' }]}
          label="Commissioner"
        />
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
        <SidebarLink
          item={item}
          key={item.to}
          onNavigate={onNavigate}
        />
      ))}
    </section>
  )
}

function EventGroup({
  event,
  onNavigate,
}: {
  event: EventNavigationConfig
  onNavigate?: () => void
}) {
  const items = buildCapabilityNavigation(event)

  return (
    <div className="sidebar-event-group">
      <div className="sidebar-event-summary sidebar-event-summary-static">
          <span>{event.label}</span>
          <small>{event.type}</small>
      </div>
      <div className="sidebar-subnav">
        {items.map((item) => (
          <SidebarLink item={item} key={`${event.id}-${item.label}`} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  )
}

function NoEventsNavigation({ commissioner }: { commissioner: boolean }) {
  return (
    <div className="sidebar-event-group">
      <p className="sidebar-section-label">No Active Events</p>
      <div className="sidebar-subnav">
        <Link to="/players">Browse Community</Link>
        {commissioner ? <Link to="/commissioner/events">Create Event</Link> : null}
        <Link to="/events">View Past Events</Link>
      </div>
    </div>
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

  if (item.external) {
    return (
      <a
        className="sidebar-button"
        href={item.to}
        onClick={onNavigate}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="sidebar-icon" aria-hidden="true">
          <PortalIcon name={item.icon} />
        </span>
        <span>{item.label}</span>
      </a>
    )
  }

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
