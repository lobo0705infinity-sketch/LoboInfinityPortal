import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import EventManagerPanel from '../components/EventManagerPanel'
import Loading from '../components/Loading'

const eventWorkflows = [
  {
    body: 'Create events, set active league state, adjust settings, and manage lifecycle stages.',
    label: 'League Management',
    to: '#event-manager-panel',
  },
  {
    body: 'Operate tournament teams, pairings, rounds, results, and participant status.',
    label: 'Tournament Management',
    to: '/event/event-august-2026-team-tournament/tournament',
  },
  {
    body: 'Open registration, review registration state, and manage participants.',
    label: 'Registration',
    to: '#event-manager-panel',
  },
  {
    body: 'Use scheduling and match finder tools for league availability and generated pairings.',
    label: 'Schedule Generation',
    to: '/match-finder',
  },
  {
    body: 'Review current pairings and event match assignments.',
    label: 'Pairings',
    to: '/event/event-current-league',
  },
  {
    body: 'Advance, rollback, audit, and repair event lifecycle transitions.',
    label: 'Event Lifecycle',
    to: '#event-manager-panel',
  },
  {
    body: 'Maintain event rules, settings, and public event configuration.',
    label: 'Event Rules',
    to: '/rules?eventId=event-current-league',
  },
  {
    body: 'Review event players, divisions, registrations, and participant records.',
    label: 'Event Participants',
    to: '/players?eventId=event-current-league',
  },
  {
    body: 'Publish event news, alerts, timeline entries, and streamed game content.',
    label: 'Event Communications',
    to: '/commissioner/community-manager',
  },
]

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
          League setup, registration, pairings, lifecycle, rules, and event
          participant operations in one place.
        </p>
      </section>

      <section className="operations-grid" aria-label="Event workflows">
        {eventWorkflows.map((workflow) => (
          <Link className="panel operations-panel" key={workflow.label} to={workflow.to}>
            <p className="eyebrow">Events</p>
            <h2>{workflow.label}</h2>
            <p className="operations-empty">{workflow.body}</p>
          </Link>
        ))}
      </section>

      <section className="panel" id="event-manager-panel">
        <EventManagerPanel canManage={auth.hasPermission('runSeasonControl')} />
      </section>
    </main>
  )
}

export default CommissionerEvents
