import { NavLink } from 'react-router-dom'

const navigationItems = [
  {
    icon: '▣',
    label: 'Dashboard',
    to: '/',
  },
  {
    icon: '≡',
    label: 'Standings',
    to: '/standings',
  },
  {
    icon: '◎',
    label: 'Players',
    to: '/players',
  },
  {
    icon: '⬟',
    label: 'Factions',
    to: '/factions',
  },
  {
    icon: '✦',
    label: 'Missions',
    to: '/missions',
  },
  {
    icon: '⌁',
    label: 'Analytics',
    to: '/analytics',
  },
  {
    icon: '◇',
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
