import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { buildInfo } from '../services/buildInfo'
import {
  getPlatformReliability,
  runReliabilityAction,
  type PlatformReliabilityData,
} from '../services/lightApi'
import { getFrontendPerformanceDiagnostics } from '../services/performanceDiagnostics'
import {
  getDataProviderDiagnostics,
  runDataMigrationToFirestore,
} from '../services/data'

function Diagnostics() {
  const auth = useAuth()
  const [platform, setPlatform] = useState<PlatformReliabilityData | null>(null)
  const [providerDiagnostics, setProviderDiagnostics] = useState<Awaited<
    ReturnType<typeof getDataProviderDiagnostics>
  > | null>(null)
  const [workingAction, setWorkingAction] = useState('')
  const [workingMigration, setWorkingMigration] = useState(false)
  const canView = auth.isAtLeastRole('Commissioner')
  const canManage = auth.hasPermission('manageCache')
  const canRunFirestoreMigration = auth.isAtLeastRole('Commissioner')
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

    getDataProviderDiagnostics()
      .then(setProviderDiagnostics)
      .catch(() => setProviderDiagnostics(null))

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

  async function executeFirestoreMigration() {
    if (!canRunFirestoreMigration || workingMigration) {
      return
    }

    if (
      !window.confirm(
        'Run Firestore data migration? Google Sheets remains authoritative.',
      )
    ) {
      return
    }

    setWorkingMigration(true)

    try {
      await runDataMigrationToFirestore()
      setProviderDiagnostics(await getDataProviderDiagnostics())
    } finally {
      setWorkingMigration(false)
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

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Firestore Migration</p>
          <h2>Data Mirror Control</h2>
          <p>
            Copies Google Sheets data into Firestore. Google Sheets remains
            authoritative.
          </p>
        </div>
        <div className="operations-actions wrap">
          <button
            disabled={!canRunFirestoreMigration || workingMigration}
            onClick={() => void executeFirestoreMigration()}
            type="button"
          >
            {workingMigration ? 'Migrating Firestore...' : 'Run Firestore Migration'}
          </button>
        </div>
        {!canRunFirestoreMigration ? (
          <p>Commissioner access is required to run Firestore migration.</p>
        ) : null}
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
        <MetricCard label="Cache Hit Ratio" value={`${snapshot.api.cacheHitRatio}%`} />
        <MetricCard label="Shared Requests" value={snapshot.api.sharedRequests} />
        <MetricCard
          label="Average API"
          value={`${Math.round(snapshot.api.averageDurationMs)} ms`}
        />
        <MetricCard
          label="Slowest Mount"
          value={
            snapshot.longestComponentMount
              ? `${snapshot.longestComponentMount.name} ${snapshot.longestComponentMount.durationMs} ms`
              : 'None'
          }
        />
        <MetricCard label="Long Tasks" value={snapshot.longTasks.length} />
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
          <p className="eyebrow">Production Build Identity</p>
          <h2>Frontend Deployment</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <tbody>
              <tr>
                <th>Git Commit</th>
                <td>{buildInfo.gitCommit}</td>
              </tr>
              <tr>
                <th>Build Timestamp</th>
                <td>{buildInfo.buildTimestamp}</td>
              </tr>
              <tr>
                <th>Vercel Deployment ID</th>
                <td>{buildInfo.deploymentId}</td>
              </tr>
              <tr>
                <th>Frontend Build Version</th>
                <td>{buildInfo.frontendVersion}</td>
              </tr>
              <tr>
                <th>Vercel URL</th>
                <td>{buildInfo.vercelUrl || 'Not reported'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Data Access Layer</p>
          <h2>Storage Provider</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <tbody>
              <tr>
                <th>Provider</th>
                <td>{providerDiagnostics?.active.name ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Storage</th>
                <td>{providerDiagnostics?.active.storage ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td>{providerDiagnostics?.health.status ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Project</th>
                <td>{providerDiagnostics?.health.projectId ?? 'Not configured'}</td>
              </tr>
              <tr>
                <th>Region</th>
                <td>{providerDiagnostics?.health.region ?? 'Not reported'}</td>
              </tr>
              <tr>
                <th>Schema Version</th>
                <td>{providerDiagnostics?.health.schemaVersion ?? 'Not initialized'}</td>
              </tr>
              <tr>
                <th>Latency</th>
                <td>{providerDiagnostics ? `${providerDiagnostics.health.latencyMs} ms` : 'Loading'}</td>
              </tr>
              <tr>
                <th>Collections</th>
                <td>
                  {providerDiagnostics?.health.collections?.join(', ') ??
                    'Not reported'}
                </td>
              </tr>
              <tr>
                <th>Document Counts</th>
                <td>
                  <pre className="diagnostics-json">
                    {JSON.stringify(
                      providerDiagnostics?.health.collectionCounts ?? {},
                      null,
                      2,
                    )}
                  </pre>
                </td>
              </tr>
              <tr>
                <th>Dual Compare</th>
                <td>
                  {providerDiagnostics
                    ? `${providerDiagnostics.comparison.mismatches} mismatches across ${providerDiagnostics.comparison.total} comparisons`
                    : 'Loading'}
                </td>
              </tr>
              <tr>
                <th>Errors</th>
                <td>
                  {(providerDiagnostics?.health.errors.length ?? 0) > 0
                    ? providerDiagnostics?.health.errors.join('; ')
                    : 'None'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Firestore Bootstrap</p>
          <h2>Connection & Schema</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <tbody>
              <tr>
                <th>Overall Health</th>
                <td>{providerDiagnostics?.bootstrap.overallHealth ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Provider Mode</th>
                <td>{providerDiagnostics?.bootstrap.provider ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Project ID</th>
                <td>{providerDiagnostics?.bootstrap.projectId || 'Not configured'}</td>
              </tr>
              <tr>
                <th>Region</th>
                <td>{providerDiagnostics?.bootstrap.region ?? 'Not reported'}</td>
              </tr>
              <tr>
                <th>SDK</th>
                <td>{formatBootstrapCheck(providerDiagnostics?.bootstrap.sdk)}</td>
              </tr>
              <tr>
                <th>Authentication</th>
                <td>{formatBootstrapCheck(providerDiagnostics?.bootstrap.authentication)}</td>
              </tr>
              <tr>
                <th>Connection</th>
                <td>{formatBootstrapCheck(providerDiagnostics?.bootstrap.connection)}</td>
              </tr>
              <tr>
                <th>Read Test</th>
                <td>{formatBootstrapCheck(providerDiagnostics?.bootstrap.readTest)}</td>
              </tr>
              <tr>
                <th>Write Test</th>
                <td>{formatBootstrapCheck(providerDiagnostics?.bootstrap.writeTest)}</td>
              </tr>
              <tr>
                <th>Schema</th>
                <td>
                  {providerDiagnostics
                    ? `${formatBootstrapCheck(providerDiagnostics.bootstrap.schema)} Version ${providerDiagnostics.bootstrap.schema.version}`
                    : 'Loading'}
                </td>
              </tr>
              <tr>
                <th>Collections</th>
                <td>{formatBootstrapCheck(providerDiagnostics?.bootstrap.collectionsInitialized)}</td>
              </tr>
              <tr>
                <th>Seed Data</th>
                <td>{formatBootstrapCheck(providerDiagnostics?.bootstrap.seed)}</td>
              </tr>
              <tr>
                <th>Indexes</th>
                <td>{formatBootstrapCheck(providerDiagnostics?.bootstrap.indexes)}</td>
              </tr>
              <tr>
                <th>Security</th>
                <td>{formatBootstrapCheck(providerDiagnostics?.bootstrap.security)}</td>
              </tr>
              <tr>
                <th>Startup Safety</th>
                <td>{providerDiagnostics?.bootstrap.fallback.message ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Environment Variables</th>
                <td>
                  <pre className="diagnostics-json">
                    {JSON.stringify(
                      providerDiagnostics?.bootstrap.environment.variables ?? [],
                      null,
                      2,
                    )}
                  </pre>
                </td>
              </tr>
              <tr>
                <th>Missing Variables</th>
                <td>
                  {(providerDiagnostics?.bootstrap.environment.missing.length ?? 0) > 0
                    ? providerDiagnostics?.bootstrap.environment.missing.join(', ')
                    : 'None'}
                </td>
              </tr>
              <tr>
                <th>Bootstrap Errors</th>
                <td>
                  {(providerDiagnostics?.bootstrap.errors.length ?? 0) > 0
                    ? providerDiagnostics?.bootstrap.errors.join('; ')
                    : 'None'}
                </td>
              </tr>
              <tr>
                <th>Latency</th>
                <td>
                  {providerDiagnostics
                    ? `${providerDiagnostics.bootstrap.latencyMs} ms`
                    : 'Loading'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Migration Verification</p>
          <h2>Firestore Readiness</h2>
        </div>
        <dl className="operations-metrics">
          <Metric
            label="Migration"
            value={providerDiagnostics?.migrationRun.overallStatus ?? 'Loading'}
          />
          <Metric
            label="Documents Written"
            value={providerDiagnostics?.migrationRun.documentsWritten ?? 'Loading'}
          />
          <Metric
            label="Documents Verified"
            value={providerDiagnostics?.migrationRun.documentsVerified ?? 'Loading'}
          />
          <Metric
            label="Throughput"
            value={
              providerDiagnostics
                ? `${providerDiagnostics.migrationRun.throughputPerSecond}/sec`
                : 'Loading'
            }
          />
        </dl>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Collection</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Written</th>
                <th>Verified</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {(providerDiagnostics?.migrationRun.collections ?? []).map((collection) => (
                <tr key={collection.collection}>
                  <td>{collection.collection}</td>
                  <td>{collection.status}</td>
                  <td>{collection.percent}%</td>
                  <td>{collection.written}</td>
                  <td>{collection.verified}</td>
                  <td>{collection.durationMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(providerDiagnostics?.migrationRun.failures.length ?? 0) > 0 ? (
          <pre className="diagnostics-json">
            {JSON.stringify(providerDiagnostics?.migrationRun.failures, null, 2)}
          </pre>
        ) : null}
        <dl className="operations-metrics">
          <Metric
            label="Overall Readiness"
            value={providerDiagnostics?.migration.overallReadiness ?? 'Loading'}
          />
          <Metric
            label="Migration Progress"
            value={
              providerDiagnostics
                ? `${providerDiagnostics.migration.migrationProgress}%`
                : 'Loading'
            }
          />
          <Metric
            label="Mismatch Count"
            value={providerDiagnostics?.migration.mismatchCount ?? 'Loading'}
          />
          <Metric
            label="Last Verification"
            value={providerDiagnostics?.migration.lastVerification ?? 'Loading'}
          />
        </dl>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <tbody>
              <tr>
                <th>Active Provider</th>
                <td>{providerDiagnostics?.migration.provider.active ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Google Status</th>
                <td>{providerDiagnostics?.migration.provider.google ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Firestore Status</th>
                <td>{providerDiagnostics?.migration.provider.firestore ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Synchronization</th>
                <td>
                  {providerDiagnostics
                    ? `${providerDiagnostics.migration.synchronization.readSuccess}% read success, ${providerDiagnostics.migration.synchronization.mismatchRate}% mismatch rate`
                    : 'Loading'}
                </td>
              </tr>
              <tr>
                <th>Replication Latency</th>
                <td>
                  {providerDiagnostics
                    ? `${providerDiagnostics.migration.synchronization.replicationLatencyMs} ms`
                    : 'Loading'}
                </td>
              </tr>
              <tr>
                <th>Write Verification</th>
                <td>{providerDiagnostics?.migration.synchronization.writeSuccess ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Firestore Completeness</th>
                <td>
                  {providerDiagnostics
                    ? `${providerDiagnostics.migration.firestoreComplete.status}: ${providerDiagnostics.migration.firestoreComplete.collections.length} collections, ${providerDiagnostics.migration.firestoreComplete.missingCollections.length} missing`
                    : 'Loading'}
                </td>
              </tr>
              <tr>
                <th>Missing Collections</th>
                <td>
                  {(providerDiagnostics?.migration.firestoreComplete.missingCollections.length ?? 0) > 0
                    ? providerDiagnostics?.migration.firestoreComplete.missingCollections.join(', ')
                    : 'None'}
                </td>
              </tr>
              <tr>
                <th>Rollback</th>
                <td>{providerDiagnostics?.migration.rollback.instruction ?? 'Loading'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Repository Comparison</p>
          <h2>Parity Status</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Status</th>
                <th>Methods</th>
                <th>Mismatches</th>
                <th>Google</th>
                <th>Firestore</th>
                <th>P95</th>
              </tr>
            </thead>
            <tbody>
              {(providerDiagnostics?.migration.repositories ?? []).map((repository) => (
                <tr key={repository.repository}>
                  <td>{repository.repository}</td>
                  <td>{repository.status}</td>
                  <td>{repository.methodCount}</td>
                  <td>{repository.mismatchCount}</td>
                  <td>{repository.googleLatencyMs} ms</td>
                  <td>{repository.firestoreLatencyMs} ms</td>
                  <td>{repository.p95LatencyMs} ms</td>
                </tr>
              ))}
              {(providerDiagnostics?.migration.repositories.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7}>Loading repository comparison...</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Difference Viewer</p>
          <h2>Provider Mismatches</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Method</th>
                <th>Field</th>
                <th>Google</th>
                <th>Firestore</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {(providerDiagnostics?.migration.differences ?? []).slice(0, 25).map((difference, index) => (
                <tr key={`${difference.repository}-${difference.method}-${difference.field}-${index}`}>
                  <td>{difference.repository}</td>
                  <td>{difference.method}</td>
                  <td>{difference.field}</td>
                  <td>
                    <pre className="diagnostics-json">{difference.googleValue}</pre>
                  </td>
                  <td>
                    <pre className="diagnostics-json">{difference.firestoreValue}</pre>
                  </td>
                  <td>{difference.severity}</td>
                </tr>
              ))}
              {(providerDiagnostics?.migration.differences.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6}>No provider differences reported.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Performance Comparison</p>
          <h2>Google Sheets vs Firestore</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Average</th>
                <th>Median</th>
                <th>P95</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Google Sheets</td>
                <td>{providerDiagnostics?.migration.performance.google.averageMs ?? 'Loading'} ms</td>
                <td>{providerDiagnostics?.migration.performance.google.medianMs ?? 'Loading'} ms</td>
                <td>{providerDiagnostics?.migration.performance.google.p95Ms ?? 'Loading'} ms</td>
              </tr>
              <tr>
                <td>Firestore</td>
                <td>{providerDiagnostics?.migration.performance.firestore.averageMs ?? 'Loading'} ms</td>
                <td>{providerDiagnostics?.migration.performance.firestore.medianMs ?? 'Loading'} ms</td>
                <td>{providerDiagnostics?.migration.performance.firestore.p95Ms ?? 'Loading'} ms</td>
              </tr>
            </tbody>
          </table>
        </div>
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

      <section className="operations-grid two-column">
        <section className="panel operations-panel">
          <div className="panel-heading">
            <p className="eyebrow">Runtime Rendering</p>
            <h2>Recent Route Mounts</h2>
          </div>
          <ul className="operations-list">
            {snapshot.componentMounts.length === 0 ? (
              <li>
                <strong>No route mounts captured yet.</strong>
              </li>
            ) : (
              snapshot.componentMounts.slice(-8).map((metric) => (
                <li key={`${metric.name}-${metric.timestamp}`}>
                  <strong>{metric.name}</strong>
                  <span>{metric.durationMs} ms</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="panel operations-panel">
          <div className="panel-heading">
            <p className="eyebrow">Main Thread</p>
            <h2>Recent Long Tasks</h2>
          </div>
          <ul className="operations-list">
            {snapshot.longTasks.length === 0 ? (
              <li>
                <strong>No long tasks captured.</strong>
              </li>
            ) : (
              snapshot.longTasks.map((task) => (
                <li key={`${task.startTime}-${task.timestamp}`}>
                  <strong>{task.name || 'Browser task'}</strong>
                  <span>{task.durationMs} ms</span>
                </li>
              ))
            )}
          </ul>
        </section>
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

function formatBootstrapCheck(
  check:
    | {
        detail: string
        status: 'FAIL' | 'PASS' | 'WARN'
      }
    | undefined,
) {
  if (!check) {
    return 'Loading'
  }

  return `${check.status}: ${check.detail}`
}

export default Diagnostics
