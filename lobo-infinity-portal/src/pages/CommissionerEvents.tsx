import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import EventManagerPanel from '../components/EventManagerPanel'
import Loading from '../components/Loading'

function CommissionerEvents() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return (
      <main className="portal-shell">
        <section className="dashboard-state" aria-label="Events loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (!auth.authenticated || !auth.isAtLeastRole('Assistant Commissioner')) {
    return (
      <main className="portal-shell">
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h1>Events</h1>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to manage league and tournament events.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="commissioner-events-title">
        <p className="eyebrow">Commissioner</p>
        <h1 id="commissioner-events-title">Events</h1>
        <p>
          Create and operate events, registrations, participants, League
          mission and map assignments, brackets, teams, and pairings.
        </p>
        <div className="operations-actions">
          <Link to="/commissioner?section=scheduling">Open Scheduling Monitor</Link>
          <Link to="/commissioner?section=settings">Open Portal Settings</Link>
        </div>
      </section>

      <section className="panel" id="event-manager-panel">
        <EventManagerPanel canManage={auth.hasPermission('runSeasonControl')} />
      </section>
    </main>
  )
}

export default CommissionerEvents
