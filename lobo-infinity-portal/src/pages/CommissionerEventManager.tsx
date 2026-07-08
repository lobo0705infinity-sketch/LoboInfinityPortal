import { useAuth } from '../auth/AuthContext'
import EventManagerPanel from '../components/EventManagerPanel'
import Loading from '../components/Loading'

function CommissionerEventManager() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return (
      <main className="portal-shell">
        <section className="dashboard-state" aria-label="Event Manager loading">
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
          <h1>Event Manager</h1>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to manage Event Engine operations.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <section className="panel">
        <EventManagerPanel canManage={auth.hasPermission('runSeasonControl')} />
      </section>
    </main>
  )
}

export default CommissionerEventManager
