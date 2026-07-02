import { Link, useLocation } from 'react-router-dom'

const labels: Record<string, string> = {
  analytics: 'League Intelligence',
  compare: 'Player Comparison',
  factions: 'Factions',
  games: 'Match Details',
  'hall-of-fame': 'Hall of Fame',
  missions: 'Missions',
  news: 'Commissioner News',
  notifications: 'Notifications',
  players: 'Players',
  rules: 'Rules',
  standings: 'Standings',
  timeline: 'Timeline',
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
          <Link key={path} to={path}>
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
