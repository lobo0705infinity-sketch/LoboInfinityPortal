import { navigationItemActive } from './navigationState'
import { useLayoutEffect, useRef, useState } from 'react'
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
  const sidebarRef = useRef<HTMLElement>(null)
  const location = useLocation()
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
  const communityLinks = discordLink
    ? [{ external: true, icon: 'discord' as const, label: discordLink.label, to: discordLink.url }]
    : []

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current
    const active = sidebar?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!sidebar || !active || !sidebar.clientHeight) return
    const bounds = sidebar.getBoundingClientRect()
    const linkBounds = active.getBoundingClientRect()
    if (linkBounds.top < bounds.top || linkBounds.bottom > bounds.bottom) {
      sidebar.scrollTop += linkBounds.top - bounds.top - sidebar.clientHeight / 2 + linkBounds.height / 2
    }
  }, [location.pathname, location.search, location.hash, selectedEventId, eventOptions])

  function changeSelectedEvent(eventId: string) {
    selectEvent(eventId)
  }

  return (
    <aside ref={sidebarRef} className="sidebar" aria-label="Portal navigation">
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
        {[...topLevelItems,...communityItems.filter(item=>['/army-intelligence','/army-lists','/games'].includes(item.to))].map((item) => (
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

        <section className="sidebar-section" aria-labelledby="sidebar-selected-event">
          <p className="sidebar-section-label" id="sidebar-selected-event">Selected Event</p>
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
          items={communityItems.filter(item=>!['/army-intelligence','/army-lists','/games'].includes(item.to))}
          label="Explore"
        />
        {communityLinks.length ? <SidebarSection items={communityLinks} label="Community" /> : null}
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
  const location = useLocation()
  const active = items.some(item=>navigationItemActive(item.to,location.pathname,location.search))
  const route=`${location.pathname}${location.search}`
  const [expanded,setExpanded] = useState<{route:string;open:boolean}|null>(null)
  const open=expanded?.route===route?expanded.open:active
  const labelId = `sidebar-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <section className="sidebar-section" aria-labelledby={labelId}>
      <button type="button" className="sidebar-section-toggle" id={labelId} aria-expanded={open} aria-controls={`${labelId}-links`} onClick={()=>setExpanded({route,open:!open})}>{label}<span aria-hidden="true">{open?"−":"+"}</span></button>
      <div id={`${labelId}-links`} hidden={!open}>
      {items.map((item) => (
        <SidebarLink
          item={item}
          key={item.to}
          onNavigate={onNavigate}
        />
      ))}
      </div>
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
        <Link to="/events">All Events</Link>
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
  const active = navigationItemActive(item.to,location.pathname,location.search)

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
      aria-current={active ? 'page' : undefined}
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
