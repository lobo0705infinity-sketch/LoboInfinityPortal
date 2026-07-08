import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import StandingsTable from '../components/StandingsTable'
import StatCard from '../components/StatCard'
import { apiClient } from '../services/api'
import { formatPlayerName } from '../services/formatting'
import {
  collectAuthenticatedStandingsDebugReport,
  publishStandingsDiagnostics,
  setFirstStandingsRowPaintDiagnostic,
  type AuthenticatedStandingsDebugReport,
} from '../services/standingsDiagnostics'
import type { DivisionKey, DivisionStandings } from '../types/dashboard'
import {
  formatDivisionLabel,
  getDivisionIdentity,
  getDivisionStyle,
} from '../utils/divisions'
import './Standings.css'

const divisions: Array<{
  id: DivisionKey
}> = [
  {
    id: 'main',
  },
  {
    id: 'pga',
  },
  {
    id: 'pgb',
  },
]

type StandingsState =
  | {
      status: 'idle'
    }
  | {
      division: DivisionKey
      status: 'loading'
    }
  | {
      data: DivisionStandings
      division: DivisionKey
      status: 'success'
    }
  | {
      division: DivisionKey
      error: string
      status: 'error'
    }

function Standings() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const [activeDivision, setActiveDivision] = useState<DivisionKey>('main')
  const [standingsState, setStandingsState] = useState<StandingsState>({
    status: 'idle',
  })
  const debugEnabled =
    searchParams.get('debug') === 'standings' && auth.isAtLeastRole('Commissioner')

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getStandings(activeDivision, {
        signal: controller.signal,
      })
      .then((data) => {
        setStandingsState({
          data,
          division: activeDivision,
          status: 'success',
        })
        publishStandingsDiagnostics({
          apiStandings: data.standings,
          division: activeDivision,
          reactStateStandings: data.standings,
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setStandingsState({
          division: activeDivision,
          error:
            error instanceof Error
              ? error.message
              : 'Standings data could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [activeDivision])

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="standings-page-title">
        <p className="eyebrow">Standings</p>
        <h1 id="standings-page-title">Standings</h1>
        <p>Current League Rankings</p>
      </section>

      <section className="division-tabs" aria-label="Standings divisions">
        {divisions.map((division) => {
          const identity = getDivisionIdentity(division.id)

          return (
            <button
              className={
                activeDivision === division.id
                  ? 'division-tab active'
                  : 'division-tab'
              }
              key={division.id}
              onClick={() => setActiveDivision(division.id)}
              style={getDivisionStyle(division.id)}
              type="button"
            >
              {identity.icon} {identity.label}
            </button>
          )
        })}
      </section>

      <DivisionPanel
        activeDivision={activeDivision}
        debugEnabled={debugEnabled}
        standingsState={standingsState}
      />
    </main>
  )
}

function DivisionPanel({
  activeDivision,
  debugEnabled,
  standingsState,
}: {
  activeDivision: DivisionKey
  debugEnabled: boolean
  standingsState: StandingsState
}) {
  const isCurrent =
    standingsState.status !== 'idle' && standingsState.division === activeDivision

  if (!isCurrent || standingsState.status === 'loading') {
    return (
      <section className="dashboard-state" aria-label="Standings loading">
        <Loading />
      </section>
    )
  }

  if (standingsState.status === 'error') {
    return (
      <section className="dashboard-state" aria-label="Standings error">
        <p role="alert">{standingsState.error}</p>
      </section>
    )
  }

  const standings = standingsState.data.standings
  const leader = standings[0] ?? null

  return (
    <>
      <section
        className="league-stats"
        aria-label={`${standingsState.data.divisionLabel} summary`}
      >
        <StatCard
          icon={getDivisionIdentity(standingsState.data.division).icon}
          label="League Leader"
          subtitle="Current Leader"
          value={
            leader
              ? formatPlayerName(
                  leader.player,
                  leader.displayName,
                )
              : 'None'
          }
        />
        <StatCard
          icon="G"
          label="Total Games"
          subtitle="Completed Games"
          value={standingsState.data.summary.gamesPlayed}
        />
        <StatCard
          icon="P"
          label="Players"
          subtitle="Active Roster"
          value={standingsState.data.summary.players}
        />
        <StatCard
          icon="A"
          label="Reporting"
          subtitle="Players With Games"
          value={standingsState.data.summary.activePlayers}
        />
      </section>

      <section className="standings-hub-grid">
        <section
          className="panel standings-panel"
          aria-labelledby="division-standings-title"
          style={getDivisionStyle(standingsState.data.division)}
        >
          <div className="panel-heading standings-panel-heading">
            <div>
              <p className="eyebrow">Standings</p>
              <h2 id="division-standings-title">
                {formatDivisionLabel(standingsState.data.division)}
              </h2>
            </div>
            <MovementLegend division={standingsState.data.division} />
          </div>

          <StandingsTable
            division={standingsState.data.division}
            standings={standings}
            showMovementZones
          />
        </section>
      </section>

      {debugEnabled ? <StandingsDebugPanel /> : null}
    </>
  )
}

function StandingsDebugPanel() {
  const [copied, setCopied] = useState(false)
  const [paintApplied, setPaintApplied] = useState(false)
  const [report, setReport] =
    useState<AuthenticatedStandingsDebugReport | null>(null)

  function captureReport(nextPaintApplied = paintApplied) {
    setReport(collectAuthenticatedStandingsDebugReport(nextPaintApplied))
    setCopied(false)
  }

  function togglePaintDiagnostic() {
    const nextPaintApplied = !paintApplied
    setFirstStandingsRowPaintDiagnostic(nextPaintApplied)
    setPaintApplied(nextPaintApplied)
    captureReport(nextPaintApplied)
  }

  async function copyDiagnostics() {
    const nextReport =
      report ?? collectAuthenticatedStandingsDebugReport(paintApplied)
    setReport(nextReport)
    await navigator.clipboard.writeText(JSON.stringify(nextReport, null, 2))
    setCopied(true)
  }

  return (
    <section className="panel standings-debug-panel">
      <div className="panel-heading standings-panel-heading">
        <div>
          <p className="eyebrow">Commissioner Debug</p>
          <h2>Standings Browser Diagnostics</h2>
          <p>
            Runtime capture from this authenticated browser session. This panel
            is visible only to Commissioners using <code>?debug=standings</code>.
          </p>
        </div>
        <div className="standings-debug-actions">
          <button onClick={() => captureReport()} type="button">
            Capture Runtime Diagnostics
          </button>
          <button onClick={togglePaintDiagnostic} type="button">
            {paintApplied ? 'Remove Paint Test' : 'Apply Paint Test'}
          </button>
          <button onClick={() => void copyDiagnostics()} type="button">
            {copied ? 'Copied' : 'Copy Standings Diagnostics'}
          </button>
        </div>
      </div>

      {report ? (
        <div className="standings-debug-grid">
          <DebugBlock title="Build Verification" value={report.build} />
          <DebugBlock title="API Response" value={report.pipeline?.api ?? null} />
          <DebugBlock
            title="React State"
            value={report.pipeline?.reactState ?? null}
          />
          <DebugBlock
            title="StandingsTable Props"
            value={report.pipeline?.tableProps ?? null}
          />
          <DebugBlock
            title="Rendered DOM Rows"
            value={report.pipeline?.renderedDom ?? null}
          />
          <DebugBlock
            title="First Row DOM Inspection"
            value={report.firstRowInspection}
          />
          <DebugBlock title="Cell Inspection" value={report.cellInspection} />
          <DebugBlock title="Ancestor Inspection" value={report.ancestorInspection} />
          <DebugBlock title="Paint Verification" value={report.paintInspection} />
          <DebugBlock title="Loaded Assets" value={report.pipeline?.assets ?? null} />
        </div>
      ) : (
        <p>
          Click Capture Runtime Diagnostics after the standings table finishes
          rendering.
        </p>
      )}
    </section>
  )
}

function DebugBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <article className="standings-debug-card">
      <h3>{title}</h3>
      <pre className="diagnostics-json">{JSON.stringify(value, null, 2)}</pre>
    </article>
  )
}

function MovementLegend({ division }: { division: DivisionKey }) {
  const greenLabel = division === 'main' ? 'Safe' : 'Promotion'

  return (
    <dl className="movement-legend" aria-label="Promotion and relegation legend">
      <div>
        <dt className="legend-dot legend-safe" aria-label={greenLabel} />
        <dd>{greenLabel}</dd>
      </div>
      <div>
        <dt className="legend-dot legend-relegation" aria-label="Relegation" />
        <dd>Relegation</dd>
      </div>
    </dl>
  )
}

export default Standings
