import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { EventRegistrationData, EventRegistrationEntry } from '../services/api'
import { eventRepository, registrationRepository } from '../services/data'
import type { EventCatalog, LeagueEvent } from '../types/dashboard'

type CatalogState =
  | { status: 'loading' }
  | { catalog: EventCatalog; status: 'success' }
  | { error: string; status: 'error' }

type ParticipantForm = {
  captain: string
  displayName: string
  discord: string
  email: string
  freeAgent: string
  player: string
  preferredTeam: string
  status: string
  team: string
}

const lifecycleOptions = [
  'Planning',
  'Registration Open',
  'Registration Closed',
  'Roster Locked',
  'Round 1',
  'Round 2',
  'Final Round',
  'Awards',
  'Archived',
]

function CommissionerEventManager() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return null
  }

  if (!auth.authenticated || !auth.isAtLeastRole('Assistant Commissioner')) {
    return (
      <main className="portal-shell">
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h1>Event Manager</h1>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner account to manage events.
          </p>
        </section>
      </main>
    )
  }

  return <EventManagerWorkspace canManage={auth.hasPermission('runSeasonControl')} />
}

function EventManagerWorkspace({ canManage }: { canManage: boolean }) {
  const location = useLocation()
  const tool = getTool(location.pathname)
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') || ''

  if (tool === 'details') {
    return <EventDetailsTool canManage={canManage} eventId={eventId} />
  }

  if (tool === 'registration') {
    return <EventRegistrationTool canManage={canManage} eventId={eventId} />
  }

  if (tool === 'participants') {
    return <EventParticipantsTool canManage={canManage} eventId={eventId} />
  }

  return <EventManagerLanding canManage={canManage} />
}

