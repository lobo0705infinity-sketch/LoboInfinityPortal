import {
  forwardRef,
  useCallback,
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

type MatchFinderDebugSnapshot = {
  button: {
    boundingRect: Record<string, number>
    childCount: number
    computed: Record<string, string>
    currentHtml: string
    exists: boolean
    formAttribute: string
    height: number
    onClickAttached: boolean
    visible: boolean
    width: number
  }
  domButton: {
    boundingRect: Record<string, number>
    computed: Record<string, string>
    disabled: boolean
    exists: boolean
    formAttribute: string
    id: string
    outerHTML: string
    parentClassName: string
    parentInnerHTML: string
    selector: string
    textContent: string
  }
  css: {
    clippingAncestors: Array<Record<string, string>>
    matchedRules: Array<Record<string, string>>
  }
  componentTree: Array<Record<string, string>>
  domAncestry: Array<Record<string, string>>
  domAssertions: Array<{
    message: string
    pass: boolean
    severity: 'error' | 'ok' | 'warning'
  }>
  eventTrace: string[]
  form: {
    formExists: boolean
    formValidity: boolean
    validation: MatchRequestValidation
  }
  layout: Record<string, string | boolean>
  ownership: Record<string, string>
  parentHtml: {
    actionBarOuterHTML: string
    buttonOuterHTML: string
    parentOuterHTML: string
    grandparentOuterHTML: string
  }
  invariants: Array<{
    message: string
    pass: boolean
    severity: 'error' | 'ok' | 'warning'
  }>
  react: {
    actionLabel: string
    actionStatus: string
    activeOpponent: string
    authenticatedPlayer: string
    isSubmitting: boolean
    recommendationsLength: number
    renderPath: string
    requestDisabled: boolean
    schedulingCenterStatus: MatchFinderState['status']
    selectedOpponent: string
    submitState: string
  }
  timestamp: string
}

function MatchFinder() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const preferredOpponent = searchParams.get('opponent') ?? ''
  const debugEnabled =
    searchParams.get('debug') === 'matchfinder' &&
    auth.isAtLeastRole('Commissioner')
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
          authenticatedPlayer={state.data.player.player}
          debugEnabled={debugEnabled}
          disabled={requestWorking}
          selectedOpponent={selectedOpponent || preferredOpponent}
          recommendations={state.data.recommendations}
          schedulingCenterStatus={state.status}
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
    authenticatedPlayer: string
    debugEnabled: boolean
    disabled: boolean
    selectedOpponent: string
    recommendations: SchedulingRecommendation[]
    schedulingCenterStatus: MatchFinderState['status']
    onOpponentChange: (opponent: string) => void
    onSubmit: (
      params: MatchRequestSubmitParams,
    ) => Promise<MatchRequestSubmitResult>
  }
