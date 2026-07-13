import { useEffect, useState } from 'react'
import Skeleton from '../components/Skeleton'
import { eventRepository } from '../services/data'
import type { LeagueOperationsData } from '../services/api'

type LeagueOperationsState =
  | { status: 'loading' }
  | { data: LeagueOperationsData; status: 'success' }
  | { error: string; status: 'error' }

function LeagueOperations() {
  const [state, setState] = useState<LeagueOperationsState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    eventRepository
      .getLeagueOperations({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, status: 'success' })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'League Operations could not be loaded.',
          status: 'error',
        })
      })

    return () => controller.abort()
  }, [])

  const operations =
    state.status === 'success'
      ? state.data
      : {
          mapOptions: [],
          missionOptions: [],
          missions: [
            { maps: ['', ''], mission: '' },
            { maps: ['', ''], mission: '' },
          ],
          updatedAt: '',
          updatedBy: '',
          weekNumber: '',
        }

  return (
    <main className="page page-narrow">
      <section className="page-hero">
        <p className="eyebrow">League Operations</p>
        <h1>This Week&apos;s Missions</h1>
        {operations.weekNumber ? <p>Week {operations.weekNumber}</p> : null}
      </section>

      {state.status === 'error' ? (
        <section className="panel">
          <p className="form-error" role="alert">
            {state.error}
          </p>
        </section>
      ) : null}

      {state.status === 'loading' ? (
        <section className="operations-grid two-column">
          <Skeleton label="League Operations loading" rows={4} />
          <Skeleton label="League Operations loading" rows={4} />
        </section>
      ) : (
        <section className="operations-grid two-column" aria-label="This week's missions">
          {operations.missions.slice(0, 2).map((mission, index) => (
            <article className="panel operations-panel" key={`${mission.mission}-${index}`}>
              <p className="eyebrow">Mission {index + 1}</p>
              <h2>{mission.mission || 'Mission not configured'}</h2>
              <div className="operations-stack">
                <div className="operations-record">
                  <span>Map A</span>
                  <strong>{mission.maps[0] || 'Map not configured'}</strong>
                </div>
                <div className="operations-record">
                  <span>Map B</span>
                  <strong>{mission.maps[1] || 'Map not configured'}</strong>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {operations.updatedAt ? (
        <p className="muted">Updated {operations.updatedAt}</p>
      ) : null}
    </main>
  )
}

export default LeagueOperations
