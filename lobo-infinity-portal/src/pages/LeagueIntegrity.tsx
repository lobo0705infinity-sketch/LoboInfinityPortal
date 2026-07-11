import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type IntegrityData,
  type IntegrityIssue,
  type IntegritySection,
} from '../services/api'

type IntegrityState =
  | {
      status: 'loading'
    }
  | {
      data: IntegrityData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function LeagueIntegrity() {
  const auth = useAuth()
  const [state, setState] = useState<IntegrityState>({ status: 'loading' })
  const [expanded, setExpanded] = useState<string[]>([])
  const [workingAction, setWorkingAction] = useState('')

  const canView = auth.isAtLeastRole('Assistant Commissioner')
  const canRepair = auth.hasPermission('runLeagueAudit')

  async function loadIntegrity(signal?: AbortSignal) {
    try {
      const data = await apiClient.getIntegrity({ signal })
      setState({ data, status: 'success' })
    } catch (error) {
      if (!signal?.aborted) {
        setState({
          error:
            error instanceof Error
              ? error.message
              : 'League integrity could not be loaded.',
          status: 'error',
        })
      }
    }
  }

  useEffect(() => {
    if (!canView) {
      return
    }

    const controller = new AbortController()
    void Promise.resolve().then(() => loadIntegrity(controller.signal))

    return () => {
      controller.abort()
    }
  }, [canView])

  async function runRepair(repair: string) {
    if (!canRepair) {
      return
    }

    setWorkingAction(repair)
    try {
      const data = await apiClient.repairIntegrity(repair)
      setState({ data, status: 'success' })
    } finally {
      setWorkingAction('')
    }
  }

  async function runFreshAudit() {
    if (!canRepair) {
      return
    }

    setWorkingAction('fresh-audit')
    try {
      const data = await apiClient.getIntegrityFreshAudit()
      setState({ data, status: 'success' })
    } finally {
      setWorkingAction('')
    }
  }

  async function exportReport() {
    const report = await apiClient.getIntegrityReport()
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `league-integrity-${report.timestamp.replace(/[: ]/g, '-')}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function toggleSection(sectionId: string) {
    setExpanded((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    )
  }

  if (!canView) {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="panel operations-access-card">
          <p className="eyebrow">League Integrity</p>
          <h2>Authorized League Staff Only</h2>
          <p>
            Assistant Commissioners may view league health. Commissioners may
            run repairs.
          </p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="operations-grid" aria-label="Integrity loading">
          <Skeleton label="Integrity health loading" rows={6} />
          <Skeleton label="Integrity actions loading" rows={5} />
          <Skeleton label="Integrity checks loading" rows={8} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Integrity error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />
      <HealthOverview data={state.data} />
      <IntegrityActions
        canRepair={canRepair}
        onAudit={() => void runFreshAudit()}
        onExport={() => void exportReport()}
        onRepair={(repair) => void runRepair(repair)}
        workingAction={workingAction}
      />
      <section className="operations-grid" aria-label="Integrity audit sections">
        {state.data.sections.map((section) => (
          <IntegritySectionCard
            canRepair={canRepair}
            expanded={expanded.includes(section.id)}
            key={section.id}
            onRepair={(repair) => void runRepair(repair)}
            onToggle={() => toggleSection(section.id)}
            section={section}
            workingAction={workingAction}
          />
        ))}
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="integrity-title">
      <p className="eyebrow">Commissioner Operations</p>
      <h1 id="integrity-title">League Integrity System</h1>
      <p>Self-monitoring health checks, repair actions, and audit reports.</p>
    </section>
  )
}

function HealthOverview({ data }: { data: IntegrityData }) {
  const tone = getHealthTone(data.healthStatus)

  return (
    <section className={`panel operations-panel integrity-hero ${tone}`}>
      <div className="panel-heading">
        <p className="eyebrow">League Health</p>
        <h2>{data.healthScore}%</h2>
      </div>
      <dl className="operations-metrics">
        <Metric label="Overall" value={data.healthStatus} />
        <Metric label="Errors" value={data.summary.errors} />
        <Metric label="Warnings" value={data.summary.warnings} />
        <Metric label="Repairable" value={data.summary.repairable} />
        <Metric label="Last Audit" value={formatTimestamp(data.timestamp)} />
        <Metric label="Last Repair" value={formatTimestamp(data.lastRepair)} />
      </dl>
    </section>
  )
}

function IntegrityActions({
  canRepair,
  onAudit,
  onExport,
  onRepair,
  workingAction,
}: {
  canRepair: boolean
  onAudit: () => void
  onExport: () => void
  onRepair: (repair: string) => void
  workingAction: string
}) {
  const disabled = workingAction !== ''

  return (
    <section className="panel operations-panel">
      <div className="operations-actions wrap">
        <button disabled={!canRepair || disabled} onClick={onAudit} type="button">
          Run Fresh Audit
        </button>
        <button
          disabled={!canRepair || disabled}
          onClick={() => onRepair('safe')}
          type="button"
        >
          Repair All Safe Issues
        </button>
        <button
          disabled={!canRepair || disabled}
          onClick={() => onRepair('statistics')}
          type="button"
        >
          Rebuild Statistics
        </button>
        <button
          disabled={!canRepair || disabled}
          onClick={() => onRepair('standings')}
          type="button"
        >
          Rebuild Standings
        </button>
        <button
          disabled={!canRepair || disabled}
          onClick={() => onRepair('cache')}
          type="button"
        >
          Refresh Cache
        </button>
        <button disabled={disabled} onClick={onExport} type="button">
          Export Audit Report
        </button>
      </div>
    </section>
  )
}

function IntegritySectionCard({
  canRepair,
  expanded,
  onRepair,
  onToggle,
  section,
  workingAction,
}: {
  canRepair: boolean
  expanded: boolean
  onRepair: (repair: string) => void
  onToggle: () => void
  section: IntegritySection
  workingAction: string
}) {
  const topIssues = useMemo(
    () => section.issues.slice(0, expanded ? section.issues.length : 3),
    [expanded, section.issues],
  )

  return (
    <article className={`panel operations-panel ${section.status.toLowerCase()}`}>
      <button
        className="integrity-card-button"
        onClick={onToggle}
        type="button"
      >
        <span className="eyebrow">{section.title}</span>
        <strong>{section.status}</strong>
        <small>
          {section.errors} Errors / {section.warnings} Warnings
        </small>
      </button>

      {expanded ? (
        <div className="operations-stack">
          <p className="operations-empty">{section.description}</p>
          {section.checks.map((check) => (
            <article className="operations-record" key={`${section.id}-${check.target}`}>
              <span>{check.status}</span>
              <h3>{check.target}</h3>
              <p>{check.detail}</p>
            </article>
          ))}
          {topIssues.map((issue) => (
            <IntegrityIssueRow
              canRepair={canRepair}
              issue={issue}
              key={issue.id}
              onRepair={onRepair}
              workingAction={workingAction}
            />
          ))}
          {section.issues.length === 0 ? (
            <p className="operations-empty">No integrity issues detected.</p>
          ) : null}
          {section.repairable ? (
            <div className="operations-actions">
              <button
                disabled={!canRepair || workingAction !== ''}
                onClick={() => onRepair(section.repairAction)}
                type="button"
              >
                Repair {section.title}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function IntegrityIssueRow({
  canRepair,
  issue,
  onRepair,
  workingAction,
}: {
  canRepair: boolean
  issue: IntegrityIssue
  onRepair: (repair: string) => void
  workingAction: string
}) {
  return (
    <article className={`operations-record ${issue.severity}`}>
      <span>{issue.severity}</span>
      <h3>{issue.target}</h3>
      <p>{issue.title}: {issue.detail}</p>
      {issue.repairable ? (
        <div className="operations-actions">
          <button
            disabled={!canRepair || workingAction !== ''}
            onClick={() => onRepair(issue.repairAction)}
            type="button"
          >
            Repair
          </button>
        </div>
      ) : null}
    </article>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function getHealthTone(status: string) {
  if (status === 'Green') {
    return 'healthy'
  }

  if (status === 'Yellow') {
    return 'warning'
  }

  return 'error'
}

function formatTimestamp(value: string) {
  if (!value || value === 'Never') {
    return 'Never'
  }

  const parsed = new Date(value.replace(' ', 'T'))

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default LeagueIntegrity
