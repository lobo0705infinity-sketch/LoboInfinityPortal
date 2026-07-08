import { Link, useLocation } from 'react-router-dom'
import { preloadRoute } from '../services/routePreload'

const labels: Record<string, string> = {
  analytics: 'League Intelligence',
  'army-lists': 'Army List Vault',
  'army-list': 'Army List',
  automation: 'League Automation Center',
  achievement: 'Achievement',
  career: 'Career',
  commissioner: 'Commissioner Dashboard',
  compare: 'Player Comparison',
  faction: 'Faction',
  factions: 'Factions',
  game: 'Match Details',
  games: 'Match Details',
  'hall-of-fame': 'Hall of Fame',
  mission: 'Mission',
  missions: 'Missions',
  news: 'Commissioner News',
  notifications: 'Notifications',
  profile: 'My Profile',
  players: 'Players',
  rules: 'Rules',
  standings: 'Standings',
  stream: 'Stream',
  timeline: 'Timeline',
  'weekly-report': 'Weekly Report',
  submit: 'Submit Army List',
}

function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return null
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/">Dashboard</Link>
      {segments.map((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join('/')}`
        const isCurrent = index === segments.length - 1
        const decoded = decodeSegment(segment)
        const label = labels[segment] ?? decoded

        return isCurrent ? (
          <span aria-current="page" key={path}>
            {label}
          </span>
        ) : (
          <Link
            key={path}
            onFocus={() => preloadRoute(path)}
            onMouseEnter={() => preloadRoute(path)}
            onTouchStart={() => preloadRoute(path)}
            to={path}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export default Breadcrumbs