function EventManagerLanding({ canManage }: { canManage: boolean }) {
  const { catalog, error, refresh, status } = useEventCatalog()
  const [selectedEventId, setSelectedEventId] = useState('')

  useEffect(() => {
    if (!catalog) return
    setSelectedEventId((current) => current || catalog.currentEvent.id)
  }, [catalog])

  const selectedEvent = catalog?.events.find((event) => event.id === selectedEventId) ?? catalog?.currentEvent ?? null
  const query = selectedEvent ? `?eventId=${encodeURIComponent(selectedEvent.id)}` : ''

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="event-manager-title">
        <p className="eyebrow">Commissioner</p>
        <h1 id="event-manager-title">Event Manager</h1>
        <p>Select an event, then choose the specific administration task.</p>
      </section>

      <section className="panel event-manager" aria-label="Event selector">
        <div className="panel-heading">
          <p className="eyebrow">Event Selector</p>
          <h2>Choose an Event</h2>
        </div>
        {status === 'loading' ? <p aria-live="polite">Loading available events…</p> : null}
        {status === 'error' ? (
          <div>
            <p role="alert">{error}</p>
            <button onClick={() => void refresh()} type="button">Retry Event Selector</button>
          </div>
        ) : null}
        {catalog ? (
          <label>
            Event
            <select
              disabled={!canManage}
              onChange={(event) => setSelectedEventId(event.target.value)}
              value={selectedEvent?.id ?? ''}
            >
              {catalog.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {event.type}{event.id === catalog.currentEvent.id ? ' · Current' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      {selectedEvent ? (
        <>
          <section className="panel" aria-label="Selected event">
            <p className="eyebrow">Selected Event</p>
            <h2>{selectedEvent.name}</h2>
            <p>
              {selectedEvent.type} · {selectedEvent.id === catalog?.currentEvent.id ? 'Current active event' : 'Not the current active event'}
            </p>
            <p>{selectedEvent.lifecycleStage || selectedEvent.status || 'Lifecycle status unavailable'} · {selectedEvent.registration || 'Registration state unavailable'}</p>
          </section>

          <section className="operations-grid" aria-label="Event Manager administration tasks">
            <Link className="panel operations-panel" to={`/commissioner/events/manage/details${query}`}>
              <p className="eyebrow">Administration</p>
              <h2>Event Details &amp; Lifecycle</h2>
              <p className="operations-empty">Edit event identity and dates, manage lifecycle, set the active event, or archive.</p>
            </Link>
            <Link className="panel operations-panel" to={`/commissioner/events/manage/registration${query}`}>
              <p className="eyebrow">Administration</p>
              <h2>Registration</h2>
              <p className="operations-empty">Open, reopen, or close registration without loading the participant roster.</p>
            </Link>
            <Link className="panel operations-panel" to={`/commissioner/events/manage/participants${query}`}>
              <p className="eyebrow">Administration</p>
              <h2>Participants</h2>
              <p className="operations-empty">Load and administer the selected event’s participant roster.</p>
            </Link>
          </section>
        </>
      ) : null}
    </main>
  )
}

function EventDetailsTool({ canManage, eventId }: { canManage: boolean; eventId: string }) {
  const { catalog, error, refresh, status } = useEventCatalog()
  const selectedEvent = resolveSelectedEvent(catalog, eventId)
  const [workingAction, setWorkingAction] = useState('')
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [form, setForm] = useState<LeagueEvent | null>(null)

  useEffect(() => {
    if (selectedEvent) setForm(selectedEvent)
  }, [selectedEvent])

  async function runAction(action: string, handler: () => Promise<unknown>, success: string) {
    setWorkingAction(action)
    setActionError('')
    setMessage('')
    try {
      await handler()
      await refresh()
      setMessage(success)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Event action failed.')
    } finally {
      setWorkingAction('')
    }
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    await runAction('save', () => eventRepository.saveEvent(toEventPayload(form)), 'Event saved.')
  }

  return (
    <EventToolShell
      backTo={`/commissioner/events/manage${selectedEvent ? `?eventId=${encodeURIComponent(selectedEvent.id)}` : ''}`}
      error={error || actionError}
      loading={status === 'loading'}
      onRetry={refresh}
      title="Event Details & Lifecycle"
    >
      {form ? (
        <form className="event-manager-form" onSubmit={saveEvent}>
          <label>Name<input disabled={!canManage} onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} /></label>
          <label>Type<select disabled={!canManage} onChange={(event) => setForm({ ...form, type: event.target.value })} value={form.type}>
            <option>League</option><option>Team Tournament</option><option>Individual Double Elimination</option><option>ITS Tournament</option><option>Narrative Campaign</option><option>Casual Event</option><option>Custom</option>
          </select></label>
          <label>Lifecycle<select disabled={!canManage} onChange={(event) => setForm({ ...form, lifecycleStage: event.target.value })} value={form.lifecycleStage}>
            {lifecycleOptions.map((option) => <option key={option}>{option}</option>)}
          </select></label>
          <label>Start Date<input disabled={!canManage} onChange={(event) => setForm({ ...form, startDate: event.target.value })} type="date" value={form.startDate} /></label>
          <label>End Date<input disabled={!canManage} onChange={(event) => setForm({ ...form, endDate: event.target.value })} type="date" value={form.endDate} /></label>
          <label className="event-manager-wide">Description<textarea disabled={!canManage} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} value={form.description} /></label>
          <label className="event-manager-wide">Rules<textarea disabled={!canManage} onChange={(event) => setForm({ ...form, rules: event.target.value })} rows={3} value={form.rules} /></label>
          <div className="event-manager-actions event-manager-wide">
            <button disabled={!canManage || workingAction !== ''} type="submit">Save Event</button>
            <button disabled={!canManage || workingAction !== ''} onClick={() => void runAction('lifecycle', () => eventRepository.setLifecycle({ eventId: form.id, lifecycleStage: form.lifecycleStage, status: form.status || form.lifecycleStage }), 'Lifecycle updated.')} type="button">Apply Lifecycle</button>
            <button disabled={!canManage || workingAction !== ''} onClick={() => void runAction('current', () => eventRepository.setCurrentEvent({ eventId: form.id }), 'Current active event updated.')} type="button">Set Current Active Event</button>
            <button disabled={!canManage || workingAction !== ''} onClick={() => void runAction('archive', () => eventRepository.setLifecycle({ archive: 'Archived', eventId: form.id, lifecycleStage: 'Archived', status: 'Archived' }), 'Event archived.')} type="button">Archive</button>
          </div>
          <EventActionMessage error={actionError} message={message} />
        </form>
      ) : null}
    </EventToolShell>
  )
}

function EventRegistrationTool({ canManage, eventId }: { canManage: boolean; eventId: string }) {
  const { catalog, error, refresh, status } = useEventCatalog()
  const selectedEvent = resolveSelectedEvent(catalog, eventId)
  const [workingAction, setWorkingAction] = useState('')
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')

  async function setRegistration(registration: string, action: string) {
    if (!selectedEvent) return
    setWorkingAction(action)
    setActionError('')
    setMessage('')
    try {
      await eventRepository.setRegistration({ eventId: selectedEvent.id, registration })
      await refresh()
      setMessage(`Registration ${registration === 'Registration Open' ? 'opened' : 'closed'}.`)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Registration update failed.')
    } finally {
      setWorkingAction('')
    }
  }

  return (
    <EventToolShell
      backTo={`/commissioner/events/manage${selectedEvent ? `?eventId=${encodeURIComponent(selectedEvent.id)}` : ''}`}
      error={error || actionError}
      loading={status === 'loading'}
      onRetry={refresh}
      title="Registration"
    >
      {selectedEvent ? (
        <section className="event-manager-subpanel">
          <p><strong>{selectedEvent.name}</strong></p>
          <p>Current state: {selectedEvent.registration || 'Registration state unavailable'}</p>
          <div className="event-manager-actions">
            <button disabled={!canManage || workingAction !== ''} onClick={() => void setRegistration('Registration Open', 'open')} type="button">Open Registration</button>
            <button disabled={!canManage || workingAction !== ''} onClick={() => void setRegistration('Registration Open', 'reopen')} type="button">Reopen Registration</button>
            <button disabled={!canManage || workingAction !== ''} onClick={() => void setRegistration('Registration Closed', 'close')} type="button">Close Registration</button>
          </div>
          <EventActionMessage error={actionError} message={message} />
        </section>
      ) : null}
    </EventToolShell>
  )
}

function EventParticipantsTool({ canManage, eventId }: { canManage: boolean; eventId: string }) {
  const { catalog, error: catalogError, refresh: refreshCatalog, status: catalogStatus } = useEventCatalog()
  const selectedEvent = resolveSelectedEvent(catalog, eventId)
  const [state, setState] = useState<{ data: EventRegistrationData; status: 'success' } | { error: string; status: 'error' } | { status: 'idle' | 'loading' }>({ status: 'idle' })
  const [workingAction, setWorkingAction] = useState('')
  const [form, setForm] = useState<ParticipantForm>({ captain: 'false', displayName: '', discord: '', email: '', freeAgent: 'false', player: '', preferredTeam: '', status: 'Registered', team: '' })

  async function loadParticipants() {
    if (!selectedEvent) return
    setState({ status: 'loading' })
    try {
      setState({ data: await registrationRepository.getRegistration(selectedEvent.id), status: 'success' })
    } catch (reason) {
      setState({ error: reason instanceof Error ? reason.message : 'Participants could not be loaded.', status: 'error' })
    }
  }

  useEffect(() => {
    void loadParticipants()
    // The roster is intentionally loaded only on the explicit Participants route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent?.id])

  async function saveParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedEvent) return
    setWorkingAction('participant')
    try {
      await eventRepository.saveParticipant({ ...form, eventId: selectedEvent.id })
      setForm((current) => ({ ...current, displayName: '', player: '' }))
      await loadParticipants()
    } finally {
      setWorkingAction('')
    }
  }

  async function updateStatus(participant: EventRegistrationEntry, status: string) {
    if (!selectedEvent) return
    setWorkingAction(`participant-${status}`)
    try {
      await eventRepository.saveParticipant({ captain: String(participant.captain), discord: participant.discord, displayName: participant.displayName, email: participant.email, eventId: selectedEvent.id, freeAgent: String(participant.freeAgent), player: participant.player, preferredTeam: participant.preferredTeam, seed: participant.seed, status, team: participant.team })
      await loadParticipants()
    } finally {
      setWorkingAction('')
    }
  }

  return (
    <EventToolShell
      backTo={`/commissioner/events/manage${selectedEvent ? `?eventId=${encodeURIComponent(selectedEvent.id)}` : ''}`}
      error={catalogError || (state.status === 'error' ? state.error : '')}
      loading={catalogStatus === 'loading'}
      onRetry={refreshCatalog}
      title="Participants"
    >
      {state.status === 'loading' ? <p aria-live="polite">Loading participant roster…</p> : null}
      {state.status === 'success' ? (
        <section className="event-manager-subpanel">
          <p><strong>{state.data.eventName}</strong> · {state.data.registrations.length} participants</p>
          <div className="event-manager-table" role="table" aria-label="Event participants">
            {state.data.registrations.map((participant) => (
              <div className="event-manager-row" key={`${participant.eventId}-${participant.player}`}>
                <strong>{participant.displayName || participant.player}</strong><span>{participant.status}</span><span>{participant.team || participant.preferredTeam || 'No team'}</span>
                <div className="event-manager-row-actions">
                  <button disabled={!canManage || workingAction !== ''} onClick={() => void updateStatus(participant, 'Approved')} type="button">Approve</button>
                  <button disabled={!canManage || workingAction !== ''} onClick={() => void updateStatus(participant, 'Waitlisted')} type="button">Waitlist</button>
                  <button disabled={!canManage || workingAction !== ''} onClick={() => void updateStatus(participant, 'Removed')} type="button">Remove</button>
                </div>
              </div>
            ))}
          </div>
          <form className="event-manager-form compact" onSubmit={saveParticipant}>
            <label>Player<input disabled={!canManage} onChange={(event) => setForm({ ...form, player: event.target.value })} value={form.player} /></label>
            <label>Display Name<input disabled={!canManage} onChange={(event) => setForm({ ...form, displayName: event.target.value })} value={form.displayName} /></label>
            <label>Status<select disabled={!canManage} onChange={(event) => setForm({ ...form, status: event.target.value })} value={form.status}><option>Registered</option><option>Approved</option><option>Waitlisted</option><option>Withdrawn</option><option>Removed</option></select></label>
            <label>Team<input disabled={!canManage} onChange={(event) => setForm({ ...form, team: event.target.value })} value={form.team} /></label>
            <button disabled={!canManage || workingAction !== ''} type="submit">Save Participant</button>
          </form>
        </section>
      ) : null}
    </EventToolShell>
  )
}

function EventToolShell({ backTo, children, error, loading, onRetry, title }: { backTo: string; children: ReactNode; error: string; loading: boolean; onRetry: () => Promise<void>; title: string }) {
  return (
    <main className="portal-shell">
      <section className="page-header">
        <p className="eyebrow">Event Manager</p>
        <h1>{title}</h1>
        <Link to={backTo}>Back to Event Manager</Link>
      </section>
      <section className="panel">
        {loading ? <p aria-live="polite">Loading selected event…</p> : null}
        {error ? <div><p role="alert">{error}</p><button onClick={() => void onRetry()} type="button">Retry</button></div> : null}
        {!loading && !error ? children : null}
      </section>
    </main>
  )
}

function EventActionMessage({ error, message }: { error: string; message: string }) {
  return <div aria-live="polite" className="event-manager-wide">{error ? <p className="form-error" role="alert">{error}</p> : null}{message ? <p className="form-success" role="status">{message}</p> : null}</div>
}

function useEventCatalog() {
  const [state, setState] = useState<CatalogState>({ status: 'loading' })

  const refresh = async () => {
    setState({ status: 'loading' })
    try {
      setState({ catalog: await eventRepository.getEvents(), status: 'success' })
    } catch (reason) {
      setState({ error: reason instanceof Error ? reason.message : 'Events could not be loaded.', status: 'error' })
    }
  }

  useEffect(() => { void refresh() }, [])

  return {
    catalog: state.status === 'success' ? state.catalog : null,
    error: state.status === 'error' ? state.error : '',
    refresh,
    status: state.status,
  }
}

function resolveSelectedEvent(catalog: EventCatalog | null, eventId: string) {
  if (!catalog) return null
  return catalog.events.find((event) => event.id === eventId) ?? catalog.currentEvent
}

function getTool(pathname: string) {
  if (pathname.endsWith('/details')) return 'details'
  if (pathname.endsWith('/registration')) return 'registration'
  if (pathname.endsWith('/participants')) return 'participants'
  return 'landing'
}

function toEventPayload(event: LeagueEvent) {
  return {
    description: event.description,
    endDate: event.endDate,
    eventId: event.id,
    lifecycleStage: event.lifecycleStage,
    name: event.name,
    registration: event.registration,
    rules: event.rules,
    scoringModel: event.scoringModel,
    standingsModel: event.standingsModel,
    startDate: event.startDate,
    status: event.status,
    type: event.type,
  }
}

export default CommissionerEventManager
