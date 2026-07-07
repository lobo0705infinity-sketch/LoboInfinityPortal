import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  getPlatformReliability,
  runReliabilityAction,
  type PlatformReliabilityData,
} from '../services/lightApi'
import { getFrontendPerformanceDiagnostics } from '../services/performanceDiagnostics'

function Diagnostics() {
  const auth = useAuth()
  const [platform, setPlatform] = useState<PlatformReliabilityData | null>(null)
  const [workingAction, setWorkingAction] = useState('')
  const canView = auth.isAtLeastRole('Commissioner')
  const canManage = auth.hasPermission('manageCache')
  const snapshot = canView ? getFrontendPerformanceDiagnostics() : null

  useEffect(() => {
    if (!canView) {
      return
    }

    const controller = new AbortController()

    getPlatformReliability({
      signal: controller.signal,
    })
      .then(setPlatform)
      .catch(() => {
        if (!controller.signal.aborted) {
          setPlatform(null)
        }
      })

    return () => {
      controller.abort()
    }
  }, [canView])

  async function executeAction(action: string, target: string, label: string) {
    if (!canManage || workingAction) {
      return
    }

    if (!window.confirm(`${label}?`)) {
      return
    }

    setWorkingAction(`${action}:${target}`)

    try {
      const nextPlatform = await runReliabilityAction(action, target)
      setPlatform(nextPlatform)
    } finally {
      setWorkingAction('')
    }
  }

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
        <h1>Platform Health</h1>
        <p>Browser telemetry, snapshots, job queue, cache health, and recovery.</p>
      </section>

      <section className="operations-grid">
        <MetricCard
          label="Platform"
          value={platform?.health.status ?? 'Loading'}
        />
        <MetricCard
          label="Health Score"
          value={platform ? `${platform.health.score}%` : '...'}
        />
        <MetricCard label="Bundle" value={snapshot.bundleVersion} />
        <MetricCard label="Page Load" value={`${snapshot.pageLoad} ms`} />
        <MetricCard label="FCP" value={`${snapshot.firstContentfulPaint} ms`} />
        <MetricCard label="LCP" value={`${snapshot.largestContentfulPaint} ms`} />
        <MetricCard label="INP" value={`${snapshot.interactionToNextPaint} ms`} />
        <MetricCard label="CLS" value={snapshot.cumulativeLayoutShift} />
        <MetricCard label="TTI" value={`${snapshot.timeToInteractive} ms`} />
        <MetricCard
          label="Route Change"
          value={`${snapshot.routeTransitionMs} ms`}
        />
        <MetricCard label="API Requests" value={snapshot.api.requestCount} />
        <MetricCard label="Cache Hits" value={snapshot.api.cacheHits} />
        <MetricCard label="Cache Misses" value={snapshot.api.cacheMisses} />
        <MetricCard
          label="Average API"
          value={`${Math.round(snapshot.api.averageDurationMs)} ms`}
        />
        <MetricCard
          label="JS Transfer"
          value={formatBytes(snapshot.javascriptTransferBytes)}
        />
        <MetricCard
          label="CSS Transfer"
          value={formatBytes(snapshot.stylesheetTransferBytes)}
        />
        <MetricCard label="Resources" value={snapshot.resourceCount} />
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">OAuth Diagnostics</p>
          <h2>Current Authentication Session</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <tbody>
              <tr>
                <th>Status</th>
                <td>
                  {auth.authState === 'initializing'
                    ? 'Initializing'
                    : auth.authenticated
                      ? 'Authenticated'
                      : 'Not authenticated'}
                </td>
              </tr>
              <tr>
                <th>Initialization Duration</th>
                <td>{auth.initialization.totalMs || 0} ms</td>
              </tr>
              <tr>
                <th>Settings Load</th>
                <td>{auth.initialization.settingsMs || 0} ms</td>
              </tr>
              <tr>
                <th>Google Ready</th>
                <td>{auth.initialization.googleReadyMs || 0} ms</td>
              </tr>
              <tr>
                <th>Credential Restore</th>
                <td>{auth.initialization.googleCredentialMs || 0} ms</td>
              </tr>
              <tr>
                <th>Session Verification</th>
                <td>{auth.initialization.sessionVerificationMs || 0} ms</td>
              </tr>
              <tr>
                <th>Initialization Completed</th>
                <td>{auth.initialization.completedAt || 'Not reported'}</td>
              </tr>
              <tr>
                <th>Stage</th>
                <td>{auth.stage || 'Not reported'}</td>
              </tr>
              <tr>
                <th>Code</th>
                <td>{auth.code || 'Not reported'}</td>
              </tr>
              <tr>
                <th>League Player</th>
                <td>{auth.user.leaguePlayer || 'Not linked'}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td>{auth.user.email || 'Not available'}</td>
              </tr>
              <tr>
                <th>Error</th>
                <td>{auth.error || 'None'}</td>
              </tr>
              <tr>
                <th>Diagnostics</th>
                <td>
                  <pre className="diagnostics-json">
                    {JSON.stringify(auth.diagnostics || {}, null, 2)}
                  </pre>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {platform ? (
        <>
          <section className="panel operations-panel">
            <div className="panel-heading">
              <p className="eyebrow">Snapshot Manager</p>
              <h2>Snapshot Freshness</h2>
            </div>
            <div className="operations-table-wrap">
              <table className="operations-table">
                <thead>
                  <tr>
                    <th>Snapshot</th>
                    <th>Status</th>
                    <th>Age</th>
                    <th>Records</th>
                    <th>Duration</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {platform.snapshots.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{item.status}</td>
                      <td>{item.ageMinutes}m</td>
                      <td>{item.recordCount}</td>
                      <td>{item.durationMs} ms</td>
                      <td>
                        <button
                          disabled={!canManage || workingAction !== ''}
                          onClick={() =>
                            void executeAction(
                              'rebuildSnapshot',
                              item.id,
                              `Rebuild ${item.label}`,
                            )
                          }
                          type="button"
                        >
                          Rebuild
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="operations-grid two-column">
            <section className="panel operations-panel">
              <div className="panel-heading">
                <p className="eyebrow">Job Queue</p>
                <h2>Background Jobs</h2>
              </div>
              <div className="operations-actions wrap">
                <button
                  disabled={!canManage || workingAction !== ''}
                  onClick={() =>
                    void executeAction(
                      'processNextJob',
                      'next',
                      'Process next queued job',
                    )
                  }
                  type="button"
                >
                  Process Next Job
                </button>
              </div>
              <ul className="operations-list">
                {platform.jobs.slice(-8).map((job) => (
                  <li key={job.id}>
                    <strong>{job.type}</strong>
                    <span>{job.status}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel operations-panel">
              <div className="panel-heading">
                <p className="eyebrow">Recovery Center</p>
                <h2>Safe Rebuilds</h2>
              </div>
              <div className="operations-actions wrap">
                {platform.recoveryActions.map((action) => (
                  <button
                    disabled={!canManage || workingAction !== ''}
                    key={action.id}
                    onClick={() =>
                      void executeAction(
                        action.id === 'rebuildEverything'
                          ? 'queueJob'
                          : 'rebuildSnapshot',
                        action.id,
                        action.label,
                      )
                    }
                    type="button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>
          </section>

          <section className="panel operations-panel">
            <div className="panel-heading">
              <p className="eyebrow">Cache Manager</p>
              <h2>Cache Groups</h2>
            </div>
            <dl className="operations-metrics">
              <Metric label="Cache Status" value={platform.cache.status} />
              <Metric
                label="Hit Rate"
                value={`${platform.cache.performance.cacheHitRate}%`}
              />
              <Metric
                label="Miss Rate"
                value={`${platform.cache.performance.cacheMissRate}%`}
              />
              <Metric
                label="Average API"
                value={platform.cache.performance.averageApiResponse}
              />
            </dl>
            <div className="operations-actions wrap">
              {platform.cacheActions.map((cacheAction) => (
                <button
                  disabled={!canManage || workingAction !== ''}
                  key={cacheAction.id}
                  onClick={() =>
                    void executeAction(
                      'invalidateCache',
                      cacheAction.id,
                      `Invalidate ${cacheAction.label} cache`,
                    )
                  }
                  type="button"
                >
                  Invalidate {cacheAction.label}
                </button>
              ))}
              <button
                disabled={!canManage || workingAction !== ''}
                onClick={() =>
                  void executeAction(
                    'clearExpiredCache',
                    'expired',
                    'Clear expired cache entries',
                  )
                }
                type="button"
              >
                Clear Expired
              </button>
            </div>
          </section>

          <section className="panel operations-panel">
            <div className="panel-heading">
              <p className="eyebrow">Health Monitoring</p>
              <h2>Warnings</h2>
            </div>
            {platform.health.warnings.length === 0 ? (
              <p>No operational warnings.</p>
            ) : (
              <ul className="operations-list">
                {platform.health.warnings.map((warning) => (
                  <li key={warning}>
                    <strong>{warning}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

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
          <p className="eyebrow">Real User Monitoring</p>
          <h2>Route Transitions</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Duration</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.routeTransitions.map((route, index) => (
                <tr key={`${route.path}-${route.timestamp}-${index}`}>
                  <td>{route.path}</td>
                  <td>{Math.round(route.durationMs)} ms</td>
                  <td>{new Date(route.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Client Diagnostics</p>
          <h2>Scheduling Workflows</h2>
          <a href="/match-finder?debug=matchfinder">
            Open Match Finder Debug
          </a>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.api.client.recent
                .filter((metric) =>
                  ['availabilitySave', 'matchRequest'].includes(metric.event),
                )
                .map((metric, index) => (
                  <tr key={`${metric.event}-${metric.timestamp}-${index}`}>
                    <td>{metric.event}</td>
                    <td>{metric.status}</td>
                    <td>{metric.durationMs} ms</td>
                    <td>{metric.detail}</td>
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

function Metric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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

function formatBytes(value: number) {
  if (value <= 0) {
    return '0 B'
  }

  if (value < 1024) {
    return `${value} B`
  }

  return `${Math.round(value / 1024)} KB`
}

export default Diagnostics
