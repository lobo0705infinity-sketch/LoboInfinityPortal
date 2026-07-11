import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import StandingsTable from '../components/StandingsTable'
import StatCard from '../components/StatCard'
import { getEventNavigationConfig } from '../config/eventNavigation'
import { standingsRepository } from '../services/data'
import { recordStandingsDiagnostic } from '../services/diagnostics'
import { formatPlayerName } from '../services/formatting'
import type {
  DivisionKey,
  DivisionStandings,
  Standing,
} from '../types/dashboard'
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
  const [searchParams] = useSearchParams()
  const requestedEventId = searchParams.get('eventId') || ''
  const [activeDivision, setActiveDivision] = useState<DivisionKey>('main')
  const activeEventId = requestedEventId || 'event-current-league'
  const [standingsState, setStandingsState] = useState<StandingsState>({
    status: 'idle',
  })

  useEffect(() => {
    const mountedAt = performance.now()
    recordStandingsDiagnostic({
      event: 'componentMount',
    })

    return () => {
      recordStandingsDiagnostic({
        durationMs: Math.round(performance.now() - mountedAt),
        event: 'componentUnmount',
      })
    }
  }, [])

  useEffect(() => {
    recordStandingsDiagnostic({
      activeDivision,
      activeEventId,
      event: 'render',
      eventCount: 0,
      standingsStatus: standingsState.status,
      standingsRecords:
        standingsState.status === 'success'
          ? standingsState.data.standings.length
          : 0,
    })
  })

  useEffect(() => {
    recordStandingsDiagnostic({
      activeEventId: requestedEventId || 'event-current-league',
      event: 'eventContextResolved',
    })
  }, [requestedEventId])

  useEffect(() => {
    const controller = new AbortController()
    const startedAt = performance.now()

    const selectedEvent = getEventNavigationConfig(activeEventId)

    if (selectedEvent && selectedEvent.type !== 'League') {
      recordStandingsDiagnostic({
        activeDivision,
        activeEventId,
        event: 'standingsRequestSkipped',
        reason: 'non_league_event',
        selectedEventType: selectedEvent.type,
      })
      return () => {
        controller.abort()
      }
    }

    recordStandingsDiagnostic({
      activeDivision,
      activeEventId,
      event: 'standingsRequestStarted',
      selectedEventType: selectedEvent?.type ?? 'unknown',
    })

    standingsRepository
      .getStandings(activeDivision, {
        eventId: activeEventId,
        signal: controller.signal,
      })
      .then((data) => {
        recordStandingsDiagnostic({
          activeDivision,
          activeEventId,
          durationMs: Math.round(performance.now() - startedAt),
          event: 'standingsRepositoryTransformComplete',
          recordCount: data.standings.length,
          summary: data.summary,
        })
        setStandingsState({
          data,
          division: activeDivision,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) {
          recordStandingsDiagnostic({
            activeDivision,
            activeEventId,
            durationMs: Math.round(performance.now() - startedAt),
            event: 'standingsRequestAborted',
            reason: controller.signal.aborted
              ? 'controller_aborted'
              : 'abort_error',
          })
          return
        }

        recordStandingsDiagnostic({
          activeDivision,
          activeEventId,
          durationMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error),
          event: 'standingsRequestError',
        })
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
  }, [activeDivision, activeEventId])

  const activeEvent =
    getEventNavigationConfig(activeEventId)

  const activeEventLabel =
    activeEventId === 'lifetime'
      ? 'Lifetime'
      : activeEventId === 'all'
        ? 'All Events'
        : activeEvent?.label ?? 'Current League'

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="standings-page-title">
        <p className="eyebrow">Standings</p>
        <h1 id="standings-page-title">Standings</h1>
        <p>
          {activeEventLabel} Rankings
        </p>
      </section>

      {activeEvent && activeEvent.type !== 'League' ? (
        <NonLeagueStandingsRedirect event={activeEvent} />
      ) : (
        <>
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
        standingsState={standingsState}
      />
        </>
      )}
    </main>
  )
}

function NonLeagueStandingsRedirect({
  event,
}: {
  event: NonNullable<ReturnType<typeof getEventNavigationConfig>>
}) {
  const isTeamTournament = event.type === 'Team Tournament'

  return (
    <section className="panel standings-panel">
      <div className="panel-heading">
        <p className="eyebrow">{event.type}</p>
        <h2>{event.label}</h2>
      </div>
      <p>
        This Event does not use league divisions, promotion, or relegation.
        Open the purpose-built Event experience for standings and operations.
      </p>
      <Link
        className="event-home-primary-action"
        to={
          isTeamTournament
            ? `/event/${encodeURIComponent(event.id)}`
            : `/event/${encodeURIComponent(event.id)}`
        }
      >
        Open {isTeamTournament ? 'Team Tournament' : 'Event'} Experience
      </Link>
    </section>
  )
}

function DivisionPanel({
  activeDivision,
  standingsState,
}: {
  activeDivision: DivisionKey
  standingsState: StandingsState
}) {
  const isCurrent =
    standingsState.status !== 'idle' && standingsState.division === activeDivision

  if (!isCurrent || standingsState.status === 'loading') {
    return (
      <>
        <section className="league-stats" aria-label="Standings summary loading">
          <Skeleton label="Standings leader loading" rows={4} />
          <Skeleton label="Standings games loading" rows={4} />
          <Skeleton label="Standings players loading" rows={4} />
          <Skeleton label="Standings rate loading" rows={4} />
        </section>
        <section className="panel standings-panel" aria-label="Standings table loading">
          <div className="panel-heading">
            <p className="eyebrow">{formatDivisionLabel(activeDivision)}</p>
            <h2>Division Table</h2>
          </div>
          <Skeleton label="Standings rows loading" rows={10} />
        </section>
      </>
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
          ariaLabel={`${standingsState.data.divisionLabel} standings`}
          getRowClassName={(standing, totalRows) =>
            getStandingRowClassName(
              standing,
              totalRows,
              standingsState.data.division,
            )
          }
          standings={standings}
        />
      </section>
    </section>
    </>
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

function getStandingRowClassName(
  standing: Standing,
  totalRows: number,
  division: DivisionKey,
) {
  const classes = []

  if (division === 'main') {
    classes.push(
      standing.rank <= Math.max(0, totalRows - 2)
        ? 'standings-zone-safe'
        : 'standings-zone-relegation',
    )
  } else if (standing.rank <= 2) {
    classes.push('standings-zone-safe')
  } else if (standing.rank > Math.max(0, totalRows - 2)) {
    classes.push('standings-zone-relegation')
  }

  return classes.join(' ')
}

export default Standings

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  if (error instanceof Error) {
    return (
      error.name === 'AbortError' ||
      error.message === 'signal is aborted without reason'
    )
  }

  return String(error) === 'signal is aborted without reason'
}
