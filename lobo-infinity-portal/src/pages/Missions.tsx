import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import { apiClient, type MissionSummary } from '../services/api'

type MissionsState =
  | {
      status: 'idle'
    }
  | {
      missions: MissionSummary[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function Missions() {
  const [missionsState, setMissionsState] = useState<MissionsState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getMissions({
        signal: controller.signal,
      })
      .then((missions) => {
        setMissionsState({
          missions,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setMissionsState({
          error:
            error instanceof Error
              ? error.message
              : 'Missions could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  if (missionsState.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Missions loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (missionsState.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Missions error">
          <p role="alert">{missionsState.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />

      {missionsState.missions.length === 0 ? (
        <section className="dashboard-state" aria-label="No missions">
          <p>No missions have reported games yet.</p>
        </section>
      ) : (
        <section className="faction-grid" aria-label="Mission headquarters">
          {missionsState.missions.map((mission) => (
            <MissionCard key={mission.mission} mission={mission} />
          ))}
        </section>
      )}
    </main>
  )
}

function MissionCard({ mission }: { mission: MissionSummary }) {
  const profilePath = `/missions/${encodeURIComponent(mission.mission)}`

  return (
    <Link className="faction-card mission-card" to={profilePath}>
      <div className="faction-card-main">
        <div>
          <p className="eyebrow">Mission</p>
          <h2>{mission.mission}</h2>
        </div>
        <span className="faction-card-chevron" aria-hidden="true">
          &gt;
        </span>
      </div>

      <div className="faction-card-rate">
        <span>First Turn Win %</span>
        <strong>{formatPercent(mission.firstTurnWinRate)}</strong>
      </div>

      <dl className="faction-card-stats">
        <div>
          <dt>Games</dt>
          <dd>{mission.games}</dd>
        </div>
        <div>
          <dt>Top Faction</dt>
          <dd>{mission.mostSuccessfulFaction || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Avg OP</dt>
          <dd>{formatNumber(mission.averageOP)}</dd>
        </div>
        <div>
          <dt>Avg VP</dt>
          <dd>{formatNumber(mission.averageVP)}</dd>
        </div>
        <div>
          <dt>Last Played</dt>
          <dd>{mission.lastPlayed || 'Not recorded'}</dd>
        </div>
      </dl>
    </Link>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="missions-title">
      <p className="eyebrow">Missions</p>
      <h1 id="missions-title">Mission Headquarters</h1>
      <p>Mission tempo, first-turn pressure, factions, and battle reports</p>
    </section>
  )
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export default Missions
