import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import type { SchedulingCenterData, SchedulingRequest } from '../services/api'
import { schedulingRepository } from '../services/data'
import { formatSchedulingDateTime } from '../services/formatting'

type ScheduleState =
  | { status: 'loading' }
  | { data: SchedulingCenterData; status: 'success' }
  | { error: string; status: 'error' }

const defaultEventId = 'event-current-league'

function Schedule() {
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') || defaultEventId
  const [state, setState] = useState<ScheduleState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    schedulingRepository
      .getSchedulingCenter({
        eventId,
        signal: controller.signal,
      })
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
              : 'Schedule could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [eventId])

  const eventName = state.status === 'success'
    ? state.data.event?.name || state.data.currentSeason || 'League Schedule'
    : formatEventLabel(eventId)

  return (
    <main className="portal-shell" data-page="schedule">
      <section className="page-header" aria-labelledby="schedule-title">
        <p className="eyebrow">Schedule</p>
        <h1 id="schedule-title">{eventName} Schedule</h1>
        <p>Round progress, pending requests, and upcoming scheduled matches for the selected event.</p>
        <Link className="submit-match-button" to={`/match-finder?eventId=${encodeURIComponent(eventId)}`}>
          Open Match Finder
        </Link>
      </section>

      {state.status === 'loading' ? <ScheduleSkeleton /> : null}

      {state.status === 'error' ? (
        <section className="dashboard-state" aria-label="Schedule error">
          <p role="alert">{state.error}</p>
        </section>
      ) : null}

      {state.status === 'success' ? <ScheduleContent data={state.data} /> : null}
    </main>
  )
}

function ScheduleSkeleton() {
  return (
    <>
      <section className="stat-grid" aria-label="Schedule loading">
        {['Event Progress', 'Player Progress', 'Pending Requests', 'Upcoming Matches'].map((label) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong>Loading</strong>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <Skeleton label="Upcoming schedule loading" rows={5} />
        <Skeleton label="Request queue loading" rows={5} />
      </section>
    </>
  )
}

function ScheduleContent({ data }: { data: SchedulingCenterData }) {
  const upcoming = useMemo(
    () => sortRequests(data.requests.upcoming),
    [data.requests.upcoming],
  )
  const pending = useMemo(
    () => sortRequests(data.requests.pending),
    [data.requests.pending],
  )
  const completion = Math.max(
    0,
    Math.min(100, data.seasonProgress.division.completionPercentage),
  )

  return (
    <>
      <section className="stat-grid" aria-label="Schedule summary">
        <article className="stat-card">
          <span>Event</span>
          <strong>{data.event?.name || data.currentSeason}</strong>
        </article>
        <article className="stat-card">
          <span>Completion</span>
          <strong>{completion}%</strong>
        </article>
        <article className="stat-card">
          <span>Upcoming</span>
          <strong>{upcoming.length}</strong>
        </article>
        <article className="stat-card">
          <span>Pending</span>
          <strong>{pending.length}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Published Schedule</p>
            <h2>Upcoming Matches</h2>
          </div>
          <RequestList emptyLabel="No upcoming matches are currently scheduled." requests={upcoming} />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Coordination</p>
            <h2>Pending Requests</h2>
          </div>
          <RequestList emptyLabel="No pending schedule requests." requests={pending} />
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Round Progress</p>
          <h2>{data.currentSeason}</h2>
        </div>
        <div className="event-overview-progress">
          <span style={{ width: `${completion}%` }} />
        </div>
        <div className="event-overview-metrics">
          <Metric label="Completed" value={data.seasonProgress.division.gamesCompleted} />
          <Metric label="Remaining" value={data.seasonProgress.division.gamesRemaining} />
          <Metric label="Players" value={data.seasonProgress.division.players} />
          <Metric label="Requests" value={data.requests.history.length} />
        </div>
      </section>
    </>
  )
}

function RequestList({
  emptyLabel,
  requests,
}: {
  emptyLabel: string
  requests: SchedulingRequest[]
}) {
  if (requests.length === 0) {
    return <p>{emptyLabel}</p>
  }

  return (
    <div className="dashboard-news-list">
      {requests.map((request) => (
        <article key={request.id || `${request.fromPlayer}-${request.toPlayer}-${request.proposedDate}`}>
          <span>{request.status}</span>
          <strong>{request.fromPlayer} vs {request.toPlayer}</strong>
          <p>
            {formatSchedulingDateTime(request.proposedDate, request.proposedTime)}
            {request.location ? ` at ${request.location}` : ''}
          </p>
        </article>
      ))}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="event-home-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function sortRequests(requests: SchedulingRequest[]) {
  return [...requests].sort((left, right) =>
    `${left.proposedDate} ${left.proposedTime}`.localeCompare(
      `${right.proposedDate} ${right.proposedTime}`,
    ),
  )
}

function formatEventLabel(eventId: string) {
  if (eventId === defaultEventId) {
    return 'July 2026 League'
  }

  return eventId
    .split('-')
    .filter(Boolean)
    .slice(1)
    .join(' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default Schedule
