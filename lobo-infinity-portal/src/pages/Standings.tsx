import { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import StandingsTable from '../components/StandingsTable'
import StatCard from '../components/StatCard'
import { apiClient } from '../services/api'
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
  const [activeDivision, setActiveDivision] = useState<DivisionKey>('main')
  const [standingsState, setStandingsState] = useState<StandingsState>({
    status: 'idle',
  })

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
        standingsState={standingsState}
      />
    </main>
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
          value={standingsState.data.summary.leader?.player ?? 'None'}
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
            {standingsState.data.division === 'main' ? <MovementLegend /> : null}
          </div>

          <StandingsTable
            standings={standingsState.data.standings}
            showMovementZones={standingsState.data.division === 'main'}
          />
        </section>
      </section>
    </>
  )
}

function MovementLegend() {
  return (
    <dl className="movement-legend" aria-label="Promotion and relegation legend">
      <div>
        <dt className="legend-dot legend-safe" aria-label="Safe" />
        <dd>Safe</dd>
      </div>
      <div>
        <dt className="legend-dot legend-relegation" aria-label="Relegation" />
        <dd>Relegation</dd>
      </div>
    </dl>
  )
}

export default Standings