>(function ScheduleRequestForm(
  {
    authenticatedPlayer,
    debugEnabled,
    disabled,
    selectedOpponent,
    recommendations,
    schedulingCenterStatus,
    onOpponentChange,
    onSubmit,
  },
  ref,
) {
  const navigate = useNavigate()
  const sectionRef = useRef<HTMLElement>(null)
  const actionBarRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
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
  const [eventTrace, setEventTrace] = useState<string[]>([
    'Match request form mounted',
  ])
  const [debugSnapshot, setDebugSnapshot] =
    useState<MatchFinderDebugSnapshot | null>(null)
  const isSubmitting = submitState === 'submitting'
  const hasDraft = Boolean(
    activeOpponent ||
      form.message.trim() ||
      form.proposedDate ||
      form.proposedTime,
  )

  const appendTrace = useCallback((message: string) => {
    setEventTrace((current) => [
      ...current.slice(-11),
      `${new Date().toLocaleTimeString()} - ${message}`,
    ])
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      focusDate() {
        appendTrace('Request Match clicked')
        appendTrace('Opponent selected')
        appendTrace('Scheduling form updated')
        sectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
        window.setTimeout(() => {
          dateInputRef.current?.focus({ preventScroll: true })
          appendTrace('Date focused')
        }, 250)
      },
    }),
    [appendTrace],
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

  const validate = useCallback((current: MatchRequestFormState): MatchRequestValidation => {
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
  }, [activeOpponent])

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
    appendTrace(`${field} updated`)
  }

  function updateOpponent(opponent: string) {
    onOpponentChange(opponent)
    appendTrace(`Opponent selected from form: ${opponent || 'none'}`)
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
    appendTrace('Submit handler invoked')

    const nextValidation = validate(form)
    setValidation(nextValidation)

    if (Object.keys(nextValidation).length > 0) {
      setSubmitState('idle')
      appendTrace('Validation blocked submit')
      return
    }

    setSubmitState('submitting')
    appendTrace('Scheduling API request started')

    try {
      const result = await onSubmit({
        ...form,
        opponent: activeOpponent,
      })
      appendTrace('Scheduling API response received')

      if (!result.outgoingVerified) {
        setSubmitState('error')
        appendTrace('Outgoing refresh verification failed')
        return
      }

      setForm({
        ...initialForm,
      })
      onOpponentChange('')
      setValidation({})
      setSubmitState('success')
      appendTrace('Outgoing Requests refreshed')
      appendTrace('Match request workflow complete')
    } catch {
      setSubmitState('error')
      appendTrace('Scheduling API request failed')
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
  const currentValidation = useMemo(() => validate(form), [form, validate])
  const formValidity = Object.keys(currentValidation).length === 0

  useEffect(() => {
    if (!debugEnabled) {
      return
    }

    const snapshot = buildMatchFinderDebugSnapshot({
      actionBar: actionBarRef.current,
      actionLabel,
      actionStatus,
      activeOpponent,
      authenticatedPlayer,
      button: buttonRef.current,
      eventTrace,
      form: formRef.current,
      formValidity,
      recommendationsLength: recommendations.length,
      requestDisabled,
      schedulingCenterStatus,
      selectedOpponent,
      submitState,
      validation: currentValidation,
    })

    setDebugSnapshot(snapshot)

    snapshot.invariants
      .filter((invariant) => !invariant.pass)
      .forEach((invariant) => {
        recordClientDiagnostic(
          'matchFinderDebug',
          'runtime_invariant_failed',
          0,
          invariant.message,
        )
      })
  }, [
    actionLabel,
    actionStatus,
    activeOpponent,
    authenticatedPlayer,
    currentValidation,
    debugEnabled,
    eventTrace,
    formValidity,
    recommendations.length,
    requestDisabled,
    schedulingCenterStatus,
    selectedOpponent,
    submitState,
  ])

  return (
    <section className="panel scheduling-panel" ref={sectionRef}>
      <div className="panel-heading">
        <p className="eyebrow">Schedule</p>
        <h2>Send Match Request</h2>
      </div>
      <div
        className={`match-request-action-bar ${submitState}`}
        ref={actionBarRef}
      >
        <span aria-live="polite">{actionStatus}</span>
        <button
          data-match-request-click-handler="trace-submit"
          disabled={requestDisabled}
          form={MATCH_REQUEST_FORM_ID}
          ref={buttonRef}
          onClick={() => appendTrace('Send button clicked')}
          type="submit"
        >
          {actionLabel}
        </button>
      </div>
      <form
        className="scheduling-form match-request-form"
        id={MATCH_REQUEST_FORM_ID}
        ref={formRef}
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
      {debugEnabled && debugSnapshot ? (
        <MatchFinderDebugPanel snapshot={debugSnapshot} />
      ) : null}
    </section>
  )
})

function buildMatchFinderDebugSnapshot({
  actionBar,
  actionLabel,
  actionStatus,
  activeOpponent,
  authenticatedPlayer,
  button,
  eventTrace,
  form,
  formValidity,
  recommendationsLength,
  requestDisabled,
  schedulingCenterStatus,
  selectedOpponent,
  submitState,
  validation,
}: {
  actionBar: HTMLDivElement | null
  actionLabel: string
  actionStatus: string
  activeOpponent: string
  authenticatedPlayer: string
  button: HTMLButtonElement | null
  eventTrace: string[]
  form: HTMLFormElement | null
  formValidity: boolean
  recommendationsLength: number
  requestDisabled: boolean
  schedulingCenterStatus: MatchFinderState['status']
  selectedOpponent: string
  submitState: string
  validation: MatchRequestValidation
}): MatchFinderDebugSnapshot {
  const queriedButton = document.querySelector<HTMLButtonElement>(
    '.match-request-action-bar button',
  )
  const buttonStyles = button ? window.getComputedStyle(button) : null
  const queriedButtonStyles = queriedButton
    ? window.getComputedStyle(queriedButton)
    : null
  const rect = button?.getBoundingClientRect()
  const queriedRect = queriedButton?.getBoundingClientRect()
  const boundingRect = rect
    ? {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
      }
    : {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
      }
  const queriedBoundingRect = queriedRect
    ? {
        bottom: Math.round(queriedRect.bottom),
        height: Math.round(queriedRect.height),
        left: Math.round(queriedRect.left),
        right: Math.round(queriedRect.right),
        top: Math.round(queriedRect.top),
        width: Math.round(queriedRect.width),
      }
    : {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
      }
  const computed = buttonStyles
    ? {
        clipPath: buttonStyles.clipPath,
        display: buttonStyles.display,
        height: buttonStyles.height,
        opacity: buttonStyles.opacity,
        overflow: buttonStyles.overflow,
        pointerEvents: buttonStyles.pointerEvents,
        position: buttonStyles.position,
        transform: buttonStyles.transform,
        visibility: buttonStyles.visibility,
        width: buttonStyles.width,
        zIndex: buttonStyles.zIndex,
      }
    : {
        clipPath: '',
        display: '',
        height: '',
        opacity: '',
        overflow: '',
        pointerEvents: '',
        position: '',
        transform: '',
        visibility: '',
        width: '',
        zIndex: '',
      }
  const queriedComputed = queriedButtonStyles
    ? {
        clipPath: queriedButtonStyles.clipPath,
        display: queriedButtonStyles.display,
        height: queriedButtonStyles.height,
        opacity: queriedButtonStyles.opacity,
        overflow: queriedButtonStyles.overflow,
        pointerEvents: queriedButtonStyles.pointerEvents,
        position: queriedButtonStyles.position,
        transform: queriedButtonStyles.transform,
        visibility: queriedButtonStyles.visibility,
        width: queriedButtonStyles.width,
        zIndex: queriedButtonStyles.zIndex,
      }
    : {
        clipPath: '',
        display: '',
        height: '',
        opacity: '',
        overflow: '',
        pointerEvents: '',
        position: '',
        transform: '',
        visibility: '',
        width: '',
        zIndex: '',
      }
  const visible = Boolean(
    button &&
      computed.display !== 'none' &&
      computed.visibility !== 'hidden' &&
      computed.opacity !== '0' &&
      computed.pointerEvents !== 'none' &&
      boundingRect.width > 0 &&
      boundingRect.height > 0,
  )
  const queriedVisible = Boolean(
    queriedButton &&
      queriedComputed.display !== 'none' &&
      queriedComputed.visibility !== 'hidden' &&
      queriedComputed.opacity !== '0' &&
      queriedComputed.pointerEvents !== 'none' &&
      queriedBoundingRect.width > 0 &&
      queriedBoundingRect.height > 0,
  )
  const schedulingPanel = queriedButton?.closest('.scheduling-panel')
  const actionBarElement = queriedButton?.closest('.match-request-action-bar')
  const formElement = document.getElementById(MATCH_REQUEST_FORM_ID)
  const domAssertions = [
    {
      message: 'Actual button selector returns a DOM button.',
      pass: Boolean(queriedButton),
      severity: queriedButton ? 'ok' : 'error',
    },
    {
      message: 'Actual button is visible by computed style and dimensions.',
      pass: queriedVisible,
      severity: queriedVisible ? 'ok' : 'error',
    },
    {
      message: 'Actual button is inside the Match Request action bar.',
      pass: Boolean(actionBarElement),
      severity: actionBarElement ? 'ok' : 'error',
    },
    {
      message: 'Actual button is inside a scheduling panel.',
      pass: Boolean(schedulingPanel),
      severity: schedulingPanel ? 'ok' : 'error',
    },
    {
      message: 'Actual button targets the rendered match request form.',
      pass:
        Boolean(queriedButton) &&
        queriedButton?.getAttribute('form') === MATCH_REQUEST_FORM_ID &&
        Boolean(formElement),
      severity:
        queriedButton?.getAttribute('form') === MATCH_REQUEST_FORM_ID &&
        Boolean(formElement)
          ? 'ok'
          : 'error',
    },
  ] satisfies MatchFinderDebugSnapshot['domAssertions']
  const invariants = [
    {
      message:
        'Ready status requires the Send Match Request button to be rendered.',
      pass: actionStatus !== 'Ready to send your request.' || Boolean(button),
      severity:
        actionStatus !== 'Ready to send your request.' || button
          ? 'ok'
          : 'error',
    },
    {
      message: 'Enabled request state requires the button to be visible.',
      pass: requestDisabled || visible,
      severity: requestDisabled || visible ? 'ok' : 'error',
    },
    {
      message:
        'Ready status should not be shown while the request button is disabled.',
      pass: actionStatus !== 'Ready to send your request.' || !requestDisabled,
      severity:
        actionStatus !== 'Ready to send your request.' || !requestDisabled
          ? 'ok'
          : 'warning',
    },
    {
      message: 'Button form attribute must target the match request form.',
      pass:
        !button ||
        button.getAttribute('form') === MATCH_REQUEST_FORM_ID,
      severity:
        !button || button.getAttribute('form') === MATCH_REQUEST_FORM_ID
          ? 'ok'
          : 'error',
    },
    {
      message: 'The target match request form must exist in the DOM.',
      pass: Boolean(document.getElementById(MATCH_REQUEST_FORM_ID)),
      severity: document.getElementById(MATCH_REQUEST_FORM_ID)
        ? 'ok'
        : 'error',
    },
  ] satisfies MatchFinderDebugSnapshot['invariants']

  return {
    button: {
      boundingRect,
      childCount: actionBar?.children.length ?? 0,
      computed,
      currentHtml: actionBar?.outerHTML.slice(0, 3000) ?? '',
      exists: Boolean(button),
      formAttribute: button?.getAttribute('form') ?? '',
      height: boundingRect.height,
      onClickAttached:
        button?.getAttribute('data-match-request-click-handler') ===
        'trace-submit',
      visible,
      width: boundingRect.width,
    },
    domButton: {
      boundingRect: queriedBoundingRect,
      computed: queriedComputed,
      disabled: queriedButton?.disabled ?? false,
      exists: Boolean(queriedButton),
      formAttribute: queriedButton?.getAttribute('form') ?? '',
      id: queriedButton?.id ?? '',
      outerHTML: queriedButton?.outerHTML.slice(0, 3000) ?? '',
      parentClassName: queriedButton?.parentElement?.className.toString() ?? '',
      parentInnerHTML:
        queriedButton?.parentElement?.innerHTML.slice(0, 5000) ?? '',
      selector: '.match-request-action-bar button',
      textContent: queriedButton?.textContent?.trim() ?? '',
    },
    css: {
      clippingAncestors: getClippingAncestors(queriedButton ?? button),
      matchedRules: getMatchedDebugCssRules(queriedButton ?? button),
    },
    componentTree: [
      {
        component: 'MatchFinder',
        dom: 'main.portal-shell',
        role: 'page owner',
      },
      {
        component: 'ScheduleRequestForm',
        dom: 'section.panel.scheduling-panel',
        parent: 'MatchFinder',
        role: 'match request card owner',
      },
      {
        component: 'MatchRequestActionBar',
        dom: '.match-request-action-bar',
        parent: 'ScheduleRequestForm',
        role: 'status and submit action owner',
      },
      {
        component: 'SendMatchRequestButton',
        dom: '.match-request-action-bar button',
        parent: 'MatchRequestActionBar',
        role: 'submit control',
      },
      {
        component: 'MatchRequestForm',
        dom: `#${MATCH_REQUEST_FORM_ID}`,
        parent: 'ScheduleRequestForm',
        role: 'input owner',
      },
    ],
    domAncestry: getDomAncestry(queriedButton),
    domAssertions,
    eventTrace,
    form: {
      formExists: Boolean(form),
      formValidity,
      validation,
    },
    layout: {
      actionBarChildCount: String(actionBarElement?.children.length ?? 0),
      buttonInsideSchedulingPanel: Boolean(schedulingPanel),
      buttonPortaled: Boolean(
        queriedButton && !queriedButton.closest('.scheduling-panel'),
      ),
      buttonRenderedBelowViewport: queriedBoundingRect.top > window.innerHeight,
      buttonRenderedLeftOfViewport: queriedBoundingRect.right < 0,
      buttonRenderedRightOfViewport: queriedBoundingRect.left > window.innerWidth,
      buttonRenderedWithinViewport:
        queriedBoundingRect.bottom >= 0 &&
        queriedBoundingRect.right >= 0 &&
        queriedBoundingRect.top <= window.innerHeight &&
        queriedBoundingRect.left <= window.innerWidth,
      buttonSelector: '.match-request-action-bar button',
      formExistsById: Boolean(formElement),
      viewportHeight: String(window.innerHeight),
      viewportWidth: String(window.innerWidth),
    },
    invariants,
    ownership: {
      actionBarOwner: 'ScheduleRequestForm',
      buttonOwner: 'ScheduleRequestForm > MatchRequestActionBar',
      parentComponent: 'ScheduleRequestForm',
      parentDomElement:
        queriedButton?.parentElement?.tagName.toLowerCase() ?? '',
      readyTextOwner: 'ScheduleRequestForm > MatchRequestActionBar > span',
      submitHandlerOwner: 'ScheduleRequestForm.submit',
    },
    parentHtml: {
      actionBarOuterHTML: actionBarElement?.outerHTML.slice(0, 8000) ?? '',
      buttonOuterHTML: queriedButton?.outerHTML.slice(0, 4000) ?? '',
      grandparentOuterHTML:
        queriedButton?.parentElement?.parentElement?.outerHTML.slice(0, 8000) ??
        '',
      parentOuterHTML:
        queriedButton?.parentElement?.outerHTML.slice(0, 8000) ?? '',
    },
    react: {
      actionLabel,
      actionStatus,
      activeOpponent,
      authenticatedPlayer,
      isSubmitting: submitState === 'submitting',
      recommendationsLength,
      renderPath: 'MatchFinder > ScheduleRequestForm > action bar',
      requestDisabled,
      schedulingCenterStatus,
      selectedOpponent,
      submitState,
    },
    timestamp: new Date().toISOString(),
  }
}

function getClippingAncestors(element: HTMLElement | null) {
  const ancestors: Array<Record<string, string>> = []
  let current = element?.parentElement ?? null

  while (current && current !== document.body) {
    const styles = window.getComputedStyle(current)
    const isRelevant =
      styles.overflow !== 'visible' ||
      styles.overflowX !== 'visible' ||
      styles.overflowY !== 'visible' ||
      styles.transform !== 'none' ||
      styles.position === 'sticky' ||
      styles.position === 'fixed'

    if (isRelevant) {
      const rect = current.getBoundingClientRect()
      ancestors.push({
        className: current.className.toString(),
        height: String(Math.round(rect.height)),
        overflow: styles.overflow,
        overflowX: styles.overflowX,
        overflowY: styles.overflowY,
        position: styles.position,
        tagName: current.tagName.toLowerCase(),
        transform: styles.transform,
        width: String(Math.round(rect.width)),
        zIndex: styles.zIndex,
      })
    }

    current = current.parentElement
  }

  return ancestors
}

function getDomAncestry(element: HTMLElement | null) {
  const ancestry: Array<Record<string, string>> = []
  let current: HTMLElement | null = element

  while (current) {
    const styles = window.getComputedStyle(current)
    const rect = current.getBoundingClientRect()
    const canClip =
      styles.overflow !== 'visible' ||
      styles.overflowX !== 'visible' ||
      styles.overflowY !== 'visible' ||
      styles.clipPath !== 'none' ||
      styles.contain !== 'none'

    ancestry.push({
      canClipDescendants: String(canClip),
      className: current.className.toString(),
      display: styles.display,
      height: String(Math.round(rect.height)),
      id: current.id,
      opacity: styles.opacity,
      overflow: styles.overflow,
      overflowX: styles.overflowX,
      overflowY: styles.overflowY,
      position: styles.position,
      tag: current.tagName.toLowerCase(),
      transform: styles.transform,
      visibility: styles.visibility,
      width: String(Math.round(rect.width)),
      zIndex: styles.zIndex,
    })

    if (current === document.body) {
      break
    }

    current = current.parentElement
  }

  return ancestry
}

function getMatchedDebugCssRules(element: HTMLElement | null) {
  if (!element) {
    return []
  }

  const rules: Array<Record<string, string>> = []
  const properties = [
    'clip-path',
    'display',
    'height',
    'opacity',
    'overflow',
    'pointer-events',
    'position',
    'transform',
    'visibility',
    'width',
    'z-index',
  ]

  Array.from(document.styleSheets).forEach((sheet) => {
    let cssRules: CSSRuleList

    try {
      cssRules = sheet.cssRules
    } catch {
      return
    }

    Array.from(cssRules).forEach((rule) => {
      if (!(rule instanceof CSSStyleRule)) {
        return
      }

      try {
        if (!element.matches(rule.selectorText)) {
          return
        }
      } catch {
        return
      }

      const declarations = properties
        .map((property) => {
          const value = rule.style.getPropertyValue(property)
          return value ? `${property}: ${value}` : ''
        })
        .filter(Boolean)

      if (declarations.length === 0) {
        return
      }

      rules.push({
        css: declarations.join('; '),
        selector: rule.selectorText,
        source: sheet.href ?? 'inline stylesheet',
      })
    })
  })

  return rules.slice(0, 20)
}

function MatchFinderDebugPanel({
  snapshot,
}: {
  snapshot: MatchFinderDebugSnapshot
}) {
  const [copied, setCopied] = useState(false)
  const [highlighted, setHighlighted] = useState(false)

  async function copyDiagnostics() {
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  function toggleButtonHighlight() {
    const button = document.querySelector<HTMLElement>(
      '.match-request-action-bar button',
    )

    if (!button) {
      return
    }

    if (highlighted) {
      button.removeAttribute('data-match-finder-debug-highlight')
      button.style.removeProperty('outline')
      button.style.removeProperty('background')
      button.style.removeProperty('color')
      button.style.removeProperty('position')
      button.style.removeProperty('bottom')
      button.style.removeProperty('right')
      button.style.removeProperty('z-index')
      button.style.removeProperty('min-width')
      button.style.removeProperty('min-height')
      button.style.removeProperty('box-shadow')
      setHighlighted(false)
      return
    }

    button.setAttribute('data-match-finder-debug-highlight', 'true')
    button.style.setProperty('outline', '5px solid red', 'important')
    button.style.setProperty('background', 'yellow', 'important')
    button.style.setProperty('color', 'black', 'important')
    button.style.setProperty('position', 'fixed', 'important')
    button.style.setProperty('bottom', '20px', 'important')
    button.style.setProperty('right', '20px', 'important')
    button.style.setProperty('z-index', '999999', 'important')
    button.style.setProperty('min-width', '220px', 'important')
    button.style.setProperty('min-height', '56px', 'important')
    button.style.setProperty(
      'box-shadow',
      '0 0 0 8px rgba(255, 0, 0, 0.35)',
      'important',
    )
    setHighlighted(true)
  }

  return (
    <section className="match-finder-debug-panel" aria-label="Match Finder debug">
      <div className="panel-heading">
        <p className="eyebrow">Commissioner Debug</p>
        <h2>Match Finder Runtime Diagnostics</h2>
        <button onClick={toggleButtonHighlight} type="button">
          {highlighted ? 'Remove Button Highlight' : 'Highlight Actual Button'}
        </button>
        <button onClick={() => void copyDiagnostics()} type="button">
          {copied ? 'Copied' : 'Copy Match Finder Diagnostics'}
        </button>
      </div>
      <div className="match-finder-debug-grid">
        <DebugBlock title="React Runtime" value={snapshot.react} />
        <DebugBlock title="Component Tree" value={snapshot.componentTree} />
        <DebugBlock title="Button Ownership" value={snapshot.ownership} />
        <DebugBlock title="Actual Button Selector" value={snapshot.domButton} />
        <DebugBlock title="Button DOM" value={snapshot.button} />
        <DebugBlock title="DOM Ancestry" value={snapshot.domAncestry} />
        <DebugBlock title="Runtime Layout" value={snapshot.layout} />
        <DebugBlock title="Parent HTML" value={snapshot.parentHtml} />
        <DebugBlock title="Form State" value={snapshot.form} />
        <DebugBlock title="Invariant Checks" value={snapshot.invariants} />
        <DebugBlock title="DOM Assertions" value={snapshot.domAssertions} />
        <DebugBlock title="Clipping Ancestors" value={snapshot.css.clippingAncestors} />
        <DebugBlock title="Matched CSS Rules" value={snapshot.css.matchedRules} />
        <DebugBlock title="Event Trace" value={snapshot.eventTrace} />
      </div>
    </section>
  )
}

function DebugBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <article>
      <h3>{title}</h3>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </article>
  )
}

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

