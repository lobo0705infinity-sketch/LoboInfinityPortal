import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import { apiClient, type FactionSummary } from '../services/api'

type FactionsState =
  | {
      status: 'idle'
    }
  | {
      factions: FactionSummary[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function Factions() {
  const [factionsState, setFactionsState] = useState<FactionsState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getFactions({
        signal: controller.signal,
      })
      .then((factions) => {
        setFactionsState({
          factions,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setFactionsState({
          error:
            error instanceof Error
              ? error.message
              : 'Factions could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  if (factionsState.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Factions loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (factionsState.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Factions error">
          <p role="alert">{factionsState.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />

      {factionsState.factions.length === 0 ? (
        <section className="dashboard-state" aria-label="No factions">
          <p>No factions have reported games yet.</p>
        </section>
      ) : (
        <section className="faction-grid" aria-label="Faction headquarters">
          {factionsState.factions.map((faction) => (
            <FactionCard faction={faction} key={faction.name} />
          ))}
        </section>
      )}
    </main>
  )
}

function FactionCard({ faction }: { faction: FactionSummary }) {
  const profilePath = `/factions/${encodeURIComponent(faction.name)}`

  return (
    <Link className="faction-card" to={profilePath}>
      <div className="faction-card-main">
        <div>
          <p className="eyebrow">Faction</p>
          <h2>{faction.name}</h2>
        </div>
        <span className="faction-card-chevron" aria-hidden="true">
          ›
        </span>
      </div>

      <div className="faction-card-rate">
        <span>Win Rate</span>
        <strong>{formatPercent(faction.winRate)}</strong>
      </div>

      <dl className="faction-card-stats">
        <div>
          <dt>Games</dt>
          <dd>{faction.games}</dd>
        </div>
        <div>
          <dt>Top Player</dt>
          <dd>{faction.topPlayer || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Avg TP</dt>
          <dd>{formatNumber(faction.averageTP)}</dd>
        </div>
        <div>
          <dt>Avg OP</dt>
          <dd>{formatNumber(faction.averageOP)}</dd>
        </div>
        <div>
          <dt>Avg VP</dt>
          <dd>{formatNumber(faction.averageVP)}</dd>
        </div>
      </dl>
    </Link>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="factions-title">
      <p className="eyebrow">Factions</p>
      <h1 id="factions-title">Faction Headquarters</h1>
      <p>Faction records, commanders, missions, and battle reports</p>
    </section>
  )
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export default Factions
