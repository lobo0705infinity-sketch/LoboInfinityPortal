import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type FlaggedArmySubmission,
  type FlaggedArmySubmissionsData,
} from '../services/api'
import { formatPlayerName } from '../services/formatting'

type ValidationState =
  | { status: 'loading' }
  | { data: FlaggedArmySubmissionsData; status: 'success' }
  | { error: string; status: 'error' }

function ArmyCodeValidation() {
  const [state, setState] = useState<ValidationState>({ status: 'loading' })
  const [eventFilter, setEventFilter] = useState('all')
  const [playerFilter, setPlayerFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [warningFilter, setWarningFilter] = useState('all')

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getFlaggedArmySubmissions({}, { signal: controller.signal })
      .then((data) => {
        setState({ data, status: 'success' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Flagged army submissions could not be loaded.',
          status: 'error',
        })
      })

    return () => controller.abort()
  }, [])

  const visible = useMemo(() => {
    if (state.status !== 'success') {
      return []
    }

    return state.data.submissions
      .filter((submission) => eventFilter === 'all' || submission.event === eventFilter)
      .filter((submission) => playerFilter === 'all' || submission.player === playerFilter)
      .filter((submission) => severityFilter === 'all' || submission.validationStatus.toLowerCase() === severityFilter.toLowerCase())
      .filter((submission) =>
        warningFilter === 'all' ||
        submission.validationWarnings.some((warning) => warning === warningFilter),
      )
  }, [eventFilter, playerFilter, severityFilter, state, warningFilter])

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <Skeleton label="Flagged army submissions loading" rows={8} />
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Army validation error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />

      <section className="army-validation-summary-grid" aria-label="Army validation summary">
        <MetricCard label="Total Lists" value={state.data.summary.counts.total} />
        <MetricCard label="Healthy" value={state.data.summary.counts.healthy} />
        <MetricCard label="Warnings" value={state.data.summary.counts.warnings} />
        <MetricCard label="Errors" value={state.data.summary.counts.errors} />
      </section>

      <section className="army-list-controls" aria-label="Army validation filters">
        <FilterSelect label="Event" onChange={setEventFilter} options={state.data.summary.events} value={eventFilter} />
        <FilterSelect label="Player" onChange={setPlayerFilter} options={state.data.summary.players} value={playerFilter} />
        <FilterSelect label="Severity" onChange={setSeverityFilter} options={['Error', 'Warning']} value={severityFilter} />
        <FilterSelect label="Warning" onChange={setWarningFilter} options={state.data.summary.warningTypes} value={warningFilter} />
      </section>

      {visible.length === 0 ? (
        <section className="dashboard-state" aria-label="No flagged armies">
          <p>No flagged army submissions match the current filters.</p>
        </section>
      ) : (
        <section className="army-validation-table panel" aria-label="Flagged army submissions">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Event</th>
                <th>Points</th>
                <th>Models</th>
                <th>Severity</th>
                <th>Submitted</th>
                <th>Warnings</th>
                <th>Army Intelligence</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((submission) => (
                <FlaggedArmyRow key={submission.id} submission={submission} />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="army-code-validation-title">
      <p className="eyebrow">Commissioner</p>
      <h1 id="army-code-validation-title">Army Code Validation</h1>
      <p>Review submitted Army Codes that failed or triggered configurable validation warnings.</p>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="panel army-validation-metric">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
    </section>
  )
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: string[]
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function FlaggedArmyRow({ submission }: { submission: FlaggedArmySubmission }) {
  return (
    <tr>
      <td>{formatPlayerName(submission.player, submission.playerDisplayName)}</td>
      <td>{submission.event || 'Not recorded'}</td>
      <td>{submission.points}</td>
      <td>{submission.unitCount}</td>
      <td>{submission.validationStatus || 'warning'}</td>
      <td>{submission.submitted || 'Not recorded'}</td>
      <td>
        <ul className="army-validation-warning-list">
          {submission.validationWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </td>
      <td>
        <Link to={submission.armyIntelligenceLink || '/army-lists'}>
          Open
        </Link>
      </td>
    </tr>
  )
}

export default ArmyCodeValidation
