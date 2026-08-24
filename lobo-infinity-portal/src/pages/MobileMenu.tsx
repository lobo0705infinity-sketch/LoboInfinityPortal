import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getDiscordCommunityLink } from '../config/communityLinks'
import { buildCapabilityNavigation, type EventNavigationConfig } from '../config/eventNavigation'
import PortalIcon from '../components/PortalIcon'
import {
  authenticatedTopLevelItems,
  commissionerItems,
  communityItems,
  getJoinCommunityNavigationItem,
  topLevelItems,
  type NavigationItem,
} from '../components/sidebarNavigation'
import { useSelectedEventNavigation } from '../components/useSelectedEventNavigation'
import { useSettings } from '../contexts/SettingsContext'
import { preloadRoute } from '../services/routePreload'

const expandedEventStorageKey = 'le'

function MobileMenu() {
  const auth = useAuth()
  const { settings } = useSettings()
  const { eventOptions, prefetchEventNavigation, selectEvent, selectedEventId } = useSelectedEventNavigation()
  const [expandedEventId, setExpandedEventId] = useState(() => selectedEventId || readExpandedEventId())
  const expanded = eventOptions.some((event) => event.id === expandedEventId)
    ? expandedEventId
    : selectedEventId
  const joinCommunityItem = getJoinCommunityNavigationItem(settings?.joinCommunityFormUrl ?? '')
  const discordLink = getDiscordCommunityLink(settings)
  const resolvedCommunityItems = discordLink
    ? [...communityItems, { external: true, icon: 'discord' as const, label: discordLink.label, to: discordLink.url }]
    : communityItems
  const playItems = [
    ...topLevelItems,
    ...(joinCommunityItem ? [joinCommunityItem] : []),
    ...(auth.authenticated ? authenticatedTopLevelItems : []),
  ]
  const commissionerNavigation = auth.isAtLeastRole('Commissioner')
    ? commissionerItems
    : [{ icon: 'dashboard' as const, label: 'Commissioner', to: '/commissioner' }]

  function expandEvent(eventId: string) {
    setExpandedEventId(eventId)
    writeExpandedEventId(eventId)
  }

  function changeSelectedEvent(eventId: string) {
    expandEvent(eventId)
    selectEvent(eventId)
  }

  return (
    <main className="portal-shell mobile-navigation-page">
      <header className="page-header mobile-navigation-page-header">
        <p className="eyebrow">Portal Navigation</p>
        <h1>More</h1>
        <p>Every league, event, community, and Commissioner destination in one place.</p>
      </header>

      <nav className="mobile-navigation-directory" aria-label="Complete portal navigation">
        <MenuSection items={playItems} label="Play" />

        <section className="mobile-navigation-section" aria-labelledby="mobile-menu-events">
          <h2 id="mobile-menu-events">My Events</h2>
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
          ) : eventOptions.map((event) => (
            <EventGroup
              event={event}
              expanded={expanded === event.id}
              key={event.id}
              onToggle={() => expandEvent(event.id)}
            />
          ))}
        </section>

        <MenuSection items={resolvedCommunityItems} label="Community" />
        <MenuSection items={commissionerNavigation} label="Commissioner" />
      </nav>
    </main>
  )
}

function MenuSection({ items, label }: { items: NavigationItem[]; label: string }) {
  const id = `mobile-menu-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <section className="mobile-navigation-section" aria-labelledby={id}>
      <h2 id={id}>{label}</h2>
      <div className="mobile-navigation-links">
        {items.map((item) => <MenuLink item={item} key={item.to} />)}
      </div>
    </section>
  )
}

function EventGroup({ event, expanded, onToggle }: { event: EventNavigationConfig; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="mobile-navigation-event">
      <button aria-expanded={expanded} className="sidebar-event-summary" onClick={onToggle} type="button">
        <span>{event.label}</span>
        <small>{event.type}</small>
      </button>
      {expanded ? (
        <div className="mobile-navigation-links mobile-navigation-event-links">
          {buildCapabilityNavigation(event).map((item) => <MenuLink item={item} key={`${event.id}-${item.label}`} />)}
        </div>
      ) : null}
    </div>
  )
}

function MenuLink({ item }: { item: NavigationItem }) {
  const location = useLocation()
  const active = `${location.pathname}${location.search}${location.hash}` === item.to
  const content = <><span className="sidebar-icon" aria-hidden="true"><PortalIcon name={item.icon} /></span><span>{item.label}</span></>

  if (item.external) {
    return <a className="mobile-navigation-link" href={item.to} rel="noopener noreferrer" target="_blank">{content}</a>
  }

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={active ? 'mobile-navigation-link active' : 'mobile-navigation-link'}
      onFocus={() => preloadRoute(item.to)}
      onPointerEnter={() => preloadRoute(item.to)}
      to={item.to}
    >
      {content}
    </Link>
  )
}

function EventSelector({ eventOptions, onChange, onPrefetch, selectedEventId }: {
  eventOptions: EventNavigationConfig[]
  onChange: (eventId: string) => void
  onPrefetch: () => void
  selectedEventId: string
}) {
  return (
    <label className="sidebar-event-selector mobile-navigation-event-selector">
      <span>Event Selector</span>
      <select
        aria-label="Select event"
        onChange={(event) => onChange(event.target.value)}
        onFocus={onPrefetch}
        onPointerDown={onPrefetch}
        value={selectedEventId}
      >
        {eventOptions.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}
      </select>
    </label>
  )
}

function NoEventsNavigation({ commissioner }: { commissioner: boolean }) {
  return (
    <div className="mobile-navigation-links">
      <Link className="mobile-navigation-link" to="/players">Browse Community</Link>
      {commissioner ? <Link className="mobile-navigation-link" to="/commissioner/events">Create Event</Link> : null}
      <Link className="mobile-navigation-link" to="/events">View Past Events</Link>
    </div>
  )
}

function readExpandedEventId() {
  try { return window.sessionStorage.getItem(expandedEventStorageKey) || '' } catch { return '' }
}

function writeExpandedEventId(eventId: string) {
  try { window.sessionStorage.setItem(expandedEventStorageKey, eventId) } catch { /* optional navigation memory */ }
}

export default MobileMenu
