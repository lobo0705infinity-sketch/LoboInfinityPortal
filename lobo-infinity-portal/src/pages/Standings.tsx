import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import StandingsTable from '../components/StandingsTable'
import StatCard from '../components/StatCard'
import { eventRepository, standingsRepository } from '../services/data'
import { formatPlayerName } from '../services/formatting'
import type {
  DivisionKey,
  DivisionStandings,
  EventCatalog,
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
  const [activeDivision, setActiveDivision] = useState<DivisionKey>('main')
  const [eventCatalog, setEventCatalog] = useState<EventCatalog | null>(null)
  const [activeEventId, setActiveEventId] = useState('event-current-league')
  const [standingsState, setStandingsState] = useState<StandingsState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    eventRepository
      .getEvents({ signal: controller.signal })
      .then((catalog) => {
        setEventCatalog(catalog)
        setActiveEventId(catalog.currentEvent.id || 'event-current-league')
      })
      .catch(() => {
        setEventCatalog(null)
      })

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const selectedEvent = eventCatalog?.events.find(
      (event) => event.id === activeEventId,
    )

    if (selectedEvent && selectedEvent.type !== 'League') {
      return () => {
        controller.abort()
      }
    }

    standingsRepository
      .getStandings(activeDivision, {
        eventId: activeEventId,
        signal: controller.signal,
      })
      .then((data) => {
        setStandingsState({
          data,
          division: activeDivision,
          status: 'success',
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
  }, [activeDivision, activeEventId, eventCatalog])

  const activeEvent =
    eventCatalog?.events.find((event) => event.id === activeEventId) ??
    null

  const activeEventLabel =
    activeEventId === 'lifetime'
      ? 'Lifetime'
      : activeEventId === 'all'
        ? 'All Events'
        : activeEvent?.name ?? eventCatalog?.currentEvent.name ?? 'Current League'

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="standings-page-title">
        <p className="eyebrow">Standings</p>
        <h1 id="standings-page-title">Standings</h1>
        <p>
          {activeEventLabel} Rankings
        </p>
      </section>

      <section className="event-filter" aria-label="Event selector">
        <label htmlFor="standings-event-select">
          <span>Event</span>
          <select
            id="standings-event-select"
            onChange={(event) => setActiveEventId(event.target.value)}
            value={activeEventId}
          >
            {(eventCatalog?.events.length
              ? eventCatalog.events
              : [
                  {
                    id: 'event-current-league',
                    name: 'Current League',
                  },
                ]
            ).map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
            <option value="lifetime">Lifetime</option>
          </select>
        </label>
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
  event: NonNullable<EventCatalog['events'][number]>
}) {
  const isTeamTournament = event.type === 'Team Tournament'

  return (
    <section className="panel standings-panel">
      <div className="panel-heading">
        <p className="eyebrow">{event.type}</p>
        <h2>{event.name}</h2>
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
