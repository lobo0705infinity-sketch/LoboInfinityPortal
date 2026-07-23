import { Link, useLocation } from 'react-router-dom'
import { getEventNavigationConfig } from '../config/eventNavigation'
import { communityItems } from './sidebarNavigation'

type Breadcrumb = {
  label: string
  to?: string
}

const routeLabels: Record<string, string> = {
  '/army-intelligence': 'Army Intelligence',
  '/army-lists': 'Army Lists',
  '/events': 'Past Events',
  '/hall-of-fame': 'Hall of Fame',
  '/integrity': 'Audit',
  '/match-finder': 'Match Finder',
  '/notifications': 'Alerts',
  '/profile': 'My Profile',
  '/submit-game': 'Submit Game',
}

const eventScopedRoutes: Record<string, string> = {
  '/analytics': 'Statistics',
  '/match-finder': 'Match Finder',
}

function Breadcrumbs() {
  const location = useLocation()
  const breadcrumbs = buildBreadcrumbs(location.pathname, location.search)

  if (breadcrumbs.length <= 1) {
    return null
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {breadcrumbs.map((breadcrumb, index) => {
        const isCurrent = index === breadcrumbs.length - 1

        if (isCurrent || !breadcrumb.to) {
          return (
            <span aria-current={isCurrent ? 'page' : undefined} key={`${breadcrumb.label}-${index}`}>
              {breadcrumb.label}
            </span>
          )
        }

        return (
          <Link key={`${breadcrumb.label}-${breadcrumb.to}`} to={breadcrumb.to}>
            {breadcrumb.label}
          </Link>
        )
      })}
    </nav>
  )
}

function buildBreadcrumbs(pathname: string, search: string): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [{ label: 'Dashboard', to: '/' }]
  const searchParams = new URLSearchParams(search)
  const queryEventId = searchParams.get('eventId') || ''
  const routeEventMatch = pathname.match(/^\/event\/([^/?#]+)/)

  if (routeEventMatch) {
    const eventId = decodeSegment(routeEventMatch[1])
    const event = getEventNavigationConfig(eventId)
    const eventLabel = event?.label ?? eventId

    breadcrumbs.push({
      label: eventLabel,
      to: `/event/${encodeURIComponent(eventId)}`,
    })

    const sectionLabel = resolveEventRouteSection(pathname)
    if (sectionLabel && sectionLabel !== 'Overview') {
      breadcrumbs.push({ label: sectionLabel })
    }

    return breadcrumbs
  }

  if (queryEventId) {
    const event = getEventNavigationConfig(queryEventId)
    if (event) {
      breadcrumbs.push({
        label: event.label,
        to: `/event/${encodeURIComponent(event.id)}`,
      })
      breadcrumbs.push({ label: eventScopedRoutes[pathname] ?? routeLabels[pathname] ?? formatSegment(pathname) })
      return breadcrumbs
    }
  }

  if (pathname === '/army-intelligence') {
    breadcrumbs.push({ label: 'Army Intelligence' })
    return breadcrumbs
  }

  const communityItem = communityItems.find((item) => item.to === pathname)
  if (communityItem) {
    breadcrumbs.push({ label: 'Community', to: communityItems[0]?.to ?? '/players' })
    breadcrumbs.push({ label: communityItem.label })
    return breadcrumbs
  }

  if (
    pathname === '/automation' ||
    pathname === '/diagnostics' ||
    pathname === '/integrity' ||
    pathname.startsWith('/commissioner')
  ) {
    const commissionerSection =
      searchParams.get('section') === 'users'
        ? 'Users'
        : searchParams.get('section') === 'operations'
          ? 'Operations'
          : pathname === '/commissioner/event-manager'
            ? 'Event Manager'
            : pathname === '/commissioner'
              ? 'Command Center'
              : routeLabels[pathname] ?? formatSegment(pathname)

    breadcrumbs.push({ label: 'Commissioner', to: '/commissioner' })
    breadcrumbs.push({ label: commissionerSection })
    return breadcrumbs
  }

  breadcrumbs.push({ label: routeLabels[pathname] ?? formatSegment(pathname) })
  return breadcrumbs
}

function resolveEventRouteSection(pathname: string) {
  const tournamentSectionMatch = pathname.match(/^\/event\/[^/?#]+\/tournament(?:\/([^/?#]+))?$/)
  if (tournamentSectionMatch) {
    return formatSegment(tournamentSectionMatch[1] || 'overview')
  }

  const eventSectionMatch = pathname.match(/^\/event\/[^/?#]+\/([^/?#]+)$/)
  if (eventSectionMatch) {
    return formatSegment(eventSectionMatch[1])
  }

  return 'Overview'
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function formatSegment(pathOrSegment: string) {
  const segment = pathOrSegment.split('/').filter(Boolean).at(-1) || pathOrSegment
  return decodeSegment(segment)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default Breadcrumbs
