import { NavLink } from 'react-router-dom'

const navigationItems = [
  {
    icon: 'D',
    label: 'Dashboard',
    to: '/',
  },
  {
    icon: 'N',
    label: 'News',
    to: '/news',
  },
  {
    icon: 'T',
    label: 'Timeline',
    to: '/timeline',
  },
  {
    icon: 'W',
    label: 'Streams',
    to: '/streams',
  },
  {
    icon: '!',
    label: 'Alerts',
    to: '/notifications',
  },
  {
    icon: 'S',
    label: 'Standings',
    to: '/standings',
  },
  {
    icon: 'P',
    label: 'Players',
    to: '/players',
  },
  {
    icon: 'F',
    label: 'Factions',
    to: '/factions',
  },
  {
    icon: 'M',
    label: 'Missions',
    to: '/missions',
  },
  {
    icon: 'A',
    label: 'Analytics',
    to: '/analytics',
  },
  {
    icon: 'H',
    label: 'Hall of Fame',
    to: '/hall-of-fame',
  },
  {
    icon: 'V',
    label: 'Compare',
    to: '/compare',
  },
  {
    icon: 'R',
    label: 'Rules',
    to: '/rules',
  },
]

function Sidebar() {
  return (
    <aside className="sidebar" aria-label="League navigation">
      <div className="sidebar-brand">
        <span className="brand-symbol">LI</span>
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
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
