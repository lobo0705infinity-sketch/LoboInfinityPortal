import { NavLink } from 'react-router-dom'
import LeagueCrest from './LeagueCrest'
import PortalIcon, { type PortalIconName } from './PortalIcon'

const navigationItems: Array<{
  icon: PortalIconName
  label: string
  to: string
}> = [
  {
    icon: 'dashboard',
    label: 'Dashboard',
    to: '/',
  },
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
  {
    icon: 'standings',
    label: 'Standings',
    to: '/standings',
  },
  {
    icon: 'players',
    label: 'Players',
    to: '/players',
  },
  {
    icon: 'factions',
    label: 'Factions',
    to: '/factions',
  },
  {
    icon: 'missions',
    label: 'Missions',
    to: '/missions',
  },
  {
    icon: 'analytics',
    label: 'Intelligence',
    to: '/analytics',
  },
  {
    icon: 'hall',
    label: 'Hall of Fame',
    to: '/hall-of-fame',
  },
  {
    icon: 'compare',
    label: 'Compare',
    to: '/compare',
  },
  {
    icon: 'rules',
    label: 'Rules',
    to: '/rules',
  },
]

function Sidebar() {
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
        {navigationItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              isActive ? 'sidebar-button active' : 'sidebar-button'
            }
            end={item.to === '/'}
            key={item.to}
            to={item.to}
          >
            <span className="sidebar-icon" aria-hidden="true">
              <PortalIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
