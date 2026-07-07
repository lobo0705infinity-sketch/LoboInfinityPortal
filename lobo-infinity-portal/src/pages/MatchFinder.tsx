import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import {
  apiClient,
  type SeasonAvailability,
  type SchedulingCenterData,
  type SchedulingRecommendation,
  type SchedulingRequest,
} from '../services/api'
import { recordClientDiagnostic } from '../services/apiCore'
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

type AvailabilityFormState = {
  discordHandle: string
  notes: string
  preferredDays: string
  preferredTimes: string
  status: string
}

type AvailabilitySaveResult = {
  data: SchedulingCenterData
  durationMs: number
  verified: boolean
}

type MatchRequestSubmitParams = MatchRequestFormState & {
  opponent: string
}

type MatchRequestSubmitResult = {
  data: SchedulingCenterData
  durationMs: number
  outgoingVerified: boolean
}

type MatchRequestFormState = {
  message: string
  proposedDate: string
  proposedTime: string
}

type MatchRequestValidation = Partial<
  Record<'opponent' | 'proposedDate' | 'proposedTime', string>
>

type ScheduleRequestFormHandle = {
  focusDate: () => void
}

function MatchFinder() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const preferredOpponent = searchParams.get('opponent') ?? ''
  const [state, setState] = useState<MatchFinderState>({ status: 'loading' })
  const [availabilityWorking, setAvailabilityWorking] = useState(false)
  const [requestWorking, setRequestWorking] = useState(false)
  const [responseWorking, setResponseWorking] = useState('')
  const [selectedOpponent, setSelectedOpponent] = useState(preferredOpponent)
  const requestFormRef = useRef<ScheduleRequestFormHandle>(null)

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

  async function updateAvailability(
    params: AvailabilityFormState,
  ): Promise<AvailabilitySaveResult> {
    setAvailabilityWorking(true)
    recordClientDiagnostic('availabilitySave', 'attempt', 0, 'started')
    const start = performance.now()

    try {
      const data = await apiClient.updateSchedulingAvailability(params)
      setState({ data, status: 'success' })
      const durationMs = performance.now() - start
      const verified = isAvailabilityPersistenceVerified(
        params,
        data.availability,
      )

      recordClientDiagnostic(
        'availabilitySave',
        verified ? 'success' : 'verification_failed',
        durationMs,
        verified
          ? 'saved profile matched refreshed scheduling payload'
          : getAvailabilityMismatchDetail(params, data.availability),
      )

      return {
        data,
        durationMs,
        verified,
      }
    } catch (error) {
      recordClientDiagnostic(
        'availabilitySave',
        'failure',
        performance.now() - start,
        error instanceof Error ? error.message : 'unknown error',
      )
      throw error
    } finally {
      setAvailabilityWorking(false)
    }
  }

  async function createRequest(
    params: MatchRequestSubmitParams,
  ): Promise<MatchRequestSubmitResult> {
    setRequestWorking(true)
    const start = performance.now()
    recordClientDiagnostic(
      'matchRequest',
      'attempt',
      0,
      `submit started for ${params.opponent || 'unknown opponent'}`,
    )

    try {
      const data = await apiClient.createSchedulingRequest(params)
      const durationMs = performance.now() - start
      const outgoingVerified = isOutgoingRequestRefreshed(params, data)
      setState({ data, status: 'success' })
      recordClientDiagnostic(
        'matchRequest',
        outgoingVerified ? 'success' : 'outgoing_refresh_failed',
        durationMs,
        outgoingVerified
          ? `request created and outgoing list refreshed for ${params.opponent}`
          : getOutgoingRequestMismatchDetail(params, data),
      )

      return {
        data,
        durationMs,
        outgoingVerified,
      }
    } catch (error) {
      recordClientDiagnostic(
        'matchRequest',
        'failure',
        performance.now() - start,
        error instanceof Error ? error.message : 'unknown error',
      )
      throw error
    } finally {
      setRequestWorking(false)
    }
  }

  function requestOpponent(opponent: string) {
    setSelectedOpponent(opponent)
    recordClientDiagnostic(
      'matchRequest',
      'attempt',
      0,
      `opponent selected from recommendation card: ${opponent}`,
    )
    window.setTimeout(() => {
      requestFormRef.current?.focusDate()
    }, 0)
  }

  async function respondToRequest(requestId: string, status: string) {
    setResponseWorking(requestId)
    try {
      const data = await apiClient.respondSchedulingRequest({
        requestId,
        status,
      })
      setState({ data, status: 'success' })
    } finally {
      setResponseWorking('')
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
          data={state.data}
          disabled={availabilityWorking}
          key={state.data.availability.updatedAt || state.data.player.player}
          onSubmit={updateAvailability}
        />
        <ScheduleRequestForm
          ref={requestFormRef}
          disabled={requestWorking}
          selectedOpponent={selectedOpponent || preferredOpponent}
          recommendations={state.data.recommendations}
          onOpponentChange={setSelectedOpponent}
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
              onRequest={requestOpponent}
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
          working={responseWorking}
        />
        <RequestList
          empty="No outgoing requests."
          onCalendar={exportCalendar}
          onRespond={respondToRequest}
          requests={state.data.requests.outgoing}
          title="Outgoing Requests"
          working={responseWorking}
        />
      </section>

      <section className="scheduling-grid">
        <RequestList
          empty="No scheduled matches."
          onCalendar={exportCalendar}
          onRespond={respondToRequest}
          requests={state.data.requests.upcoming}
          title="Upcoming Matches"
          working={responseWorking}
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

function getAvailabilityMismatchDetail(
  expected: AvailabilityFormState,
  actual: SeasonAvailability,
) {
  const fields: Array<keyof AvailabilityFormState> = [
    'discordHandle',
    'notes',
    'preferredDays',
    'preferredTimes',
    'status',
  ]

  const mismatches = fields
    .filter(
      (field) =>
        normalizeAvailabilityValue(expected[field]) !==
        normalizeAvailabilityValue(actual[field]),
    )
    .map((field) => `${field}: expected "${expected[field]}", received "${actual[field]}"`)

  return mismatches.length > 0
    ? `verification mismatch: ${mismatches.join('; ')}`
    : 'verification failed without a field mismatch'
}

function isOutgoingRequestRefreshed(
  submitted: MatchRequestSubmitParams,
  data: SchedulingCenterData,
) {
  return data.requests.outgoing.some((request) =>
    isSchedulingRequestMatch(submitted, request),
  )
}

function getOutgoingRequestMismatchDetail(
  submitted: MatchRequestSubmitParams,
  data: SchedulingCenterData,
) {
  const latestOutgoing = data.requests.outgoing[0]

  if (!latestOutgoing) {
    return `request submitted for ${submitted.opponent}, but refreshed outgoing list is empty`
  }

  return [
    `request submitted for ${submitted.opponent}, but refreshed outgoing list did not include it`,
    `latest outgoing: ${latestOutgoing.toPlayer} ${latestOutgoing.proposedDate} ${latestOutgoing.proposedTime}`,
  ].join('; ')
}

function isSchedulingRequestMatch(
  submitted: MatchRequestSubmitParams,
  request: SchedulingRequest,
) {
  return (
    normalizeSchedulingRequestValue(request.toPlayer) ===
      normalizeSchedulingRequestValue(submitted.opponent) &&
    normalizeSchedulingRequestValue(request.proposedDate) ===
      normalizeSchedulingRequestValue(submitted.proposedDate) &&
    normalizeSchedulingRequestValue(request.proposedTime) ===
      normalizeSchedulingRequestValue(submitted.proposedTime) &&
    normalizeSchedulingRequestValue(request.message) ===
      normalizeSchedulingRequestValue(submitted.message) &&
    normalizeSchedulingRequestValue(request.status) === 'pending'
  )
}

function normalizeSchedulingRequestValue(value: string) {
  return value.trim().toLowerCase()
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
  data,
  disabled,
  onSubmit,
}: {
  data: SchedulingCenterData
  disabled: boolean
  onSubmit: (params: AvailabilityFormState) => Promise<AvailabilitySaveResult>
}) {
  const navigate = useNavigate()
  const initialForm = useMemo(
    () => normalizeAvailabilityForm(data.availability),
    [data.availability],
  )
  const [savedForm, setSavedForm] = useState(initialForm)
  const [form, setForm] = useState(initialForm)
  const [saveState, setSaveState] = useState<
    'error' | 'saved' | 'saving' | 'success' | 'verifyError'
  >('saved')
  const [pendingNavigation, setPendingNavigation] = useState('')
  const isDirty = !areAvailabilityFormsEqual(form, savedForm)
  const isSaving = saveState === 'saving'

  useEffect(() => {
    if (saveState !== 'success') {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setSaveState('saved')
    }, 3000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [saveState])

  useEffect(() => {
    if (!isDirty) {
      return undefined
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) {
      return undefined
    }

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]')

      if (!(anchor instanceof HTMLAnchorElement)) {
        return
      }

      if (
        anchor.target ||
        anchor.download ||
        anchor.href === window.location.href
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setPendingNavigation(anchor.href)
    }

    document.addEventListener('click', onClick, true)

    return () => {
      document.removeEventListener('click', onClick, true)
    }
  }, [isDirty])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isDirty || isSaving) {
      return
    }

    setSaveState('saving')

    try {
      const result = await onSubmit(form)

      if (!result.verified) {
        setSaveState('verifyError')
        return
      }

      const verifiedForm = normalizeAvailabilityForm(result.data.availability)
      setSavedForm(verifiedForm)
      setForm(verifiedForm)
      setSaveState('success')
    } catch {
      setSaveState('error')
    }
  }

  function updateField(field: keyof AvailabilityFormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))

    if (saveState !== 'saving') {
      setSaveState('saved')
    }
  }

  function discardAndNavigate() {
    if (!pendingNavigation) {
      return
    }

    const target = new URL(pendingNavigation)
    setPendingNavigation('')

    if (target.origin === window.location.origin) {
      navigate(`${target.pathname}${target.search}${target.hash}`)
      return
    }

    window.location.href = target.href
  }

  const status = getAvailabilitySaveStatus(saveState, isDirty)
  const controlsDisabled = disabled || isSaving

  return (
    <section className="panel scheduling-panel" id="availability">
      <div className="panel-heading">
        <p className="eyebrow">Availability</p>
        <h2>My Scheduling Profile</h2>
        <span className={`scheduling-save-confirmation ${status.tone}`}>
          {status.label}
        </span>
      </div>
      <div className="availability-save-bar">
        <span
          aria-live="polite"
          className={`scheduling-save-confirmation ${status.tone}`}
        >
          {status.label}
        </span>
        <button
          disabled={!isDirty || controlsDisabled}
          form="availability-profile-form"
          type="submit"
        >
          {isSaving ? 'Saving Availability...' : 'Save Availability'}
        </button>
      </div>
      <form
        className="scheduling-form"
        id="availability-profile-form"
        onSubmit={(event) => void submit(event)}
      >
        <label>
          Status
          <select
            disabled={controlsDisabled}
            name="status"
            value={form.status}
            onChange={(event) => updateField('status', event.target.value)}
          >
            <option>Available</option>
            <option>Limited</option>
            <option>Unavailable</option>
          </select>
        </label>
        <label>
          Preferred Days
          <input
            disabled={controlsDisabled}
            name="preferredDays"
            placeholder="Example: Tuesday, Thursday, Sunday"
            value={form.preferredDays}
            onChange={(event) =>
              updateField('preferredDays', event.target.value)
            }
          />
        </label>
        <label>
          Preferred Time Window
          <input
            disabled={controlsDisabled}
            name="preferredTimes"
            placeholder="Example: after 7 PM Eastern"
            value={form.preferredTimes}
            onChange={(event) =>
              updateField('preferredTimes', event.target.value)
            }
          />
        </label>
        <label>
          Discord Handle
          <input
            disabled={controlsDisabled}
            name="discordHandle"
            placeholder="Example: lobo0705"
            value={form.discordHandle}
            onChange={(event) =>
              updateField('discordHandle', event.target.value)
            }
          />
        </label>
        <label className="scheduling-form-wide">
          Optional Notes
          <textarea
            disabled={controlsDisabled}
            name="notes"
            placeholder="Anything opponents should know before messaging you."
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
          />
        </label>
        {saveState === 'error' ? (
          <p className="scheduling-save-error" role="alert">
            Unable to save availability. Please try again.
          </p>
        ) : null}
        {saveState === 'verifyError' ? (
          <p className="scheduling-save-error" role="alert">
            Unable to verify saved availability. Please try again.
          </p>
        ) : null}
      </form>
      {pendingNavigation ? (
        <div
          aria-labelledby="availability-leave-title"
          aria-modal="true"
          className="availability-leave-dialog"
          role="dialog"
        >
          <div>
            <h3 id="availability-leave-title">
              You have unsaved availability changes.
            </h3>
            <p>Leave without saving?</p>
            <div className="scheduling-card-actions">
              <button onClick={() => setPendingNavigation('')} type="button">
                Stay
              </button>
              <button onClick={discardAndNavigate} type="button">
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function normalizeAvailabilityForm(
  availability: SeasonAvailability,
): AvailabilityFormState {
  return {
    discordHandle: availability.discordHandle || '',
    notes: availability.notes || '',
    preferredDays: availability.preferredDays || '',
    preferredTimes: availability.preferredTimes || '',
    status: availability.status || 'Available',
  }
}

function areAvailabilityFormsEqual(
  left: AvailabilityFormState,
  right: AvailabilityFormState,
) {
  return (
    normalizeAvailabilityValue(left.discordHandle) ===
      normalizeAvailabilityValue(right.discordHandle) &&
    normalizeAvailabilityValue(left.notes) ===
      normalizeAvailabilityValue(right.notes) &&
    normalizeAvailabilityValue(left.preferredDays) ===
      normalizeAvailabilityValue(right.preferredDays) &&
    normalizeAvailabilityValue(left.preferredTimes) ===
      normalizeAvailabilityValue(right.preferredTimes) &&
    normalizeAvailabilityValue(left.status) ===
      normalizeAvailabilityValue(right.status)
  )
}

function isAvailabilityPersistenceVerified(
  submitted: AvailabilityFormState,
  reloaded: SeasonAvailability,
) {
  return areAvailabilityFormsEqual(submitted, normalizeAvailabilityForm(reloaded))
}

function normalizeAvailabilityValue(value: string) {
  return value.trim()
}

function getAvailabilitySaveStatus(
  saveState: 'error' | 'saved' | 'saving' | 'success' | 'verifyError',
  isDirty: boolean,
) {
  const statusLabels = {
    dirty: '\u25cf Unsaved Changes',
    error: 'Save Needs Attention',
    saved: '\u2713 All Changes Saved',
    saving: 'Saving Availability...',
    success: '\u2713 Availability Saved',
  }

  if (saveState === 'saving') {
    return {
      label: statusLabels.saving,
      tone: 'saving',
    }
  }

  if (saveState === 'success') {
    return {
      label: statusLabels.success,
      tone: 'saved',
    }
  }

  if (saveState === 'error' || saveState === 'verifyError') {
    return {
      label: statusLabels.error,
      tone: 'error',
    }
  }

  if (isDirty) {
    return {
      label: statusLabels.dirty,
      tone: 'dirty',
    }
  }

  return {
    label: statusLabels.saved,
    tone: 'saved',
  }
}

const MATCH_REQUEST_FORM_ID = 'match-request-form'

const ScheduleRequestForm = forwardRef<
  ScheduleRequestFormHandle,
  {
    disabled: boolean
    selectedOpponent: string
    recommendations: SchedulingRecommendation[]
    onOpponentChange: (opponent: string) => void
    onSubmit: (
      params: MatchRequestSubmitParams,
    ) => Promise<MatchRequestSubmitResult>
  }
>(function ScheduleRequestForm(
  {
    disabled,
    selectedOpponent,
    recommendations,
    onOpponentChange,
    onSubmit,
  },
  ref,
) {
  const navigate = useNavigate()
  const sectionRef = useRef<HTMLElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const activeOpponent = selectedOpponent
  const initialForm = useMemo<MatchRequestFormState>(
    () => ({
      message: '',
      proposedDate: '',
      proposedTime: '',
    }),
    [],
  )
  const [form, setForm] = useState(initialForm)
  const [submitState, setSubmitState] = useState<
    'error' | 'idle' | 'submitting' | 'success'
  >('idle')
  const [validation, setValidation] = useState<MatchRequestValidation>({})
  const [pendingNavigation, setPendingNavigation] = useState('')
  const isSubmitting = submitState === 'submitting'
  const hasDraft = Boolean(
    activeOpponent ||
      form.message.trim() ||
      form.proposedDate ||
      form.proposedTime,
  )

  useImperativeHandle(
    ref,
    () => ({
      focusDate() {
        sectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
        window.setTimeout(() => {
          dateInputRef.current?.focus({ preventScroll: true })
        }, 250)
      },
    }),
    [],
  )

  useEffect(() => {
    if (!hasDraft || submitState === 'success') {
      return undefined
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [hasDraft, submitState])

  useEffect(() => {
    if (!hasDraft || submitState === 'success') {
      return undefined
    }

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]')

      if (!(anchor instanceof HTMLAnchorElement)) {
        return
      }

      if (
        anchor.target ||
        anchor.download ||
        anchor.href === window.location.href
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setPendingNavigation(anchor.href)
    }

    document.addEventListener('click', onClick, true)

    return () => {
      document.removeEventListener('click', onClick, true)
    }
  }, [hasDraft, submitState])

  useEffect(() => {
    if (submitState !== 'success') {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setSubmitState('idle')
    }, 3000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [submitState])

  function validate(current: MatchRequestFormState): MatchRequestValidation {
    const nextValidation: MatchRequestValidation = {}

    if (!activeOpponent) {
      nextValidation.opponent = 'Choose an opponent.'
    }

    if (!current.proposedDate) {
      nextValidation.proposedDate = 'Choose a date.'
    }

    if (!current.proposedTime) {
      nextValidation.proposedTime = 'Choose a time.'
    }

    return nextValidation
  }

  function updateField(field: keyof MatchRequestFormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
    setValidation((current) => {
      if (!(field in current)) {
        return current
      }

      const next = { ...current }
      delete next[field as keyof MatchRequestValidation]
      return next
    })

    if (submitState !== 'submitting') {
      setSubmitState('idle')
    }
  }

  function updateOpponent(opponent: string) {
    onOpponentChange(opponent)
    setValidation((current) => {
      if (!current.opponent) {
        return current
      }

      const next = { ...current }
      delete next.opponent
      return next
    })

    if (submitState !== 'submitting') {
      setSubmitState('idle')
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextValidation = validate(form)
    setValidation(nextValidation)

    if (Object.keys(nextValidation).length > 0) {
      setSubmitState('idle')
      return
    }

    setSubmitState('submitting')

    try {
      const result = await onSubmit({
        ...form,
        opponent: activeOpponent,
      })

      if (!result.outgoingVerified) {
        setSubmitState('error')
        return
      }

      setForm({
        ...initialForm,
      })
      onOpponentChange('')
      setValidation({})
      setSubmitState('success')
    } catch {
      setSubmitState('error')
    }
  }

  function discardAndNavigate() {
    if (!pendingNavigation) {
      return
    }

    const target = new URL(pendingNavigation)
    setPendingNavigation('')

    if (target.origin === window.location.origin) {
      navigate(`${target.pathname}${target.search}${target.hash}`)
      return
    }

    window.location.href = target.href
  }

  const requestDisabled = disabled || recommendations.length === 0 || isSubmitting
  const actionLabel =
    submitState === 'submitting'
      ? 'Sending Match Request...'
      : submitState === 'success'
        ? '\u2713 Match Request Sent'
        : 'Send Match Request'
  const actionStatus =
    submitState === 'success'
      ? '\u2713 Match Request Sent'
      : submitState === 'error'
        ? 'Unable to send request. Please try again.'
        : disabled && !isSubmitting
          ? 'Another scheduling action is in progress.'
          : recommendations.length === 0
          ? 'No remaining opponents are available for requests.'
          : Object.keys(validation).length > 0
            ? 'Complete the required fields to send your request.'
            : 'Ready to send your request.'

  return (
    <section className="panel scheduling-panel" ref={sectionRef}>
      <div className="panel-heading">
        <p className="eyebrow">Schedule</p>
        <h2>Send Match Request</h2>
      </div>
      <div className={`match-request-action-bar ${submitState}`}>
        <span aria-live="polite">{actionStatus}</span>
        <button
          disabled={requestDisabled}
          form={MATCH_REQUEST_FORM_ID}
          type="submit"
        >
          {actionLabel}
        </button>
      </div>
      <form
        className="scheduling-form match-request-form"
        id={MATCH_REQUEST_FORM_ID}
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <label>
          Opponent
          <select
            aria-describedby={
              validation.opponent ? 'match-request-opponent-error' : undefined
            }
            aria-invalid={validation.opponent ? 'true' : undefined}
            disabled={isSubmitting}
            name="opponent"
            onChange={(event) => updateOpponent(event.target.value)}
            required
            value={activeOpponent}
          >
            <option value="">Choose an opponent</option>
            {recommendations.map((recommendation) => (
              <option key={recommendation.player} value={recommendation.player}>
                {formatPlayerName(recommendation.player, recommendation.displayName)}
              </option>
            ))}
          </select>
          {validation.opponent ? (
            <span
              className="match-request-field-error"
              id="match-request-opponent-error"
            >
              {validation.opponent}
            </span>
          ) : null}
        </label>
        <label>
          Date
          <input
            aria-describedby={
              validation.proposedDate ? 'match-request-date-error' : undefined
            }
            aria-invalid={validation.proposedDate ? 'true' : undefined}
            disabled={isSubmitting}
            name="proposedDate"
            ref={dateInputRef}
            onChange={(event) => updateField('proposedDate', event.target.value)}
            required
            type="date"
            value={form.proposedDate}
          />
          {validation.proposedDate ? (
            <span
              className="match-request-field-error"
              id="match-request-date-error"
            >
              {validation.proposedDate}
            </span>
          ) : null}
        </label>
        <label>
          Time
          <input
            aria-describedby={
              validation.proposedTime ? 'match-request-time-error' : undefined
            }
            aria-invalid={validation.proposedTime ? 'true' : undefined}
            disabled={isSubmitting}
            name="proposedTime"
            onChange={(event) => updateField('proposedTime', event.target.value)}
            required
            type="time"
            value={form.proposedTime}
          />
          {validation.proposedTime ? (
            <span
              className="match-request-field-error"
              id="match-request-time-error"
            >
              {validation.proposedTime}
            </span>
          ) : null}
        </label>
        <label className="scheduling-form-wide">
          Message
          <textarea
            disabled={isSubmitting}
            name="message"
            onChange={(event) => updateField('message', event.target.value)}
            placeholder="Optional note for your opponent"
            value={form.message}
          />
        </label>
      </form>
      {pendingNavigation ? (
        <div
          aria-labelledby="match-request-leave-title"
          className="availability-leave-dialog"
          role="dialog"
        >
          <div>
            <h3 id="match-request-leave-title">Unfinished Match Request</h3>
            <p>You have an unfinished match request. Leave without sending?</p>
            <div className="scheduling-card-actions">
              <button type="button" onClick={() => setPendingNavigation('')}>
                Stay
              </button>
              <button type="button" onClick={discardAndNavigate}>
                Discard
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
})

function RecommendationCard({
  onRequest,
  recommendation,
}: {
  onRequest: (opponent: string) => void
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
        <button onClick={() => onRequest(recommendation.player)} type="button">
          Request Match
        </button>
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

