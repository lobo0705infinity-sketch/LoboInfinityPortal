import { Link, useLocation } from 'react-router-dom'

const labels: Record<string, string> = {
  analytics: 'Statistics',
  'army-lists': 'Army List Vault',
  'army-list': 'Army List',
  automation: 'League Automation Center',
  achievement: 'Achievement',
  career: 'Career',
  commissioner: 'Commissioner Dashboard',
  compare: 'Player Comparison',
  'event-current-league': 'July 2026 League',
  'event-august-2026-team-tournament': 'Team Tournament',
  event: 'Event',
  events: 'Past Events',
  faction: 'Faction',
  factions: 'Factions',
  game: 'Match Details',
  games: 'Match Details',
  'hall-of-fame': 'Hall of Fame',
  intelligence: 'Intelligence',
  mission: 'Mission',
  missions: 'Missions',
  news: 'News',
  notifications: 'Notifications',
  profile: 'My Profile',
  registration: 'Registration',
  players: 'Players',
  rules: 'Rules',
  schedule: 'Schedule',
  standings: 'Standings',
  stream: 'Stream',
  timeline: 'Timeline',
  tournament: 'Tournament',
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
