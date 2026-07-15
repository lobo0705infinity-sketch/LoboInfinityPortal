import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'

const playerWorkflows = [
  {
    body: 'Browse public competitive records, divisions, rankings, and profile pages.',
    label: 'Player Profiles',
    to: '/players',
  },
  {
    body: 'Manage commissioner roles, portal accounts, identity records, and access state.',
    label: 'Commissioner Permissions',
    to: '/commissioner?section=users',
  },
  {
    body: 'Review canonical player identity, league assignment, and Players sheet matching.',
    label: 'League Assignment',
    to: '/commissioner?section=users',
  },
  {
    body: 'Resolve display names, Google email links, missing emails, and duplicate accounts.',
    label: 'Display Name Management',
    to: '/commissioner?section=users',
  },
  {
    body: 'Review submitted lists and list approval workflows.',
    label: 'Army Lists',
    to: '/army-lists',
  },
  {
    body: 'Review availability, scheduling requests, and match finder player state.',
    label: 'Availability',
    to: '/match-finder',
  },
  {
    body: 'Review player awards, unlock rules, and achievement state.',
    label: 'Achievements',
    to: '/hall-of-fame',
  },
  {
    body: 'Find players by name, profile, faction, division, or competitive identity.',
    label: 'Player Search',
    to: '/players',
  },
]

function CommissionerPlayers() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return (
      <main className="portal-shell">
        <section className="dashboard-state" aria-label="Players loading">
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
          <h1>Players</h1>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to manage player-facing league operations.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="commissioner-players-title">
        <p className="eyebrow">Commissioner</p>
        <h1 id="commissioner-players-title">Players</h1>
        <p>
          Player profiles, permissions, identity resolution, availability,
          army lists, and achievement operations.
        </p>
      </section>

      <section className="operations-grid" aria-label="Player workflows">
        {playerWorkflows.map((workflow) => (
          <Link className="panel operations-panel" key={workflow.label} to={workflow.to}>
            <p className="eyebrow">Players</p>
            <h2>{workflow.label}</h2>
            <p className="operations-empty">{workflow.body}</p>
          </Link>
        ))}
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Identity Tools</p>
          <h2>Player Administration</h2>
          <p>
            Detailed identity records, account repair actions, role management,
            and audit history remain in Command Center under the player identity
            panel.
          </p>
        </div>
        <div className="operations-actions wrap">
          <Link to="/commissioner?section=users">Open Player Identity Tools</Link>
          <Link to="/players">Open Player Directory</Link>
          <Link to="/army-lists">Open Army Lists</Link>
          <Link to="/match-finder">Open Availability</Link>
        </div>
      </section>
    </main>
  )
}

export default CommissionerPlayers
