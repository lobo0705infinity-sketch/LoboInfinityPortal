import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Loading from '../components/Loading'
import {
  apiClient,
  type EventHomeData,
} from '../services/api'
import type { LeagueEvent } from '../types/dashboard'
import TeamTournament from './TeamTournament'

type EventHomeState =
  | { status: 'loading' }
  | { data: EventHomeData; events: LeagueEvent[]; status: 'success' }
  | { error: string; status: 'error' }

const defaultEventId = 'event-current-league'

function EventHome() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const selectedEventId = eventId ? decodeURIComponent(eventId) : defaultEventId
  const [state, setState] = useState<EventHomeState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      apiClient.getEventHome(selectedEventId, { signal: controller.signal }),
      apiClient.getEvents({ signal: controller.signal }),
    ])
      .then(([data, catalog]) => {
        setState({
          data,
          events: catalog.events,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Event home could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [selectedEventId])

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <section className="dashboard-state" aria-label="Event loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <section className="dashboard-state" aria-label="Event error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  const { data, events } = state

  if (data.event.type === 'Team Tournament') {
    return <TeamTournament eventId={data.event.id} />
  }

  const heroAction = data.quickActions.find((action) => action.enabled)
  const currentRound = data.currentRound
    ? String(data.currentRound['name'] ?? data.statistics.currentRound)
    : data.statistics.currentRound || 'Pending'
  const countdown = getCountdownLabel(data.event)

  return (
    <main className="portal-shell">
      <section className="event-home-hero panel" aria-labelledby="event-home-title">
        <div>
          <p className="eyebrow">{data.event.type || 'Event'}</p>
          <h1 id="event-home-title">{data.event.name}</h1>
          <p>{data.event.description || 'Event headquarters powered by the Event Engine.'}</p>
          <div className="event-home-badges">
            <span>{data.event.status || data.event.lifecycleStage}</span>
            <span>{data.registration.status}</span>
            <span>{currentRound}</span>
            {countdown ? <span>{countdown}</span> : null}
          </div>
        </div>
        <div className="event-home-selector">
          <label>
            <span>Current Event</span>
            <select
              onChange={(event) =>
                navigate(`/event/${encodeURIComponent(event.target.value)}`)
              }
              value={data.event.id}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
              <option value="lifetime">Lifetime</option>
            </select>
          </label>
          {heroAction ? (
            <Link className="event-home-primary-action" to={heroAction.href}>
              {heroAction.label}
            </Link>
          ) : null}
        </div>
      </section>

      <nav className="event-home-nav" aria-label="Event navigation">
        {data.navigation.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="event-home-grid">
        <PlayerStatusCard data={data} />
        <EventStatsCard data={data} />
      </section>

      <section className="event-home-grid">
        <EventTimeline data={data} />
        <EventNews data={data} />
      </section>

      <section className="event-home-grid">
        <QuickActions data={data} />
        <EventRules data={data} />
      </section>
    </main>
  )
}

function PlayerStatusCard({ data }: { data: EventHomeData }) {
  return (
    <section className="panel event-home-panel" id="registration">
      <div className="panel-heading">
        <p className="eyebrow">Your Status</p>
        <h2>{data.playerStatus.registrationStatus}</h2>
      </div>
      <EventMetric label="Team" value={data.playerStatus.currentTeam || 'Not assigned'} />
      <EventMetric
        label="Captain"
        value={data.playerStatus.captain ? 'Yes' : 'No'}
      />
      <EventMetric label="Next Match" value={data.playerStatus.upcomingMatch} />
      <p>{data.playerStatus.outstandingAction}</p>
    </section>
  )
}

function EventStatsCard({ data }: { data: EventHomeData }) {
  return (
    <section className="panel event-home-panel" id="standings">
      <div className="panel-heading">
        <p className="eyebrow">Event Progress</p>
        <h2>{data.statistics.lifecycleStage || data.event.lifecycleStage}</h2>
      </div>
      <EventMetric label="Registered Players" value={data.statistics.registeredPlayers} />
      <EventMetric label="Teams" value={data.statistics.teams} />
      <EventMetric label="Completed Games" value={data.statistics.completedGames} />
      <EventMetric
        label="Completion"
        value={`${data.statistics.completionPercentage}%`}
      />
    </section>
  )
}

function EventTimeline({ data }: { data: EventHomeData }) {
  const timeline = useMemo(() => data.timeline.slice(0, 8), [data.timeline])

  return (
    <section className="panel event-home-panel" id="results">
      <div className="panel-heading">
        <p className="eyebrow">Timeline</p>
        <h2>Event Story</h2>
      </div>
      <div className="event-home-timeline">
        {timeline.map((item) => (
          <article key={`${item.type}-${item.title}-${item.timestamp}`}>
            <span>{item.type}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function EventNews({ data }: { data: EventHomeData }) {
  return (
    <section className="panel event-home-panel" id="news">
      <div className="panel-heading">
        <p className="eyebrow">News</p>
        <h2>Latest Updates</h2>
      </div>
      {data.news.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </section>
  )
}

function QuickActions({ data }: { data: EventHomeData }) {
  return (
    <section className="panel event-home-panel">
      <div className="panel-heading">
        <p className="eyebrow">Quick Actions</p>
        <h2>What To Do Next</h2>
      </div>
      <div className="event-home-actions">
        {data.quickActions.map((action) => (
          <Link
            aria-disabled={!action.enabled}
            className={action.enabled ? '' : 'disabled'}
            key={action.action}
            to={action.href}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function EventRules({ data }: { data: EventHomeData }) {
  return (
    <section className="panel event-home-panel" id="rules">
      <div className="panel-heading">
        <p className="eyebrow">Rules</p>
        <h2>Event Format</h2>
      </div>
      <EventMetric label="Scoring" value={data.event.scoringModel} />
      <EventMetric label="Standings" value={data.event.standingsModel} />
      <p>{data.event.rules || 'Event rules will be posted by the Commissioner.'}</p>
    </section>
  )
}

function EventMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="event-home-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function getCountdownLabel(event: LeagueEvent) {
  const target = event.endDate || event.startDate

  if (!target) {
    return ''
  }

  const timestamp = Date.parse(target)

  if (Number.isNaN(timestamp)) {
    return ''
  }

  const diff = Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24))

  if (diff > 1) {
    return `${diff} days remaining`
  }

  if (diff === 1) {
    return '1 day remaining'
  }

  if (diff === 0) {
    return 'Ends today'
  }

  return 'Date passed'
}

export default EventHome
