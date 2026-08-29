import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import DiscordCommunityLink from '../components/DiscordCommunityLink'
import PortalIcon from '../components/PortalIcon'
import Skeleton from '../components/Skeleton'
import { getDiscordCommunityLink } from '../config/communityLinks'
import { getCanonicalArmyOptions } from '../services/armyIdentity'
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
import { apiClient, type EventBracketData, type EventBracketMatch, type EventHomeData } from '../services/api'
import { eventRepository, playerRepository, registrationRepository } from '../services/data'
import { getEventResultTimelineItems } from '../services/eventResults'
import { getPublicEventProjection } from '../services/publicEventProjection'
import { useSettings } from '../contexts/SettingsContext'
import type { LeagueEvent } from '../types/dashboard'
import './EventHome.css'

type EventHomeState =
  | { status: 'loading' }
  | { bracket?: EventBracketData; data: EventHomeData; status: 'success' }
  | { error: string; status: 'error' }

const defaultEventId = 'event-current-league'
const CommissionerEventWorkflow = lazy(
  () => import('../components/CommissionerEventWorkflow'),
)

function EventHome() {
  const auth = useAuth()
  const { settings } = useSettings()
  const { eventId, section } = useParams<{ eventId: string; section?: string }>()
  const selectedEventId = eventId ? decodeURIComponent(eventId) : defaultEventId
  const selectedSection = normalizeEventHomeSection(section)
  const isTop40 = selectedEventId === 'event-lobo-s-american-top-40'
  const usePreparedPublicProjection = isTop40 && !auth.isAtLeastRole('Commissioner')
  const [state, setState] = useState<EventHomeState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    if (isTop40 && selectedSection === 'rules') {
      return () => controller.abort()
    }

    const request = usePreparedPublicProjection
      ? getPublicEventProjection(selectedEventId, { signal: controller.signal })
          .then((projection) => ({ bracket: projection.bracket, data: projection.home }))
      : eventRepository
          .getEventHome(selectedEventId, { signal: controller.signal })
          .then((data) => ({ data }))

    request
      .then((result) => {
        setState({
          ...result,
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
  }, [isTop40, selectedEventId, selectedSection, usePreparedPublicProjection])

  if (isTop40 && selectedSection === 'rules') {
    return <Top40StaticRulesPage />
  }

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

  const visibleQuickActions = data.quickActions.filter(isVisibleEventQuickAction)
  const heroAction = visibleQuickActions.find((action) => action.enabled)
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
      })).filter(isVisibleEventNavigationItem)
    : data.navigation.filter(isVisibleEventNavigationItem)
  const overview = buildOverviewModel(data, capabilities)
  const news = data.news.slice(0, 4)
  const recentTimeline = data.timeline.slice(0, 5)
  const showProgress = hasOverviewProgress(capabilities)
  const showTimeline =
    recentTimeline.length > 0 && hasEventTimeline(capabilities)
  const showNews = news.length > 0
  const showPlayerStatus = hasEventCapability(capabilities, 'registration')
  const showRules =
    hasEventCapability(capabilities, 'rules') &&
    data.event.id !== 'event-lobo-s-american-top-40'
  const showCommissionerWorkflow = auth.isAtLeastRole('Commissioner')

  if (selectedSection === 'registration') {
    return (
      <EventRegistrationPage
        data={data}
        eventNavigationItems={eventNavigationItems}
        quickActions={visibleQuickActions}
      />
    )
  }

  if (selectedSection === 'bracket') {
    return (
      <EventBracketPage
        bracket={state.bracket}
        data={data}
        eventNavigationItems={eventNavigationItems}
      />
    )
  }

  if (
    selectedSection === 'results' &&
    data.event.id === 'event-lobo-s-american-top-40'
  ) {
    return (
      <EventResultsPage
        data={data}
        eventNavigationItems={eventNavigationItems}
      />
    )
  }

  if (
    selectedSection === 'rules' &&
    data.event.id === 'event-lobo-s-american-top-40'
  ) {
    return (
      <EventRulesPage
        data={data}
        eventNavigationItems={eventNavigationItems}
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

      <EventDiscordCallout />

      {data.event.id === 'event-lobo-s-american-top-40' && settings?.top40GameSubmissionFormUrl ? (
        <section className="panel event-home-panel">
          <h2>Report a Top 40 Game</h2>
          <p>Use the dedicated tournament form for a completed Active bracket match.</p>
          <a className="event-home-primary-action" href={settings.top40GameSubmissionFormUrl} target="_blank" rel="noreferrer">Submit Top 40 Game</a>
        </section>
      ) : null}

      <nav className="event-home-nav" aria-label="Event navigation">
        {eventNavigationItems.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>
            {item.label}
          </Link>
        ))}
        {showCommissionerWorkflow ? <a href="#commissioner">Commissioner</a> : null}
      </nav>

      <section className="event-overview-dashboard">
        {visibleQuickActions.length > 0 ? (
          <QuickActions actions={visibleQuickActions} />
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
        {['Overview', 'Registration', 'Standings', 'Rules'].map((label) => (
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

function EventDiscordCallout() {
  const { settings } = useSettings()
  const discord = getDiscordCommunityLink(settings)

  if (!discord) {
    return null
  }

  return (
    <section className="panel event-discord-callout" aria-labelledby="event-discord-title">
      <div className="event-discord-icon" aria-hidden="true">
        <PortalIcon name="discord" />
      </div>
      <div>
        <p className="eyebrow">League Coordination</p>
        <h2 id="event-discord-title">Need an opponent?</h2>
        <p>
          Looking for a game, have a question about this event, or want to
          coordinate with other players? Join the Lobo Infinity League Discord.
        </p>
      </div>
      <DiscordCommunityLink className="event-home-secondary-action">
        Join Discord
      </DiscordCommunityLink>
    </section>
  )
}

type EventHomeSection = 'bracket' | 'overview' | 'registration' | 'results' | 'rules'

function normalizeEventHomeSection(section: string | undefined): EventHomeSection {
  if (section === 'bracket') {
    return 'bracket'
  }

  if (section === 'registration') {
    return 'registration'
  }

  if (section === 'results') {
    return 'results'
  }

  if (section === 'rules') {
    return 'rules'
  }

  return 'overview'
}

function EventResultsPage({
  data,
  eventNavigationItems,
}: {
  data: EventHomeData
  eventNavigationItems: Array<{ href: string; label: string }>
}) {
  const results = getEventResultTimelineItems(data.timeline)

  return (
    <main className="portal-shell event-overview-shell" data-event-section="results">
      <section className="page-header" aria-labelledby="event-results-title">
        <p className="eyebrow">{data.event.name}</p>
        <h1 id="event-results-title">Results</h1>
        <p>Completed games reported for this event.</p>
      </section>

      <nav className="event-home-nav" aria-label="Event navigation">
        {eventNavigationItems.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="panel event-home-panel" aria-label="Event results">
        {results.length === 0 ? (
          <p>No results have been reported for this event yet.</p>
        ) : (
          <div className="event-home-timeline">
            {results.map((item) => (
              <article key={`${item.title}-${item.timestamp}`}>
                <span>{item.type}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function EventBracketPage({
  bracket,
  data,
  eventNavigationItems,
}: {
  bracket?: EventBracketData
  data: EventHomeData
  eventNavigationItems: Array<{ href: string; label: string }>
}) {
  if (data.event.type !== 'Individual Double Elimination') {
    return (
      <main className="portal-shell event-overview-shell" data-event-section="bracket">
        <section className="page-header" aria-labelledby="event-bracket-title">
          <p className="eyebrow">{data.event.name}</p>
          <h1 id="event-bracket-title">Tournament Bracket</h1>
          <p>The double-elimination bracket will be published here.</p>
        </section>
        <nav className="event-home-nav" aria-label="Event navigation">
          {eventNavigationItems.map((item) => (
            <Link key={`${item.label}-${item.href}`} to={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </main>
    )
  }

  return <DoubleEliminationBracketPage initialBracket={bracket} data={data} eventNavigationItems={eventNavigationItems} />
}

function DoubleEliminationBracketPage({
  initialBracket,
  data,
  eventNavigationItems,
}: {
  initialBracket?: EventBracketData
  data: EventHomeData
  eventNavigationItems: Array<{ href: string; label: string }>
}) {
  const [bracket, setBracket] = useState<EventBracketData | null>(initialBracket ?? null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialBracket) return

    const controller = new AbortController()
    apiClient.getEventBracket(data.event.id, { signal: controller.signal })
      .then(setBracket)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Bracket could not be loaded.')
      })
    return () => controller.abort()
  }, [data.event.id, initialBracket])

  const readiness = bracket?.readiness

  return (
    <main className="portal-shell event-overview-shell" data-event-section="bracket">
      <section className="page-header" aria-labelledby="event-bracket-title">
        <p className="eyebrow">{data.event.name}</p>
        <h1 id="event-bracket-title">Tournament Bracket</h1>
        <p>{bracket?.generated ? 'Seeded double-elimination bracket.' : 'Bracket has not been generated.'}</p>
      </section>

      <nav className="event-home-nav" aria-label="Event navigation">
        {eventNavigationItems.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      {!bracket?.generated && readiness ? <section className="event-overview-status-grid" aria-label="Bracket readiness">
        <EventMetric
          label="Registered Players"
          value={`${readiness.registeredCount} / ${readiness.capacity || '—'}`}
        />
        <EventMetric
          label="Seeded Players"
          value={`${readiness.seededCount} / ${readiness.registeredCount}`}
        />
        <EventMetric
          label="Registration"
          value={readiness.registrationClosed ? 'Closed' : 'Open'}
        />
      </section> : null}

      {error ? <section className="panel event-home-panel"><p role="alert">{error}</p></section> : null}
      {!bracket ? <Skeleton label="Tournament bracket loading" rows={4} /> : null}
      {bracket && !bracket.generated ? <section className="panel event-home-panel">
        <p>Bracket generation is pending completion of registration and seeding.</p>
      </section> : null}
      {bracket?.generated ? <>
        {bracket.tournamentComplete && bracket.champion ? <section className="panel event-home-panel"><h2>Lobo's American Top 40 Champion</h2><p>{bracket.champion}</p></section> : null}
        <BracketStructure matches={bracket.matches} />
      </> : null}
    </main>
  )
}

function BracketStructure({ matches }: { matches: EventBracketMatch[] }) {
  return (
    <section className="event-bracket-structure" aria-label="Tournament bracket">
      {(['Winners', 'Losers', 'Grand Final'] as const).map((bracketName) => {
        const bracketMatches = matches.filter((match) => match.bracket === bracketName)
        const rounds = [...new Set(bracketMatches.map((match) => match.bracketRound))]
        return (
          <section className="panel event-bracket-area" key={bracketName}>
            <h2>{bracketName === 'Grand Final' ? 'Grand Final' : `${bracketName} Bracket`}</h2>
            <div className="event-bracket-rounds">
              {rounds.map((round) => (
                <div className="event-bracket-round" key={round}>
                  <h3>{bracketName === 'Grand Final' ? 'Winner Takes All' : `Round ${round}`}</h3>
                  {bracketMatches.filter((match) => match.bracketRound === round).map((match) => (
                    <article className="event-bracket-match" key={match.matchId}>
                      <strong>{match.matchId}</strong>
                      <span>{formatBracketPlayer(match.playerA, match.playerASource, match.seedA)}</span>
                      <span>{formatBracketPlayer(match.playerB, match.playerBSource, match.seedB)}</span>
                      <small>{getBracketMatchStatus(match)}</small>
                      <small>Mission: {match.mission || 'Not assigned'}</small>
                      {match.status === 'Completed' && match.winner ? <small>Winner: {match.winner}</small> : null}
                      {match.status === 'Completed' && match.resolution === 'Forfeit' ? <small>Forfeit</small> : null}
                      {match.status === 'Active' && match.deadline ? <small>Deadline: {formatBracketDeadline(match.deadline)}</small> : null}
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </section>
  )
}

function getBracketMatchStatus(match: EventBracketMatch) {
  if (match.status === 'Active' && match.deadline) {
    const deadline = new Date(match.deadline.replace(' ', 'T'))
    if (!Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now()) return 'Past Deadline'
    return 'Active'
  }
  if (match.status === 'Pending') return 'Waiting for opponent'
  return match.status
}

function formatBracketDeadline(value: string) {
  const parsed = new Date(value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatBracketPlayer(player: string, source: string, seed: number | null) {
  if (player === 'BYE' || source === 'BYE') return 'BYE'
  if (player) return seed ? `${seed}. ${player}` : player
  return source ? `TBD — ${source}` : 'TBD'
}

function EventRulesPage({
  data,
  eventNavigationItems,
}: {
  data: EventHomeData
  eventNavigationItems: Array<{ href: string; label: string }>
}) {
  return (
    <main className="portal-shell event-overview-shell" data-event-section="rules">
      <section className="page-header" aria-labelledby="event-rules-page-title">
        <p className="eyebrow">{data.event.name}</p>
        <h1 id="event-rules-page-title">Event Rules</h1>
        <p>Official tournament format, scheduling, and administration rules.</p>
      </section>

      <nav className="event-home-nav" aria-label="Event navigation">
        {eventNavigationItems.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <Top40Rules />
    </main>
  )
}

function Top40StaticRulesPage() {
  const config = getEventNavigationConfig('event-lobo-s-american-top-40')
  const eventNavigationItems = config
    ? buildCapabilityNavigation(config).map((item) => ({ href: item.to, label: item.label }))
    : []

  return (
    <main className="portal-shell event-overview-shell" data-event-section="rules">
      <section className="page-header" aria-labelledby="event-rules-page-title">
        <p className="eyebrow">Lobo&apos;s American Top 40</p>
        <h1 id="event-rules-page-title">Event Rules</h1>
        <p>Official tournament format, scheduling, and administration rules.</p>
      </section>
      <nav className="event-home-nav" aria-label="Event navigation">
        {eventNavigationItems.map((item) => (
          <Link key={`${item.label}-${item.href}`} to={item.href}>{item.label}</Link>
        ))}
      </nav>
      <Top40Rules />
    </main>
  )
}

function isVisibleEventNavigationItem(item: { href: string; label: string }) {
  return (
    !isSubmitGameReference(item.label, item.href) &&
    !isMatchFinderReference(item.label, item.href)
  )
}

function isVisibleEventQuickAction(action: EventHomeData['quickActions'][number]) {
  return (
    !isSubmitGameReference(action.label, action.href, action.action) &&
    !isMatchFinderReference(action.label, action.href, action.action)
  )
}

function isMatchFinderReference(label: string, href = '', action = '') {
  const text = `${label} ${href} ${action}`.toLowerCase()

  return text.includes('match finder') || text.includes('/match-finder') || action === 'matchFinder'
}

function isSubmitGameReference(label: string, href = '', action = '') {
  const text = `${label} ${href} ${action}`.toLowerCase()

  return (
    text.includes('/submit-game') ||
    text.includes('/submit-result') ||
    text.includes('submit game') ||
    text.includes('submit result')
  )
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
  const individualTournament =
    data.event.type === 'Individual Double Elimination'

  return (
    <section className="panel event-home-panel" id="registration">
      <div className="panel-heading">
        <p className="eyebrow">Your Status</p>
        <h2>{data.playerStatus.registrationStatus}</h2>
      </div>
      {individualTournament ? null : (
        <>
          <EventMetric label="Team" value={data.playerStatus.currentTeam || 'Not assigned'} />
          <EventMetric
            label="Captain"
            value={data.playerStatus.captain ? 'Yes' : 'No'}
          />
          <EventMetric label="Next Match" value={data.playerStatus.upcomingMatch} />
          <p>{data.playerStatus.outstandingAction}</p>
        </>
      )}
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
  const individualTournament =
    data.event.type === 'Individual Double Elimination'
  const registeredPlayers =
    individualTournament &&
    !data.registration.capacity.unlimited &&
    data.registration.capacity.maximumPlayers > 0
      ? `${data.registration.registeredCount} / ${data.registration.capacity.maximumPlayers}`
      : data.registration.registeredCount

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
          <EventMetric label="Registered Players" value={registeredPlayers} />
          {!individualTournament || data.registration.capacity.waitlistEnabled ? (
            <EventMetric label="Waitlist" value={data.registration.waitlistCount} />
          ) : null}
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

      {individualTournament ? (
        <IndividualDoubleEliminationRegistrationForm
          eventId={data.event.id}
          registrationOpen={data.registration.registrationOpen}
        />
      ) : null}

      {quickActions.length > 0 ? (
        <section className="event-overview-dashboard">
          <QuickActions actions={quickActions} />
        </section>
      ) : null}
    </main>
  )
}

function IndividualDoubleEliminationRegistrationForm({
  eventId,
  registrationOpen,
}: {
  eventId: string
  registrationOpen: boolean
}) {
  const [player, setPlayer] = useState('')
  const [itsName, setItsName] = useState('')
  const [faction, setFaction] = useState('')
  const [players, setPlayers] = useState<string[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    playerRepository
      .getAllPlayers({ signal: controller.signal })
      .then((divisions) => {
        const canonicalPlayers = new Map<string, string>()

        divisions.forEach((division) => {
          division.standings.forEach((standing) => {
            if (standing.canonical !== true) {
              return
            }

            const value = standing.player.trim()
            if (value) {
              canonicalPlayers.set(value.toLowerCase(), value)
            }
          })
        })

        setPlayers(
          Array.from(canonicalPlayers.values()).sort((left, right) =>
            left.localeCompare(right),
          ),
        )
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Community Players could not be loaded.',
          )
        }
      })

    return () => controller.abort()
  }, [])

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError('')
    setMessage('')

    try {
      await registrationRepository.register({
        eventId,
        faction,
        itsName,
        player,
      })
      setMessage('Registration submitted.')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Registration could not be submitted.',
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="panel event-home-panel">
      <div className="panel-heading">
        <p className="eyebrow">American Top 40</p>
        <h2>Register</h2>
      </div>
      <form className="event-manager-form compact" onSubmit={submitRegistration}>
        <label>
          Player
          <select
            disabled={!registrationOpen || working}
            onChange={(event) => setPlayer(event.target.value)}
            required
            value={player}
          >
            <option value="">Select Player</option>
            {players.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Corvus Belli ITS Name
          <input
            disabled={!registrationOpen || working}
            onChange={(event) => setItsName(event.target.value)}
            required
            type="text"
            value={itsName}
          />
        </label>
        <label>
          Faction
          <select
            disabled={!registrationOpen || working}
            onChange={(event) => setFaction(event.target.value)}
            required
            value={faction}
          >
            <option value="">Select Faction</option>
            {getCanonicalArmyOptions().map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <button disabled={!registrationOpen || working || message !== ''} type="submit">
          {working ? 'Registering…' : 'Register'}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
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

function Top40Rules() {
  return (
    <section className="top40-rules" id="rules" aria-labelledby="top40-rules-title">
      <div className="panel top40-rules-heading">
        <p className="eyebrow">Official Event Rules</p>
        <h2 id="top40-rules-title">Lobo&apos;s American Top 40</h2>
        <p>
          An individual double-elimination Infinity tournament for players
          across the Americas.
        </p>
        <div className="top40-rule-highlights" aria-label="Defining tournament rules">
          <strong>40 Player Max</strong>
          <strong>Seeded by Corvus Belli ELO</strong>
          <strong>Double Elimination</strong>
          <strong>7+ Days per Active Match</strong>
        </div>
        <p className="top40-rule-warning">No Automatic Forfeits</p>
      </div>

      <div className="top40-rules-grid">
        <RuleCard title="Event Format">
          <p>
            Lobo&apos;s American Top 40 is open to a maximum of 40 players.
            Players remain in the tournament until they have lost twice.
          </p>
          <RuleList items={[
            'First loss → move to the Losers Bracket.',
            'Second loss → eliminated.',
            'Grand Final — Winner Takes All is the one exception to the normal two-loss elimination structure.',
          ]} />
        </RuleCard>

        <RuleCard title="Registration">
          <p>Registration is limited to 40 players.</p>
          <p>
            Players use their existing Lobo player identity and provide their
            Corvus Belli ITS Name and Faction. Registration does not guarantee
            a particular seed.
          </p>
        </RuleCard>

        <RuleCard title="Seeding">
          <p>
            Initial seeding is determined by the Commissioner using Corvus
            Belli ELO rankings. The Commissioner establishes the final order
            before bracket generation. Initial seeds lock when the bracket is generated.
          </p>
        </RuleCard>

        <RuleCard title="Double-Elimination Bracket">
          <p>The seeded structure consists of:</p>
          <RuleList items={['Winners Bracket', 'Losers Bracket', 'Grand Final']} />
          <p>
            The tournament may begin below capacity. Byes are assigned by seed,
            with the highest seeds receiving available byes. A bye is not a
            played game or tournament-statistics victory.
          </p>
          <h4>Grand Final — Winner Takes All</h4>
          <p>
            The winner of the Winners Bracket plays the winner of the Losers
            Bracket in a single Grand Final. The winner of that game is
            Lobo&apos;s American Top 40 Champion, regardless of previous losses.
            This is the one exception to the normal two-loss elimination structure.
            There is no bracket reset or second Grand Final.
          </p>
        </RuleCard>

        <RuleCard title="Rolling Match Schedule">
          <p>
            Top 40 does not wait for every player to complete a traditional
            round. A matchup becomes Active as soon as both players are known.
            Once activated, players receive at least 7 full days to schedule
            and complete the game. Later matches may begin while other portions
            of the bracket remain in play.
          </p>
        </RuleCard>

        <RuleCard title="Match Deadlines" tone="warning">
          <p>
            Players must communicate and make a reasonable scheduling effort.
            There are no automatic forfeits. If a match misses its deadline,
            the Commissioner determines the resolution.
          </p>
          <RuleList items={['Deadline Extension', 'Forfeit', 'Other Commissioner Ruling']} />
          <p>The portal never eliminates a player merely because a deadline expires.</p>
        </RuleCard>

        <RuleCard title="Missions">
          <p>
            Each matchup or bracket stage receives a Commissioner-assigned mission.
            The mission shown in the Lobo Infinity Portal is the mission that must
            be played. Known missions may later link to Mission Geist.
          </p>
        </RuleCard>

        <RuleCard title="Game Results">
          <p>
            Completed games use the existing canonical Lobo Infinity Portal
            submission architecture. The bracket determines the opponent.
          </p>
          <RuleList items={[
            'Mission', 'Result', 'Tournament Points', 'Objective Points',
            'Victory Points', 'First Turn', 'Factions', 'Army Codes', 'Best Moment',
          ]} compact />
        </RuleCard>

        <RuleCard title="Army Lists and Factions">
          <p>
            Players register a faction. Army Codes from individual games use
            the existing canonical Game Engine and Army Intelligence systems.
            Top 40 does not introduce an army-list lock.
          </p>
        </RuleCard>

        <RuleCard title="Commissioner Authority">
          <p>The Commissioner has final authority over:</p>
          <RuleList items={[
            'Seeding', 'Match Deadlines', 'Extensions', 'Forfeits',
            'Result Corrections', 'Bracket Corrections', 'Rules Disputes',
          ]} compact />
          <p>
            Normal progression should ultimately follow valid submitted results;
            Commissioner intervention is reserved for exceptional situations.
          </p>
        </RuleCard>
      </div>

      <section className="panel top40-champion-rule" aria-label="Champion rule">
        <p className="eyebrow">Champion</p>
        <p>One Grand Final decides the championship. Winner takes all.</p>
        <strong>Lobo&apos;s American Top 40 Champion</strong>
      </section>
    </section>
  )
}

function RuleCard({
  children,
  title,
  tone = 'default',
}: {
  children: ReactNode
  title: string
  tone?: 'default' | 'warning'
}) {
  return (
    <article className={`panel top40-rule-card ${tone}`}>
      <h3>{title}</h3>
      {children}
    </article>
  )
}

function RuleList({ items, compact = false }: { items: string[]; compact?: boolean }) {
  return (
    <ul className={compact ? 'top40-rule-list compact' : 'top40-rule-list'}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
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
