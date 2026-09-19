import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import EventManagerPanel, { type EventManagerFocus } from '../components/EventManagerPanel'

const operations: Record<string, { eventId: string; focus: EventManagerFocus; title: string }> = {
  'league-mission-map': {
    eventId: 'event-current-league',
    focus: 'league',
    title: 'League Mission & Map',
  },
  'team-tournament': {
    eventId: 'event-august-2026-team-tournament',
    focus: 'team',
    title: 'Team Tournament Operations',
  },
  'top-40': {
    eventId: 'event-lobo-s-american-top-40',
    focus: 'top40',
    title: 'Top 40 Operations',
  },
}

function CommissionerEventOperations() {
  const auth = useAuth()
  const { operation = '' } = useParams()
  const config = operations[operation]

  if (!config) {
    return <Link to="/commissioner/events">Back to Events</Link>
  }

  if (auth.status === 'loading') return null

  if (!auth.authenticated || !auth.isAtLeastRole('Assistant Commissioner')) {
    return (
      <main className="portal-shell">
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h1>{config.title}</h1>
          <p>Sign in with an enabled Assistant Commissioner or Commissioner account to continue.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <section className="page-header">
        <p className="eyebrow">Commissioner Events</p>
        <h1>{config.title}</h1>
        <Link to="/commissioner/events">Back to Events</Link>
      </section>
      <section className="panel">
        <EventManagerPanel
          canManage={auth.hasPermission('runSeasonControl')}
          focus={config.focus}
          initialEventId={config.eventId}
        />
      </section>
    </main>
  )
}

export default CommissionerEventOperations
