import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
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
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') || ''
  const [state, setState] = useState<TimelineState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getTimeline({
        eventId,
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
  }, [eventId])

  if (state.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader eventScoped={Boolean(eventId)} />
        <section className="timeline-list" aria-label="Timeline loading">
          <Skeleton label="Timeline entries loading" rows={8} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader eventScoped={Boolean(eventId)} />
        <section className="dashboard-state" aria-label="Timeline error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader eventScoped={Boolean(eventId)} />
      <section className="timeline-list" aria-label="Event timeline">
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

function PageHeader({ eventScoped }: { eventScoped: boolean }) {
  return (
    <section className="page-header" aria-labelledby="timeline-title">
      <p className="eyebrow">{eventScoped ? 'Event Timeline' : 'League Timeline'}</p>
      <h1 id="timeline-title">{eventScoped ? 'Chronological Event History' : 'Chronological League History'}</h1>
      <p>Games, records, standings movement, news, and Hall of Fame signals</p>
    </section>
  )
}

export default Timeline
