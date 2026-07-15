import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'

const systemWorkflows = [
  {
    body: 'Review league health, current audit score, integrity status, and repairable issues.',
    label: 'Health',
    to: '/integrity',
  },
  {
    body: 'Run fresh audits, export audit reports, and repair league data issues.',
    label: 'Audit',
    to: '/integrity',
  },
  {
    body: 'Inspect frontend, backend, identity, Firestore, cache, and deployment diagnostics.',
    label: 'Diagnostics',
    to: '/diagnostics',
  },
  {
    body: 'Clear, refresh, and inspect shared cache state.',
    label: 'Cache Management',
    to: '/commissioner?section=operations',
  },
  {
    body: 'Run rebuild tasks for standings, statistics, achievements, and search data.',
    label: 'Rebuild Engine',
    to: '/commissioner?section=operations',
  },
  {
    body: 'Recalculate statistics and repair generated competitive data.',
    label: 'Recalculate Statistics',
    to: '/integrity',
  },
  {
    body: 'Refresh search index and verify searchable player records.',
    label: 'Refresh Search Index',
    to: '/diagnostics',
  },
  {
    body: 'Maintain automation queues, retries, failed jobs, and background operations.',
    label: 'Queue Maintenance',
    to: '/commissioner/automation',
  },
  {
    body: 'Review portal version, backend deployment, frontend deployment, and build metadata.',
    label: 'Version Information',
    to: '/diagnostics',
  },
  {
    body: 'Inspect deployment IDs, API endpoint configuration, and production build identity.',
    label: 'Deployment Information',
    to: '/diagnostics',
  },
]

function CommissionerSystem() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return (
      <main className="portal-shell">
        <section className="dashboard-state" aria-label="System loading">
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
          <h1>System</h1>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to use system maintenance tools.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="commissioner-system-title">
        <p className="eyebrow">Commissioner</p>
        <h1 id="commissioner-system-title">System</h1>
        <p>
          Maintenance, audit, diagnostics, cache, rebuild, queue, version, and
          deployment tools grouped away from daily league operations.
        </p>
      </section>

      <section className="operations-grid" aria-label="System workflows">
        {systemWorkflows.map((workflow) => (
          <Link className="panel operations-panel" key={workflow.label} to={workflow.to}>
            <p className="eyebrow">System</p>
            <h2>{workflow.label}</h2>
            <p className="operations-empty">{workflow.body}</p>
          </Link>
        ))}
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Maintenance Consoles</p>
          <h2>System Tools</h2>
          <p>
            Audit, Diagnostics, and Operations are consolidated here as
            maintenance workflows. Legacy URLs still work for direct links.
          </p>
        </div>
        <div className="operations-actions wrap">
          <Link to="/integrity">Open Audit</Link>
          <Link to="/diagnostics">Open Diagnostics</Link>
          <Link to="/commissioner?section=operations">Open Operations</Link>
          <Link to="/commissioner/automation">Open Queue Maintenance</Link>
        </div>
      </section>
    </main>
  )
}

export default CommissionerSystem
