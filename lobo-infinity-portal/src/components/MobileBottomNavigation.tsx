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
  { icon: 'players', label: 'Players', to: '/players', matches: (path) => path === '/players' || path.startsWith('/players/') || path.startsWith('/player/') },
  { icon: 'submit', label: 'Submit', to: '/submit-game', matches: (path) => path === '/submit-game' },
  { icon: 'army', label: 'Intelligence', to: '/army-intelligence', matches: (path) => path === '/army-intelligence' || path === '/intelligence' },
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
