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
  buildPerformanceObservatory,
  type PerformanceObservatorySnapshot,
} from '../services/performanceObservatory'
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
  const observatory = canView ? buildPerformanceObservatory() : null

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

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Firebase Authentication Bridge</p>
          <h2>Authentication Bridge Health</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <tbody>
              <tr>
                <th>Google OAuth</th>
                <td>
                  {auth.identity?.google.status
                    ? `${auth.identity.google.status}: ${auth.identity.google.detail}`
                    : 'Unknown'}
                </td>
              </tr>
              <tr>
                <th>Portal Session</th>
                <td>
                  {auth.identity?.portalSession.status
                    ? `${auth.identity.portalSession.status}: ${auth.identity.portalSession.detail}`
                    : 'Unknown'}
                </td>
              </tr>
              <tr>
                <th>Identity Service</th>
                <td>
                  {auth.identity?.firebase.status
                    ? `${auth.identity.firebase.status}: ${auth.identity.firebase.detail}`
                    : 'Unknown'}
                </td>
              </tr>
              <tr>
                <th>Firebase SDK</th>
                <td>
                  {providerDiagnostics?.bootstrap.sdk
                    ? `${providerDiagnostics.bootstrap.sdk.status}: ${providerDiagnostics.bootstrap.sdk.detail}`
                    : 'Loading'}
                </td>
              </tr>
              <tr>
                <th>signInWithCredential()</th>
                <td>{auth.identity?.firebase.code ?? 'Unknown'}</td>
              </tr>
              <tr>
                <th>Firebase User</th>
                <td>
                  {providerDiagnostics?.bootstrap.user.signedIn
                    ? `${providerDiagnostics.bootstrap.user.email || 'Signed in'} (${providerDiagnostics.bootstrap.user.role})`
                    : 'Not signed into Firebase Auth'}
                </td>
              </tr>
              <tr>
                <th>Firestore Bootstrap</th>
                <td>
                  {providerDiagnostics?.bootstrap.overallHealth
                    ? `${providerDiagnostics.bootstrap.overallHealth}: ${providerDiagnostics.bootstrap.fallback.message}`
                    : 'Loading'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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

      {observatory ? <PerformanceObservatorySection observatory={observatory} /> : null}

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
          <p className="eyebrow">Firebase Authentication Bridge</p>
          <h2>Auth Bridge Health</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <tbody>
              <tr>
                <th>Google OAuth</th>
                <td>
                  {auth.identity?.google.status
                    ? `${auth.identity.google.status}: ${auth.identity.google.detail}`
                    : 'Unknown'}
                </td>
              </tr>
              <tr>
                <th>Identity Service</th>
                <td>
                  {auth.identity?.portalSession.status
                    ? `${auth.identity.portalSession.status}: ${auth.identity.portalSession.detail}`
                    : 'Unknown'}
                </td>
              </tr>
              <tr>
                <th>Firebase SDK</th>
                <td>
                  {providerDiagnostics?.bootstrap.sdk
                    ? `${providerDiagnostics.bootstrap.sdk.status}: ${providerDiagnostics.bootstrap.sdk.detail}`
                    : 'Loading'}
                </td>
              </tr>
              <tr>
                <th>signInWithCredential()</th>
                <td>
                  {auth.identity?.firebase.status
                    ? `${auth.identity.firebase.status}: ${auth.identity.firebase.detail}`
                    : 'Unknown'}
                </td>
              </tr>
              <tr>
                <th>Firebase User</th>
                <td>
                  {providerDiagnostics?.bootstrap.user.signedIn
                    ? `PASS: ${providerDiagnostics.bootstrap.user.email || 'Signed in'} (${providerDiagnostics.bootstrap.user.role})`
                    : `FAIL: Not signed into Firebase Auth`}
                </td>
              </tr>
              <tr>
                <th>Firestore Bootstrap</th>
                <td>
                  {providerDiagnostics?.bootstrap.overallHealth
                    ? `${providerDiagnostics.bootstrap.overallHealth}: ${providerDiagnostics.bootstrap.fallback.message}`
                    : 'Loading'}
                </td>
              </tr>
              <tr>
                <th>Firebase Identity Code</th>
                <td>{auth.identity?.firebase.code ?? 'Unknown'}</td>
              </tr>
              <tr>
                <th>Firebase Identity Reason</th>
                <td>{auth.identity?.firebase.detail ?? 'Unknown'}</td>
              </tr>
              <tr>
                <th>Bootstrap Authentication</th>
                <td>
                  {providerDiagnostics?.bootstrap.authentication
                    ? `${providerDiagnostics.bootstrap.authentication.status}: ${providerDiagnostics.bootstrap.authentication.detail}`
                    : 'Loading'}
                </td>
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
                <th>Security Rules Version</th>
                <td>{providerDiagnostics?.bootstrap.securityRulesVersion ?? 'Loading'}</td>
              </tr>
              <tr>
                <th>Firebase User</th>
                <td>
                  {providerDiagnostics
                    ? providerDiagnostics.bootstrap.user.signedIn
                      ? `${providerDiagnostics.bootstrap.user.email || 'Signed in'} (${providerDiagnostics.bootstrap.user.role})`
                      : 'Not signed into Firebase Auth'
                    : 'Loading'}
                </td>
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
          <p className="eyebrow">Firestore Security</p>
          <h2>Collection Access Matrix</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Collection</th>
                <th>Public</th>
                <th>Player</th>
                <th>Assistant Commissioner</th>
                <th>Commissioner</th>
              </tr>
            </thead>
            <tbody>
              {(providerDiagnostics?.bootstrap.accessMatrix ?? []).map((entry) => (
                <tr key={entry.collection}>
                  <td>{entry.collection}</td>
                  <td>{entry.public}</td>
                  <td>{entry.player}</td>
                  <td>{entry.assistantCommissioner}</td>
                  <td>{entry.commissioner}</td>
                </tr>
              ))}
              {(providerDiagnostics?.bootstrap.accessMatrix.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5}>Loading security matrix...</td>
                </tr>
              ) : null}
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

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Identity Service</p>
          <h2>Unified Identity Health</h2>
        </div>
        <dl className="operations-metrics">
          <Metric
            label="Overall Identity"
            value={auth.identity?.identityHealth ?? 'Loading'}
          />
          <Metric
            label="Synchronized"
            value={auth.identity ? (auth.identity.synchronized ? 'Yes' : 'No') : 'Loading'}
          />
          <Metric
            label="Identity Version"
            value={auth.identity?.version ?? 'Loading'}
          />
          <Metric
            label="Claim Version"
            value={auth.identity?.claimVersion ?? 'Loading'}
          />
        </dl>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Status</th>
                <th>Email</th>
                <th>League Player</th>
                <th>Role</th>
                <th>Code</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {auth.identity ? (
                [
                  ['Google OAuth', auth.identity.google],
                  ['Apps Script', auth.identity.appsScript],
                  ['Portal Session', auth.identity.portalSession],
                  ['Player Mapping', auth.identity.playerMapping],
                  ['Firebase Authentication', auth.identity.firebase],
                ].map(([label, stage]) => {
                  const record = stage as {
                    detail: string
                    email: string
                    leaguePlayer: string
                    role: string
                    status: string
                    code?: string
                  }

                  return (
                    <tr key={String(label)}>
                      <td>{String(label)}</td>
                      <td>{record.status}</td>
                      <td>{record.email || 'Not reported'}</td>
                      <td>{record.leaguePlayer || 'Not mapped'}</td>
                      <td>{record.role || 'Not reported'}</td>
                      <td>{record.code || 'Not reported'}</td>
                      <td>{record.detail}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7}>Loading identity synchronization...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="operations-grid two-column">
          <div>
            <h3>Expected Claims</h3>
            <pre className="diagnostics-json">
              {JSON.stringify(auth.identity?.expectedClaims ?? {}, null, 2)}
            </pre>
          </div>
          <div>
            <h3>Firebase Claims</h3>
            <pre className="diagnostics-json">
              {JSON.stringify(auth.identity?.firebase.claims ?? {}, null, 2)}
            </pre>
          </div>
        </div>
        {(auth.identity?.mismatches.length ?? 0) > 0 ? (
          <ul className="operations-list">
            {auth.identity?.mismatches.map((mismatch) => (
              <li key={mismatch}>
                <strong>{mismatch}</strong>
              </li>
            ))}
          </ul>
        ) : null}
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
          <p className="eyebrow">Waterfall</p>
          <h2>API Request Waterfall</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Endpoint</th>
                <th>Cache</th>
                <th>Duration</th>
                <th>Timeline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.apiWaterfall.map((metric) => (
                <tr
                  key={`${metric.action}-${metric.startTimeMs}-${metric.endTimeMs}`}
                >
                  <td>{metric.sequence}</td>
                  <td>{metric.action}</td>
                  <td>{metric.cache}</td>
                  <td>{metric.durationMs} ms</td>
                  <td>{`${metric.startTimeMs.toFixed(0)} → ${metric.endTimeMs.toFixed(0)}`}</td>
                  <td>{metric.ok ? 'OK' : 'Failed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Slowest Function</p>
          <h2>Top API Latency</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Duration</th>
                <th>Cache</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.api.slowest.map((metric) => (
                <tr key={`${metric.action}-${metric.timestamp}`}>
                  <td>{metric.action}</td>
                  <td>{metric.durationMs} ms</td>
                  <td>{metric.cache}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Root Cause</p>
          <h2>Performance Summary</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <tbody>
              <tr>
                <th>Peak API Concurrency</th>
                <td>{snapshot.apiConcurrency}</td>
              </tr>
              <tr>
                <th>Slowest API</th>
                <td>
                  {snapshot.api.slowest.length > 0
                    ? `${snapshot.api.slowest[0].action} (${snapshot.api.slowest[0].durationMs} ms)`
                    : 'None'}
                </td>
              </tr>
              <tr>
                <th>Highest Render Cost</th>
                <td>
                  {snapshot.longestComponentMount
                    ? `${snapshot.longestComponentMount.name} ${snapshot.longestComponentMount.durationMs} ms`
                    : 'None'}
                </td>
              </tr>
              <tr>
                <th>Page Load</th>
                <td>{snapshot.pageLoad} ms</td>
              </tr>
              <tr>
                <th>Time to Interactive</th>
                <td>{snapshot.timeToInteractive} ms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Fix</p>
          <h2>Evidence Only</h2>
        </div>
        <div className="operations-copy">
          <p>
            This report is evidence-only. It highlights the slowest API
            endpoint and the top rendering cost without applying any runtime
            optimizations.
          </p>
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

function PerformanceObservatorySection({
  observatory,
}: {
  observatory: PerformanceObservatorySnapshot
}) {
  return (
    <>
      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Performance Observatory</p>
          <h2>Recommended Next Optimization</h2>
          <p>
            Continuous browser and backend telemetry ranked by user-visible
            impact. This section is read-only and does not optimize runtime
            behavior.
          </p>
        </div>
        <dl className="operations-metrics">
          <Metric
            label="Performance Score"
            value={`${observatory.releaseGate.performanceScore}%`}
          />
          <Metric
            label="Slowest Workflow"
            value={observatory.releaseGate.slowestWorkflow}
          />
          <Metric
            label="Slowest Endpoint"
            value={observatory.releaseGate.slowestEndpoint}
          />
          <Metric
            label="Cache Hit Ratio"
            value={`${observatory.releaseGate.cacheHitRatio}%`}
          />
        </dl>
        <div className="operations-copy">
          <p>
            <strong>{observatory.recommendedNextOptimization.operation}</strong>
            {' '}is the current highest-value target.
          </p>
          <p>
            Cause: {observatory.recommendedNextOptimization.cause}. Recommendation:{' '}
            {observatory.recommendedNextOptimization.recommendation}
          </p>
          <p>
            Expected improvement:{' '}
            {observatory.recommendedNextOptimization.expectedImprovementMs} ms.
          </p>
        </div>
      </section>

      <section className="operations-grid">
        <MetricCard
          label="Startup JS"
          value={formatBytes(observatory.releaseGate.bundleJsBytes)}
        />
        <MetricCard
          label="Startup CSS"
          value={formatBytes(observatory.releaseGate.bundleCssBytes)}
        />
        <MetricCard
          label="API Count"
          value={observatory.releaseGate.apiCount}
        />
        <MetricCard
          label="Startup Requests"
          value={observatory.releaseGate.startupRequests}
        />
        <MetricCard
          label="Duplicate Requests"
          value={observatory.releaseGate.duplicateRequests}
        />
        <MetricCard
          label="Regression"
          value={observatory.regression.summary}
        />
      </section>

      <section className="operations-grid two-column">
        <ObservatoryTable
          columns={['Operation', 'Avg', 'P95', 'Worst', 'Budget', 'Status']}
          eyebrow="Scoreboard"
          rows={observatory.topSlowestOperations.map((operation) => [
            operation.name,
            `${operation.averageMs} ms`,
            `${operation.p95Ms} ms`,
            `${operation.worstMs} ms`,
            `${operation.budgetMs} ms`,
            operation.status,
          ])}
          title="Top Slowest Operations"
        />

        <ObservatoryTable
          columns={['Operation', 'Avg', 'Best', 'Worst', 'Count', 'Status']}
          eyebrow="Budgets"
          rows={observatory.budgetStatus.map((operation) => [
            operation.name,
            `${operation.averageMs} ms`,
            `${operation.bestMs} ms`,
            `${operation.worstMs} ms`,
            operation.count,
            operation.status,
          ])}
          title="Performance Budget Status"
        />
      </section>

      <section className="operations-grid two-column">
        <ObservatoryTable
          columns={['Source', 'Type', 'Count', 'Total', 'Recommendation']}
          eyebrow="Duplicate Work"
          rows={observatory.duplicateWork.map((work) => [
            work.source,
            work.type,
            work.count,
            `${work.totalMs} ms`,
            work.recommendation,
          ])}
          title="Duplicate Work Dashboard"
        />

        <ObservatoryTable
          columns={['Metric', 'Value']}
          eyebrow="Cache"
          rows={[
            ['Hit Ratio', `${observatory.cache.hitRatio}%`],
            ['Hits', observatory.cache.hits],
            ['Misses', observatory.cache.misses],
            ['Shared Requests', observatory.cache.shared],
            ['Invalidation Signals', observatory.cache.invalidations.length],
          ]}
          title="Cache Observatory"
        />
      </section>

      <section className="operations-grid two-column">
        <ObservatoryTable
          columns={['Route', 'Avg', 'P95', 'Worst', 'Count']}
          eyebrow="Routes"
          rows={observatory.routePerformance.slice(0, 12).map((operation) => [
            operation.name,
            `${operation.averageMs} ms`,
            `${operation.p95Ms} ms`,
            `${operation.worstMs} ms`,
            operation.count,
          ])}
          title="Route Performance"
        />

        <ObservatoryTable
          columns={['Endpoint', 'Avg', 'P95', 'Worst', 'Count']}
          eyebrow="APIs"
          rows={observatory.apiPerformance.slice(0, 12).map((operation) => [
            operation.name,
            `${operation.averageMs} ms`,
            `${operation.p95Ms} ms`,
            `${operation.worstMs} ms`,
            operation.count,
          ])}
          title="API Performance"
        />
      </section>

      <section className="operations-grid two-column">
        <ObservatoryTable
          columns={['Endpoint', 'Stage', 'Calls', 'Total', 'Avg', 'Max', '%']}
          eyebrow="Endpoint Profiling"
          rows={observatory.topEndpointStages.slice(0, 16).map((stage) => [
            stage.action,
            stage.stage,
            stage.callCount,
            `${stage.totalMs} ms`,
            `${stage.averageMs} ms`,
            `${stage.maximumMs} ms`,
            `${stage.percentOfEndpoint}%`,
          ])}
          title="Slowest Backend Stages"
        />

        <ObservatoryTable
          columns={['Stage', 'Duration', '%']}
          eyebrow="Waterfall"
          rows={observatory.operationTimeline.map((stage) => [
            stage.name,
            `${stage.durationMs} ms`,
            `${stage.percent}%`,
          ])}
          title="Latest Operation Timeline"
        />
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Historical Trend</p>
          <h2>Last 30 Observatory Snapshots</h2>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Deployment</th>
                <th>Average API</th>
                <th>Cache</th>
                <th>Slowest Workflow</th>
              </tr>
            </thead>
            <tbody>
              {observatory.historicalTrend.slice(-10).map((entry) => (
                <tr key={`${entry.deploymentId}-${entry.generatedAt}`}>
                  <td>{entry.generatedAt}</td>
                  <td>{entry.deploymentId || 'local'}</td>
                  <td>{entry.averageApiMs} ms</td>
                  <td>{entry.cacheHitRatio}%</td>
                  <td>
                    {entry.slowestWorkflow} {entry.slowestWorkflowMs} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function ObservatoryTable({
  columns,
  eyebrow,
  rows,
  title,
}: {
  columns: string[]
  eyebrow: string
  rows: Array<Array<number | string>>
  title: string
}) {
  return (
    <section className="panel operations-panel">
      <div className="panel-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="operations-table-wrap">
        <table className="operations-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>No telemetry captured yet.</td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
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
