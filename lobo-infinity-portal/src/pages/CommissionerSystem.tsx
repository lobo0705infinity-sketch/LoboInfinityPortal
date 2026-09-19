import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import { apiClient } from '../services/api'
import { getPageAnalytics, type PageAnalyticsReportRow } from '../services/lightApi'

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
    body: 'Review Army Codes that failed validation or need commissioner override.',
    label: 'Army Code Validation',
    to: '/commissioner/army-code-validation',
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

const emergencyWorkflows = [
  {
    body: 'Inspect Operations Engine status, queue history, cache state, and failed background work before incident response.',
    label: 'Operations Recovery',
    to: '/commissioner?section=operations',
  },
  {
    body: 'Use break-glass rebuild, standings, cache, and repair controls only during production recovery.',
    label: 'Emergency Recovery',
    to: '/integrity',
  },
  {
    body: 'Review automation queues, retries, failed jobs, and background operation history.',
    label: 'Automation Queue Recovery',
    to: '/commissioner/automation',
  },
  {
    body: 'Recover search indexing and verify searchable player records only during directed incident work.',
    label: 'Search Index Recovery',
    to: '/diagnostics',
  },
]

function CommissionerSystem() {
  const auth = useAuth()
  const location = useLocation()
  const showLegacyTools = new URLSearchParams(location.search).get('legacy') === '1'
  const [refreshingArmyIntelligence, setRefreshingArmyIntelligence] = useState(false)
  const [armyIntelligenceMessage, setArmyIntelligenceMessage] = useState('')
  const [pageAnalytics, setPageAnalytics] = useState<PageAnalyticsReportRow[]>([])
  const [pageAnalyticsError, setPageAnalyticsError] = useState('')
  const [pageAnalyticsLoading, setPageAnalyticsLoading] = useState(true)
  const canViewPageAnalytics = auth.hasPermission('manageSettings')

  useEffect(() => {
    if (auth.status !== 'ready' || !auth.authenticated || !canViewPageAnalytics || !showLegacyTools) return

    let active = true

    void getPageAnalytics()
      .then((pages) => {
        if (active) setPageAnalytics(pages)
      })
      .catch(() => {
        if (active) setPageAnalyticsError('Page analytics are temporarily unavailable.')
      })
      .finally(() => {
        if (active) setPageAnalyticsLoading(false)
      })

    return () => { active = false }
  }, [auth.authenticated, auth.status, canViewPageAnalytics])

  async function refreshArmyIntelligence() {
    setRefreshingArmyIntelligence(true)
    setArmyIntelligenceMessage('')

    try {
      const processedSnapshotKeys: string[] = []
      let decoded = 0
      let failed = 0

      while (true) {
        const result = await apiClient.refreshArmyIntelligenceSnapshots({
          batchLimit: 4,
          excludeSnapshotKeys: processedSnapshotKeys,
        })

        decoded += result.decoded
        failed += result.failed
        processedSnapshotKeys.push(...result.processed.map((item) => item.snapshotKey))

        if (!result.hasMore) break
      }

      const intelligence = await apiClient.getArmyIntelligence()
      const sectorials = intelligence.summary.sectorials.length
      const processed = decoded + failed
      setArmyIntelligenceMessage(
        `Army Intelligence refreshed: ${processed} processed, ${decoded} decoded, ${failed} failed, ${sectorials} sectorials.`,
      )
    } catch (error) {
      setArmyIntelligenceMessage(
        error instanceof Error ? error.message : 'Army Intelligence refresh failed.',
      )
    } finally {
      setRefreshingArmyIntelligence(false)
    }
  }

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
            account to inspect system health and recovery tools.
          </p>
        </section>
      </main>
    )
  }

  if (!showLegacyTools) {
    return (
      <main className="portal-shell">
        <section className="page-header" aria-labelledby="commissioner-system-title">
          <p className="eyebrow">Commissioner</p>
          <h1 id="commissioner-system-title">System & Recovery</h1>
          <p>Read-only operating status and exceptional recovery tools. Routine maintenance remains automated.</p>
        </section>

        <section className="operations-grid" aria-label="System status and recovery">
          <Link className="panel operations-panel" to="/commissioner/system/audit">
            <p className="eyebrow">Status</p>
            <h2>Integrity</h2>
            <p className="operations-empty">Review League health, audit findings, and the approved break-glass repair actions.</p>
          </Link>
          <Link className="panel operations-panel" to="/commissioner?section=operations">
            <p className="eyebrow">Status</p>
            <h2>Operations Engine</h2>
            <p className="operations-empty">Inspect scheduled work, failures, queue state, and recent operation history.</p>
          </Link>
          <Link className="panel operations-panel" to="/commissioner/automation">
            <p className="eyebrow">Recovery</p>
            <h2>Automation Queue</h2>
            <p className="operations-empty">Review and recover failed automation work only when normal processing needs intervention.</p>
          </Link>
        </section>

        {auth.isAtLeastRole('Commissioner') ? (
          <section className="panel operations-panel emergency-recovery-panel" aria-labelledby="army-intelligence-refresh-title">
            <div className="panel-heading">
              <p className="eyebrow">Recovery / Advanced</p>
              <h2 id="army-intelligence-refresh-title">Army Intelligence Refresh</h2>
              <p>Use only when the scheduled refresh cannot recover current authoritative Army List intelligence.</p>
            </div>
            <div className="operations-actions">
              <button
                disabled={refreshingArmyIntelligence}
                onClick={() => void refreshArmyIntelligence()}
                type="button"
              >
                {refreshingArmyIntelligence ? 'Refreshing Army Intelligence...' : 'Refresh Army Intelligence'}
              </button>
            </div>
            {armyIntelligenceMessage ? (
              <p className="operations-feedback" role="status">{armyIntelligenceMessage}</p>
            ) : null}
          </section>
        ) : null}
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="commissioner-system-title">
        <p className="eyebrow">Commissioner</p>
        <h1 id="commissioner-system-title">System</h1>
        <p>
          Health, audit, diagnostics, queue, version, deployment, and recovery
          tools grouped away from daily league operations.
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
          <p className="eyebrow">Emergency / Recovery</p>
          <h2>Break-Glass Tools</h2>
          <p>
            Routine maintenance is automatic through the Operations Engine.
            These links are for recovery, diagnostics, and directed incident work.
          </p>
        </div>
        <div className="operations-stack">
          {emergencyWorkflows.map((workflow) => (
            <Link className="operations-record warning" key={workflow.label} to={workflow.to}>
              <span>Emergency / Recovery</span>
              <h3>{workflow.label}</h3>
              <p>{workflow.body}</p>
            </Link>
          ))}
        </div>
        <div className="operations-actions wrap">
          <Link to="/integrity">Open Audit</Link>
          <Link to="/diagnostics">Open Diagnostics</Link>
          <Link to="/commissioner/army-code-validation">Open Army Code Validation</Link>
          <Link to="/commissioner?section=operations">Open Operations Status</Link>
          <Link to="/commissioner/automation">Open Queue Recovery</Link>
        </div>
      </section>

      {canViewPageAnalytics ? (
        <section className="panel operations-panel" aria-labelledby="page-analytics-title">
          <div className="panel-heading">
            <p className="eyebrow">Portal Usage</p>
            <h2 id="page-analytics-title">Page Views</h2>
            <p>Anonymous community page views since tracking was enabled. Commissioner traffic is excluded.</p>
          </div>
          {pageAnalyticsLoading ? <Loading /> : null}
          {pageAnalyticsError ? <p className="operations-feedback" role="alert">{pageAnalyticsError}</p> : null}
          {!pageAnalyticsLoading && !pageAnalyticsError ? (
            <div className="standings-table page-analytics-table" role="table" aria-label="Page view counts">
              <div className="table-row table-head" role="row">
                <span role="columnheader">Page</span>
                <span role="columnheader">7 Days</span>
                <span role="columnheader">30 Days</span>
                <span role="columnheader">All Time</span>
              </div>
              {pageAnalytics.map((page) => (
                <div className="table-row" key={page.pageKey} role="row">
                  <strong role="cell">{page.displayName}</strong>
                  <span role="cell">{page.last7Days.toLocaleString()}</span>
                  <span role="cell">{page.last30Days.toLocaleString()}</span>
                  <span role="cell">{page.allTime.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {auth.isAtLeastRole('Commissioner') ? (
        <section className="panel operations-panel" aria-labelledby="army-intelligence-refresh-title">
          <div className="panel-heading">
            <p className="eyebrow">Army Intelligence</p>
            <h2 id="army-intelligence-refresh-title">Decoded Snapshot Maintenance</h2>
            <p>Decode authoritative Army Codes and rebuild the persisted Army Intelligence read model.</p>
          </div>
          <div className="operations-actions">
            <button
              disabled={refreshingArmyIntelligence}
              onClick={() => void refreshArmyIntelligence()}
              type="button"
            >
              {refreshingArmyIntelligence ? 'Refreshing Army Intelligence...' : 'Refresh Army Intelligence'}
            </button>
          </div>
          {armyIntelligenceMessage ? (
            <p className="operations-feedback" role="status">{armyIntelligenceMessage}</p>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

export default CommissionerSystem
