import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Skeleton from '../components/Skeleton'
import {
  getEventOverviewKind,
  hasEventCapability,
  resolveEventCapabilities,
  type EventCapability,
} from '../config/eventCapabilities'
import {
  buildCapabilityNavigation,
  getEventNavigationConfig,
} from '../config/eventNavigation'
import { type EventHomeData } from '../services/api'
import { eventRepository } from '../services/data'
import type { LeagueEvent } from '../types/dashboard'
import './EventHome.css'

type EventHomeState =
  | { status: 'loading' }
  | { data: EventHomeData; status: 'success' }
  | { error: string; status: 'error' }

const defaultEventId = 'event-current-league'
const CommissionerEventWorkflow = lazy(
  () => import('../components/CommissionerEventWorkflow'),
)

function EventHome() {
  const auth = useAuth()
  const { eventId, section } = useParams<{ eventId: string; section?: string }>()
  const selectedEventId = eventId ? decodeURIComponent(eventId) : defaultEventId
  const selectedSection = normalizeEventHomeSection(section)
  const [state, setState] = useState<EventHomeState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    eventRepository
      .getEventHome(selectedEventId, { signal: controller.signal })
      .then((data) => {
        setState({
          data,
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
      <EventHomeSkeleton section={selectedSection} selectedEventId={selectedEventId} />
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

  const { data } = state

  const heroAction = data.quickActions.find((action) => action.enabled)
  const currentRound = data.currentRound
    ? String(data.currentRound['name'] ?? data.statistics.currentRound)
    : data.statistics.currentRound || 'Pending'
  const countdown = getCountdownLabel(data.event)
  const capabilities = resolveEventCapabilities(data.event, data.navigation)
  const configuredNavigation = getEventNavigationConfig(data.event.id)
  const eventNavigationItems = configuredNavigation
    ? buildCapabilityNavigation({
        ...configuredNavigation,
        capabilities,
      }).map((item) => ({
        href: item.to,
        label: item.label,
      }))
    : data.navigation
  const overview = buildOverviewModel(data, capabilities)
  const news = data.news.slice(0, 4)
  const recentTimeline = data.timeline.slice(0, 5)
  const showProgress = hasOverviewProgress(capabilities)
  const showTimeline =
    recentTimeline.length > 0 && hasEventTimeline(capabilities)
  const showNews = news.length > 0
  const showPlayerStatus = hasEventCapability(capabilities, 'registration')
  const showRules = hasEventCapability(capabilities, 'rules')
  const showCommissionerWorkflow = auth.isAtLeastRole('Commissioner')

  if (selectedSection === 'registration') {
    return (
      <EventRegistrationPage
        data={data}
        eventNavigationItems={eventNavigationItems}
        quickActions={data.quickActions}
      />
    )
  }

  return (
    <main className="portal-shell event-overview-shell">
      <section
        className={`event-home-hero panel event-overview-hero event-overview-hero-${overview.kind}`}
        aria-labelledby="event-home-title"
      >
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
          {heroAction ? (
            <Link className="event-home-primary-action" to={heroAction.href}>
              {heroAction.label}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="event-overview-status-grid" aria-label="Event status">
        {overview.statusCards.map((card) => (
          <EventStatusCard card={card} key={card.label} />
        ))}
      </section>

      <nav className="event-home-nav" aria-label="Event navigation">
        {eventNavigationItems.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>
            {item.label}
          </Link>
        ))}
        {showCommissionerWorkflow ? <a href="#commissioner">Commissioner</a> : null}
      </nav>

      <section className="event-overview-dashboard">
        {data.quickActions.length > 0 ? (
          <QuickActions actions={data.quickActions} />
        ) : null}
        {showProgress ? (
          <EventProgressPanel data={data} overview={overview} />
        ) : null}
      </section>

      {showTimeline || showNews ? (
        <section className="event-overview-dashboard event-overview-dashboard-wide">
          {showTimeline ? (
            <EventTimeline items={recentTimeline} />
          ) : null}
          {showNews ? <EventNews items={news} /> : null}
        </section>
      ) : null}

      {showPlayerStatus || showRules ? (
        <section className="event-overview-dashboard">
          {showPlayerStatus ? (
            <PlayerStatusCard data={data} />
          ) : null}
          {showRules ? <EventRules data={data} /> : null}
        </section>
      ) : null}

      {showCommissionerWorkflow ? (
        <Suspense fallback={null}>
          <CommissionerEventWorkflow data={data} />
        </Suspense>
      ) : null}
    </main>
  )
}

function EventHomeSkeleton({
  section,
  selectedEventId,
}: {
  section: EventHomeSection
  selectedEventId: string
}) {
  const eventLabel = selectedEventId
    .split('-')
    .filter(Boolean)
    .slice(1)
    .join(' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Event'

  return (
    <main className="portal-shell event-overview-shell">
      <section
        className="event-home-hero panel event-overview-hero"
        aria-labelledby="event-home-title"
      >
        <div>
          <p className="eyebrow">Event Headquarters</p>
          <h1 id="event-home-title">
            {section === 'registration' ? `${eventLabel} Registration` : eventLabel}
          </h1>
          <p>Preparing event status, registration, and activity.</p>
          <div className="event-home-badges">
            <span>Loading status</span>
            <span>Loading registration</span>
            <span>Loading round</span>
          </div>
        </div>
      </section>

      <section className="event-overview-status-grid" aria-label="Event status loading">
        {['Registration', 'Teams', 'Round', 'Deadline'].map((label) => (
          <article className="event-overview-status-card neutral" key={label}>
            <span>{label}</span>
            <strong>Loading</strong>
          </article>
        ))}
      </section>

      <nav className="event-home-nav" aria-label="Event navigation">
        {['Overview', 'Registration', 'Submit Result', 'Standings', 'Rules'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </nav>

      <section className="event-overview-dashboard">
        <Skeleton label="Event quick actions loading" rows={4} />
        <Skeleton label="Event progress loading" rows={5} />
      </section>
      <section className="event-overview-dashboard event-overview-dashboard-wide">
        <Skeleton label="Event timeline loading" rows={5} />
        <Skeleton label="Event news loading" rows={4} />
      </section>
    </main>
  )
}

type EventHomeSection = 'overview' | 'registration'

function normalizeEventHomeSection(section: string | undefined): EventHomeSection {
  if (section === 'registration') {
    return 'registration'
  }

  return 'overview'
}

type StatusCard = {
  label: string
  tone: 'accent' | 'neutral' | 'success' | 'warning'
  value: string
}

type OverviewModel = {
  focusLabel: string
  kind: ReturnType<typeof getEventOverviewKind>
  progressLabel: string
  statusCards: StatusCard[]
}

function buildOverviewModel(
  data: EventHomeData,
  capabilities: EventCapability[],
): OverviewModel {
  const kind = getEventOverviewKind(capabilities)
  const registrationDeadline = formatDate(
    data.registration.registrationWindow.endDate || data.event.startDate,
  )

  const statusCards: StatusCard[] = []

  if (hasEventCapability(capabilities, 'registration')) {
    statusCards.push({
      label: 'Registration',
      tone: 'success',
      value: data.registration.status || data.statistics.registrationStatus,
    })
  } else {
    statusCards.push({
      label: 'Status',
      tone: 'success',
      value: data.event.status || data.event.lifecycleStage,
    })
  }

  if (hasEventCapability(capabilities, 'teams')) {
    statusCards.push({
      label: 'Teams Registered',
      tone: 'accent',
      value: String(data.statistics.teams),
    })
  } else if (
    hasEventCapability(capabilities, 'players') ||
    hasEventCapability(capabilities, 'registration')
  ) {
    statusCards.push({
      label: 'Players',
      tone: 'neutral',
      value: String(data.statistics.registeredPlayers),
    })
  }

  if (
    hasEventCapability(capabilities, 'standings') ||
    hasEventCapability(capabilities, 'schedule') ||
    hasEventCapability(capabilities, 'objectives')
  ) {
    statusCards.push({
      label: kind === 'campaign' ? 'Campaign Turn' : 'Current Round',
      tone: 'accent',
      value: data.statistics.currentRound || 'Pending',
    })
  }

  if (hasEventCapability(capabilities, 'standings') && kind === 'league') {
    statusCards.push({
      label: 'Games Remaining',
      tone: 'warning',
      value: String(data.statistics.gamesRemaining),
    })
  } else if (hasEventCapability(capabilities, 'registration')) {
    statusCards.push({
      label: 'Deadline',
      tone: 'warning',
      value: registrationDeadline,
    })
  }

  return {
    focusLabel: getOverviewFocusLabel(kind),
    kind,
    progressLabel: getOverviewProgressLabel(kind),
    statusCards: statusCards.slice(0, 4),
  }
}

function getOverviewFocusLabel(kind: ReturnType<typeof getEventOverviewKind>) {
  if (kind === 'campaign') {
    return 'Campaign Command'
  }

  if (kind === 'tournament') {
    return 'Tournament Operations'
  }

  return 'League Command'
}

function getOverviewProgressLabel(kind: ReturnType<typeof getEventOverviewKind>) {
  if (kind === 'campaign') {
    return 'Campaign Progress'
  }

  if (kind === 'tournament') {
    return 'Tournament Progress'
  }

  return 'Season Progress'
}

function EventStatusCard({ card }: { card: StatusCard }) {
  return (
    <article className={`event-overview-status-card ${card.tone}`}>
      <span>{card.label}</span>
      <strong>{card.value}</strong>
    </article>
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

function EventRegistrationPage({
  data,
  eventNavigationItems,
  quickActions,
}: {
  data: EventHomeData
  eventNavigationItems: Array<{ href: string; label: string }>
  quickActions: EventHomeData['quickActions']
}) {
  return (
    <main className="portal-shell event-overview-shell" data-event-section="registration">
      <section className="page-header" aria-labelledby="event-registration-title">
        <p className="eyebrow">{data.event.name}</p>
        <h1 id="event-registration-title">Registration</h1>
        <p>{data.registration.status || 'Registration status for this event.'}</p>
      </section>

      <nav className="event-home-nav" aria-label="Event navigation">
        {eventNavigationItems.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="event-overview-dashboard">
        <PlayerStatusCard data={data} />
        <section className="panel event-home-panel">
          <div className="panel-heading">
            <p className="eyebrow">Registration Window</p>
            <h2>{data.registration.status}</h2>
          </div>
          <EventMetric label="Registered Players" value={data.registration.registeredCount} />
          <EventMetric label="Waitlist" value={data.registration.waitlistCount} />
          <EventMetric
            label="Opens"
            value={formatDate(data.registration.registrationWindow.startDate)}
          />
          <EventMetric
            label="Closes"
            value={formatDate(data.registration.registrationWindow.endDate)}
          />
        </section>
      </section>

      {quickActions.length > 0 ? (
        <section className="event-overview-dashboard">
          <QuickActions actions={quickActions} />
        </section>
      ) : null}
    </main>
  )
}

function EventProgressPanel({
  data,
  overview,
}: {
  data: EventHomeData
  overview: OverviewModel
}) {
  return (
    <section className="panel event-home-panel" id="standings">
      <div className="panel-heading">
        <p className="eyebrow">{overview.focusLabel}</p>
        <h2>{overview.progressLabel}</h2>
      </div>
      <div className="event-overview-progress">
        <span style={{ width: `${clampPercent(data.statistics.completionPercentage)}%` }} />
      </div>
      <div className="event-overview-metrics">
        <EventMetric label="Registered Players" value={data.statistics.registeredPlayers} />
        <EventMetric label="Teams" value={data.statistics.teams} />
        <EventMetric label="Completed Games" value={data.statistics.completedGames} />
        <EventMetric
          label="Completion"
          value={`${data.statistics.completionPercentage}%`}
        />
      </div>
    </section>
  )
}

function EventTimeline({ items }: { items: EventHomeData['timeline'] }) {
  return (
    <section className="panel event-home-panel" id="results">
      <div className="panel-heading">
        <p className="eyebrow">Recent Results</p>
        <h2>Event Feed</h2>
      </div>
      <div className="event-home-timeline">
        {items.map((item) => (
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

function EventNews({ items }: { items: string[] }) {
  return (
    <section className="panel event-home-panel" id="news">
      <div className="panel-heading">
        <p className="eyebrow">Latest News</p>
        <h2>Intel Briefing</h2>
      </div>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </section>
  )
}

function QuickActions({
  actions,
}: {
  actions: EventHomeData['quickActions']
}) {
  return (
    <section className="panel event-home-panel">
      <div className="panel-heading">
        <p className="eyebrow">Quick Actions</p>
        <h2>What To Do Next</h2>
      </div>
      <div className="event-home-actions">
        {actions.map((action) => (
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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

function formatDate(value: string) {
  if (!value) {
    return 'Pending'
  }

  const timestamp = Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  }).format(timestamp)
}

function hasOverviewProgress(capabilities: EventCapability[]) {
  return capabilities.some((capability) =>
    ['standings', 'statistics', 'teams', 'players', 'objectives'].includes(
      capability,
    ),
  )
}

function hasEventTimeline(capabilities: EventCapability[]) {
  return capabilities.some((capability) =>
    ['results', 'schedule', 'standings'].includes(capability),
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
