import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import {
  apiClient,
  type SchedulingCenterData,
  type SchedulingRecommendation,
  type SchedulingRequest,
} from '../services/api'
import { formatPlayerName } from '../services/formatting'

type MatchFinderState =
  | {
      status: 'loading'
    }
  | {
      data: SchedulingCenterData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function MatchFinder() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const preferredOpponent = searchParams.get('opponent') ?? ''
  const [state, setState] = useState<MatchFinderState>({ status: 'loading' })
  const [working, setWorking] = useState('')
  const [availabilityMessage, setAvailabilityMessage] = useState('')

  useEffect(() => {
    if (auth.status !== 'ready') {
      return
    }

    if (!auth.authenticated) {
      return
    }

    const controller = new AbortController()

    apiClient
      .getSchedulingCenter({ signal: controller.signal })
      .then((data) => setState({ data, status: 'success' }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Match Finder could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [auth.authenticated, auth.status])

  async function updateAvailability(params: Record<string, string>) {
    setWorking('availability')
    setAvailabilityMessage('')
    try {
      await apiClient.updateSchedulingAvailability(params)
      const data = await apiClient.getSchedulingCenter()
      setState({ data, status: 'success' })
      setAvailabilityMessage('Availability Saved')
    } finally {
      setWorking('')
    }
  }

  async function createRequest(params: Record<string, string>) {
    setWorking('request')
    try {
      const data = await apiClient.createSchedulingRequest(params)
      setState({ data, status: 'success' })
    } finally {
      setWorking('')
    }
  }

  async function respondToRequest(requestId: string, status: string) {
    setWorking(requestId)
    try {
      const data = await apiClient.respondSchedulingRequest({
        requestId,
        status,
      })
      setState({ data, status: 'success' })
    } finally {
      setWorking('')
    }
  }

  async function exportCalendar(requestId: string) {
    const calendar = await apiClient.getSchedulingCalendar(requestId)
    const blob = new Blob([calendar.ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = calendar.filename || 'lobo-match.ics'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (auth.status === 'ready' && !auth.authenticated) {
    return (
      <main className="portal-shell">
        <MatchFinderHeader />
        <section className="dashboard-state" aria-label="Match Finder error">
          <p role="alert">Sign in to use the Match Finder.</p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <MatchFinderHeader />
        <section className="dashboard-state" aria-label="Match Finder loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <MatchFinderHeader />
        <section className="dashboard-state" aria-label="Match Finder error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <MatchFinderHeader />
      <section className="scheduling-hero panel">
        <div>
          <p className="eyebrow">{state.data.currentSeason}</p>
          <h2>
            {formatPlayerName(
              state.data.player.player,
              state.data.player.displayName,
            )}
          </h2>
          <p>
            {state.data.progress.gamesCompleted} completed,{' '}
            {state.data.progress.gamesRemaining} remaining.
          </p>
        </div>
        <div className="season-progress-ring">
          <strong>{state.data.progress.completionPercentage}%</strong>
          <span>Season</span>
        </div>
        <div>
          <p className="eyebrow">Recommended Next Match</p>
          <h3>
            {state.data.recommendations[0]
              ? formatPlayerName(
                  state.data.recommendations[0].player,
                  state.data.recommendations[0].displayName,
                )
              : 'No remaining opponent'}
          </h3>
          <p>{state.data.recommendations[0]?.reason ?? 'You are caught up.'}</p>
        </div>
      </section>

      <section className="scheduling-grid">
        <AvailabilityEditor
          confirmation={availabilityMessage}
          data={state.data}
          disabled={working !== ''}
          onSubmit={updateAvailability}
        />
        <ScheduleRequestForm
          disabled={working !== ''}
          initialOpponent={preferredOpponent}
          recommendations={state.data.recommendations}
          onSubmit={createRequest}
        />
      </section>

      <section className="panel scheduling-panel">
        <div className="panel-heading">
          <p className="eyebrow">Match Finder</p>
          <h2>Recommended Opponents</h2>
        </div>
        <div className="scheduling-card-grid">
          {state.data.recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.player}
              recommendation={recommendation}
            />
          ))}
        </div>
      </section>

      <section className="scheduling-grid">
        <RequestList
          actionLabel="Accept"
          empty="No incoming requests."
          onCalendar={exportCalendar}
          onRespond={respondToRequest}
          requests={state.data.requests.incoming}
          title="Incoming Requests"
          working={working}
        />
        <RequestList
          empty="No outgoing requests."
          onCalendar={exportCalendar}
          onRespond={respondToRequest}
          requests={state.data.requests.outgoing}
          title="Outgoing Requests"
          working={working}
        />
      </section>

      <section className="scheduling-grid">
        <RequestList
          empty="No scheduled matches."
          onCalendar={exportCalendar}
          onRespond={respondToRequest}
          requests={state.data.requests.upcoming}
          title="Upcoming Matches"
          working={working}
        />
        <section className="panel scheduling-panel">
          <div className="panel-heading">
            <p className="eyebrow">Season Progress</p>
            <h2>Completion</h2>
          </div>
          <dl className="profile-metric-list">
            <Metric
              label="Division Complete"
              value={`${state.data.seasonProgress.division.completionPercentage}%`}
            />
            <Metric
              label="Division Games Remaining"
              value={state.data.seasonProgress.division.gamesRemaining}
            />
            <Metric
              label="Pending Requests"
              value={state.data.requests.pending.length}
            />
            <Metric
              label="Upcoming Matches"
              value={state.data.requests.upcoming.length}
            />
          </dl>
        </section>
      </section>

      <section className="panel scheduling-panel">
        <div className="panel-heading">
          <p className="eyebrow">Community Activity</p>
          <h2>Scheduling Feed</h2>
        </div>
        <div className="dashboard-news-list">
          {state.data.activity.map((item) => (
            <Link className="dashboard-news-item" key={`${item.type}-${item.timestamp}-${item.title}`} to={item.link || '/match-finder'}>
              <span>{item.type}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}

function MatchFinderHeader() {
  return (
    <section className="page-header">
      <p className="eyebrow">Community Scheduling</p>
      <h1>Match Finder</h1>
      <p>Find online league opponents, compare availability, and send a request in seconds.</p>
    </section>
  )
}

function AvailabilityEditor({
  confirmation,
  data,
  disabled,
  onSubmit,
}: {
  confirmation: string
  data: SchedulingCenterData
  disabled: boolean
  onSubmit: (params: Record<string, string>) => Promise<void>
}) {
  const availability = data.availability

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const params = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
    )

    await onSubmit(params)
  }

  return (
    <section className="panel scheduling-panel" id="availability">
      <div className="panel-heading">
        <p className="eyebrow">Availability</p>
        <h2>My Scheduling Profile</h2>
        {confirmation ? (
          <span className="scheduling-save-confirmation">✓ {confirmation}</span>
        ) : null}
      </div>
      <form className="scheduling-form" onSubmit={(event) => void submit(event)}>
        <label>
          Status
          <select defaultValue={availability.status || 'Available'} name="status">
            <option>Available</option>
            <option>Limited</option>
            <option>Unavailable</option>
          </select>
        </label>
        <label>
          Preferred Days
          <input
            defaultValue={availability.preferredDays}
            name="preferredDays"
            placeholder="Example: Tuesday, Thursday, Sunday"
          />
        </label>
        <label>
          Preferred Time Window
          <input
            defaultValue={availability.preferredTimes}
            name="preferredTimes"
            placeholder="Example: after 7 PM Eastern"
          />
        </label>
        <label>
          Discord Handle
          <input
            defaultValue={availability.discordHandle}
            name="discordHandle"
            placeholder="Example: lobo0705"
          />
        </label>
        <label className="scheduling-form-wide">
          Optional Notes
          <textarea
            defaultValue={availability.notes}
            name="notes"
            placeholder="Anything opponents should know before messaging you."
          />
        </label>
        <button disabled={disabled} type="submit">
          {disabled ? 'Saving...' : 'Save Availability'}
        </button>
      </form>
    </section>
  )
}

function ScheduleRequestForm({
  disabled,
  initialOpponent,
  recommendations,
  onSubmit,
}: {
  disabled: boolean
  initialOpponent: string
  recommendations: SchedulingRecommendation[]
  onSubmit: (params: Record<string, string>) => Promise<void>
}) {
  const defaultOpponent = useMemo(
    () => initialOpponent || recommendations[0]?.player || '',
    [initialOpponent, recommendations],
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const params = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
    )

    await onSubmit(params)
    event.currentTarget.reset()
  }

  return (
    <section className="panel scheduling-panel">
      <div className="panel-heading">
        <p className="eyebrow">Schedule</p>
        <h2>Send Match Request</h2>
      </div>
      <form className="scheduling-form" onSubmit={(event) => void submit(event)}>
        <label>
          Opponent
          <select defaultValue={defaultOpponent} name="opponent" required>
            {recommendations.map((recommendation) => (
              <option key={recommendation.player} value={recommendation.player}>
                {formatPlayerName(recommendation.player, recommendation.displayName)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input name="proposedDate" type="date" required />
        </label>
        <label>
          Time
          <input name="proposedTime" type="time" required />
        </label>
        <label className="scheduling-form-wide">
          Message
          <textarea name="message" placeholder="Optional note for your opponent" />
        </label>
        <button disabled={disabled || recommendations.length === 0} type="submit">
          Send Request
        </button>
      </form>
    </section>
  )
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: SchedulingRecommendation
}) {
  const recommendationLabel = getRecommendationLabel(recommendation)
  const availabilityText =
    recommendation.availabilitySummary || 'No availability added yet.'
  const discordText =
    recommendation.discordHandle || 'Discord handle not provided.'

  return (
    <article className="scheduling-card">
      <div>
        <span>{recommendationLabel}</span>
        <h3>{formatPlayerName(recommendation.player, recommendation.displayName)}</h3>
        <p>{recommendation.reason}</p>
      </div>
      <dl>
        <Metric label="Division" value={recommendation.division} />
        <Metric
          label="Remaining League Match"
          value={
            recommendation.gamesRemainingBetweenPlayers > 0
              ? 'Required'
              : 'Completed'
          }
        />
        <Metric label="Availability" value={availabilityText} />
        <Metric label="Discord" value={discordText} />
      </dl>
      <div className="scheduling-card-actions">
        <Link to={recommendation.profileLink || `/players/${encodeURIComponent(recommendation.player)}`}>
          Profile
        </Link>
        <Link to={`/match-finder?opponent=${encodeURIComponent(recommendation.player)}`}>
          Request Match
        </Link>
      </div>
    </article>
  )
}

function RequestList({
  actionLabel,
  empty,
  onCalendar,
  onRespond,
  requests,
  title,
  working,
}: {
  actionLabel?: string
  empty: string
  onCalendar: (requestId: string) => Promise<void>
  onRespond: (requestId: string, status: string) => Promise<void>
  requests: SchedulingRequest[]
  title: string
  working: string
}) {
  return (
    <section className="panel scheduling-panel">
      <div className="panel-heading">
        <p className="eyebrow">Requests</p>
        <h2>{title}</h2>
      </div>
      {requests.length === 0 ? <p>{empty}</p> : null}
      <div className="dashboard-news-list">
        {requests.map((request) => (
          <article className="dashboard-news-item scheduling-request" key={request.id}>
            <span>{request.status}</span>
            <strong>
              {request.fromPlayer} vs {request.toPlayer}
            </strong>
            <p>
              {request.proposedDate} at {request.proposedTime}
            </p>
            {request.message ? <p>{request.message}</p> : null}
            <div className="scheduling-card-actions">
              {actionLabel ? (
                <>
                  <button
                    disabled={working !== ''}
                    onClick={() => void onRespond(request.id, 'Accepted')}
                    type="button"
                  >
                    {actionLabel}
                  </button>
                  <button
                    disabled={working !== ''}
                    onClick={() => void onRespond(request.id, 'Declined')}
                    type="button"
                  >
                    Decline
                  </button>
                  <button
                    disabled={working !== ''}
                    onClick={() => void onRespond(request.id, 'Suggested')}
                    type="button"
                  >
                    Suggest Another
                  </button>
                </>
              ) : null}
              {request.status === 'Accepted' ? (
                <button
                  disabled={working !== ''}
                  onClick={() => void onCalendar(request.id)}
                  type="button"
                >
                  Calendar
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value === '' ? 'Not provided yet.' : value}</dd>
    </div>
  )
}

function getRecommendationLabel(recommendation: SchedulingRecommendation) {
  if (recommendation.priority === 'High') {
    return 'Priority Opponent'
  }

  if (recommendation.priority === 'Recommended') {
    return 'Excellent Match'
  }

  if (recommendation.reason.toLowerCase().includes('pending')) {
    return 'Request Pending'
  }

  return 'Good Match'
}

export default MatchFinder
