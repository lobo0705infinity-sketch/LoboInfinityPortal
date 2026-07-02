import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import { apiClient, type LeagueTimelineItem } from '../services/api'

type TimelineState =
  | {
      status: 'idle'
    }
  | {
      items: LeagueTimelineItem[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function Timeline() {
  const [state, setState] = useState<TimelineState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getTimeline({
        signal: controller.signal,
      })
      .then((items) => {
        setState({
          items,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            error:
              error instanceof Error
                ? error.message
                : 'Timeline could not be loaded.',
            status: 'error',
          })
        }
      })

    return () => {
      controller.abort()
    }
  }, [])

  if (state.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Timeline loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Timeline error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />
      <section className="timeline-list" aria-label="League timeline">
        {state.items.map((item) => (
          <article className="timeline-item" key={item.id}>
            <div className="timeline-marker" aria-hidden="true" />
            <Link to={item.link || '/timeline'}>
              <span>{item.type}</span>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <small>{item.timestamp}</small>
            </Link>
          </article>
        ))}
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="timeline-title">
      <p className="eyebrow">League Timeline</p>
      <h1 id="timeline-title">Chronological League History</h1>
      <p>Games, records, standings movement, news, and Hall of Fame signals</p>
    </section>
  )
}

export default Timeline
