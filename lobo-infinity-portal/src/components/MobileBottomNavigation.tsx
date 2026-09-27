import { Link, useLocation } from 'react-router-dom'
import PortalIcon, { type PortalIconName } from './PortalIcon'
import { preloadRoute } from '../services/routePreload'

type MobilePrimaryItem = {
  icon: PortalIconName
  label: string
  to: string
  matches: (pathname: string) => boolean
}

const mobilePrimaryItems: MobilePrimaryItem[] = [
  { icon: 'dashboard', label: 'Home', to: '/', matches: (path) => path === '/' || path === '/dashboard' },
  {
    icon: 'army', label: 'Explore', to: '/explore',
    matches: (path) => ['/explore', '/army-intelligence', '/intelligence', '/games', '/game', '/players', '/player', '/compare', '/rivalries', '/factions', '/faction', '/missions', '/mission', '/army-lists', '/streams', '/analytics', '/hall-of-fame'].some((route) => path === route || path.startsWith(`${route}/`)),
  },
  {
    icon: 'standings', label: 'Events', to: '/events',
    matches: (path) => path === '/events' || path.startsWith('/event/') || path === '/league-operations' || path === '/standings' || path === '/schedule' || path === '/rules',
  },
  { icon: 'submit', label: 'Submit', to: '/submit-game', matches: (path) => path === '/submit-game' },
]

function MobileBottomNavigation() {
  const { pathname } = useLocation()
  const primaryActive = mobilePrimaryItems.some((item) => item.matches(pathname))

  return (
    <nav className="mobile-bottom-navigation" aria-label="Primary mobile navigation">
      {mobilePrimaryItems.map((item) => {
        const active = item.matches(pathname)
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={active ? 'mobile-bottom-navigation-item active' : 'mobile-bottom-navigation-item'}
            key={item.to}
            onFocus={() => preloadRoute(item.to)}
            onPointerEnter={() => preloadRoute(item.to)}
            to={item.to}
          >
            <PortalIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        )
      })}
      <Link
        aria-current={!primaryActive ? 'page' : undefined}
        className={!primaryActive ? 'mobile-bottom-navigation-item active' : 'mobile-bottom-navigation-item'}
        to="/menu"
      >
        <PortalIcon name="rules" />
        <span>More</span>
      </Link>
    </nav>
  )
}

export default MobileBottomNavigation
