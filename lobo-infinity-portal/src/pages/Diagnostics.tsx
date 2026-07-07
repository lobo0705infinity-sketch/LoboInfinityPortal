import { useAuth } from '../auth/AuthContext'
import { getFrontendPerformanceDiagnostics } from '../services/performanceDiagnostics'

function Diagnostics() {
  const auth = useAuth()
  const canView = auth.isAtLeastRole('Commissioner')
  const snapshot = canView ? getFrontendPerformanceDiagnostics() : null

  if (!canView) {
    return (
      <main className="portal-shell">
        <section className="panel operations-access-card">
          <p className="eyebrow">Diagnostics</p>
          <h1>Commissioner Access Required</h1>
          <p>Performance diagnostics are read-only and restricted.</p>
        </section>
      </main>
    )
  }

  if (!snapshot) {
    return (
      <main className="portal-shell">
        <section className="dashboard-state">Loading diagnostics...</section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <section className="page-header">
        <p className="eyebrow">Commissioner Diagnostics</p>
        <h1>Performance Diagnostics</h1>
        <p>Read-only browser and endpoint timing telemetry.</p>
      </section>

      <section className="operations-grid">
        <MetricCard label="Bundle" value={snapshot.bundleVersion} />
        <MetricCard label="Page Load" value={`${snapshot.pageLoad} ms`} />
        <MetricCard label="FCP" value={`${snapshot.firstContentfulPaint} ms`} />
        <MetricCard label="LCP" value={`${snapshot.largestContentfulPaint} ms`} />
        <MetricCard label="TTI" value={`${snapshot.timeToInteractive} ms`} />
        <MetricCard label="API Requests" value={snapshot.api.requestCount} />
        <MetricCard label="Cache Hits" value={snapshot.api.cacheHits} />
        <MetricCard label="Cache Misses" value={snapshot.api.cacheMisses} />
        <MetricCard
          label="Average API"
          value={`${Math.round(snapshot.api.averageDurationMs)} ms`}
        />
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Endpoint Timing</p>
          <h2>Recent Requests</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Cache</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.api.recent.map((metric, index) => (
                <tr key={`${metric.action}-${metric.timestamp}-${index}`}>
                  <td>{metric.action}</td>
                  <td>{metric.cache}</td>
                  <td>{metric.durationMs} ms</td>
                  <td>{metric.ok ? 'OK' : 'Failed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Slow Endpoint Warnings</p>
          <h2>Top Five</h2>
        </div>
        <ul className="operations-list">
          {snapshot.api.slowest.map((metric) => (
            <li key={`${metric.action}-${metric.timestamp}`}>
              <strong>{metric.action}</strong>
              <span>{metric.durationMs} ms</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <article className="panel operations-panel">
      <p className="eyebrow">{label}</p>
      <h2>{value}</h2>
    </article>
  )
}

export default Diagnostics
