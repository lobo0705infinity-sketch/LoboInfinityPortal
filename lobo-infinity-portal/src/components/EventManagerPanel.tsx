import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  type EventManagerData,
  type EventRegistrationEntry,
} from '../services/api'
import { eventRepository } from '../services/data'
import Loading from './Loading'

type EventManagerState =
  | { status: 'loading' }
  | { data: EventManagerData; status: 'success' }
  | { error: string; status: 'error' }

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

function EventManagerPanel({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<EventManagerState>({ status: 'loading' })
  const [selectedEventId, setSelectedEventId] = useState('event-current-league')
  const initialEventId = useRef('event-current-league')
  const [workingAction, setWorkingAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [eventForm, setEventForm] = useState({
    description: '',
    endDate: '',
    lifecycleStage: '',
    name: '',
    registration: '',
    rules: '',
    scoringModel: '',
    standingsModel: '',
    startDate: '',
    status: '',
    type: 'League',
  })
  const [newEventForm, setNewEventForm] = useState({
    description: '',
    endDate: '',
    name: '',
    registration: 'Registration Closed',
    rules: '',
    startDate: '',
    type: 'Custom',
  })
  const [participantForm, setParticipantForm] = useState({
    captain: 'false',
    displayName: '',
    discord: '',
    email: '',
    freeAgent: 'false',
    player: '',
    preferredTeam: '',
    status: 'Registered',
    team: '',
  })
  const [teamForm, setTeamForm] = useState({
    captain: '',
    discordContact: '',
    factionRestrictions: '',
    players: '',
    status: 'Registered',
    teamId: '',
    teamName: '',
  })
  const [pairingForm, setPairingForm] = useState({
    playerPairings: '',
    results: '',
    round: 'Round 1',
    roundId: '',
    status: 'Scheduled',
    teamA: '',
    teamB: '',
  })

  function applyManagerData(data: EventManagerData) {
    setSelectedEventId(data.selectedEvent.id)
    setEventForm({
      description: data.selectedEvent.description,
      endDate: data.selectedEvent.endDate,
      lifecycleStage: data.selectedEvent.lifecycleStage || 'Planning',
      name: data.selectedEvent.name,
      registration: data.selectedEvent.registration || 'Registration Closed',
      rules: data.selectedEvent.rules,
      scoringModel: data.selectedEvent.scoringModel,
      standingsModel: data.selectedEvent.standingsModel,
      startDate: data.selectedEvent.startDate,
      status: data.selectedEvent.status || 'Planning',
      type: data.selectedEvent.type || 'Custom',
    })
    setState({ data, status: 'success' })
  }

  const loadManager = useCallback(async (eventId = selectedEventId) => {
    setState({ status: 'loading' })

    try {
      const data = await eventRepository.getEventManager(eventId)
      applyManagerData(data)
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : 'Event Manager could not be loaded.',
        status: 'error',
      })
    }
  }, [selectedEventId])

  useEffect(() => {
    const controller = new AbortController()

    eventRepository
      .getEventManager(initialEventId.current, { signal: controller.signal })
      .then(applyManagerData)
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Event Manager could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  async function runManagerAction(
    action: string,
    handler: () => Promise<EventManagerData>,
  ) {
    setWorkingAction(action)
    setActionError('')
    setActionMessage('')

    try {
      const data = await handler()
      applyManagerData(data)
      setActionMessage('Event Manager updated.')
      return data
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Event Manager action failed.',
      )
      throw error
    } finally {
      setWorkingAction('')
    }
  }

  async function setRegistration(registration: string, action: string) {
    await runManagerAction(action, async () => {
      const data = await eventRepository.setRegistration({
        eventId: selectedEventId,
        registration,
      })

      if (data.selectedEvent.registration !== registration) {
        throw new Error(
          `Registration update did not persist. Expected ${registration}; backend returned ${data.selectedEvent.registration || 'blank'}.`,
        )
      }

      return data
    })
  }

  async function saveSelectedEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await runManagerAction('saveEvent', () =>
      eventRepository.saveEvent({
        ...eventForm,
        eventId: selectedEventId,
      }),
    )
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await runManagerAction('createEvent', () =>
      eventRepository.saveEvent({
        ...newEventForm,
        lifecycleStage: 'Planning',
        status: 'Planning',
      }),
    )
  }

  async function applyLifecycle() {
    await runManagerAction('lifecycle', () =>
      eventRepository.setLifecycle({
        eventId: selectedEventId,
        lifecycleStage: eventForm.lifecycleStage,
        status: eventForm.status || eventForm.lifecycleStage,
      }),
    )
  }

  async function selectCurrentEvent(eventId: string) {
    await runManagerAction('currentEvent', () =>
      eventRepository.setCurrentEvent({
        eventId,
      }),
    )
  }

  async function saveParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await runManagerAction('participant', () =>
      eventRepository.saveParticipant({
        ...participantForm,
        eventId: selectedEventId,
      }),
    )
    setParticipantForm((current) => ({
      ...current,
      displayName: '',
      player: '',
    }))
  }

  async function updateParticipantStatus(
    participant: EventRegistrationEntry,
    status: string,
  ) {
    await runManagerAction(`participant-${status}`, () =>
      eventRepository.saveParticipant({
        captain: String(participant.captain),
        discord: participant.discord,
        displayName: participant.displayName,
        email: participant.email,
        eventId: selectedEventId,
        freeAgent: String(participant.freeAgent),
        player: participant.player,
        preferredTeam: participant.preferredTeam,
        status,
        team: participant.team,
      }),
    )
  }

  async function saveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await runManagerAction('team', () =>
      eventRepository.saveTeam({
        ...teamForm,
        eventId: selectedEventId,
      }),
    )
    setTeamForm((current) => ({
      ...current,
      teamId: '',
      teamName: '',
    }))
  }

  async function savePairing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await runManagerAction('pairing', () =>
      eventRepository.savePairing({
        ...pairingForm,
        eventId: selectedEventId,
      }),
    )
  }

  if (state.status === 'loading') {
    return <Loading />
  }

  if (state.status === 'error') {
    return <p role="alert">{state.error}</p>
  }

  const { data } = state
  const isTeamTournament = data.selectedEvent.type === 'Team Tournament'

  return (
    <div className="event-manager">
      <div className="panel-heading">
        <p className="eyebrow">Event Engine</p>
        <h2>Event Manager</h2>
      </div>
      <p>
        Operate Event Engine events from one place: lifecycle, registration,
        participants, teams, pairings, archive state, and the current active
        event.
      </p>
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="form-success" role="status">
          {actionMessage}
        </p>
      ) : null}
      <div className="event-manager-toolbar">
        <label>
          Current Active Event
          <select
            disabled={!canManage || workingAction !== ''}
            onChange={(event) => void selectCurrentEvent(event.target.value)}
            value={data.currentEvent.id}
          >
            {data.events.map((summary) => (
              <option key={summary.event.id} value={summary.event.id}>
                {summary.event.name}
              </option>
            ))}
          </select>
        </label>
        <span>
          Active: <strong>{data.currentEvent.name}</strong>
        </span>
      </div>

      <div className="event-manager-layout">
        <section className="event-manager-list" aria-label="Events">
          {data.events.map((summary) => (
            <button
              className={
                summary.event.id === selectedEventId
                  ? 'event-manager-event active'
                  : 'event-manager-event'
              }
              key={summary.event.id}
              onClick={() => void loadManager(summary.event.id)}
              type="button"
            >
              <strong>{summary.event.name}</strong>
              <span>{summary.event.type}</span>
              <span>{summary.event.lifecycleStage}</span>
              <span>{summary.registrationStatus}</span>
              <span>
                {summary.participantCount} players
                {summary.teamCount > 0 ? ` / ${summary.teamCount} teams` : ''}
              </span>
            </button>
          ))}
        </section>

        <section className="event-manager-detail">
          <div className="event-manager-summary">
            <Metric label="Lifecycle" value={data.diagnostics.lifecycleStage} />
            <Metric label="Registration" value={data.diagnostics.registrationStatus} />
            <Metric label="Participants" value={data.diagnostics.participantCount} />
            <Metric label="Teams" value={data.diagnostics.teamCount} />
            <Metric label="Health" value={data.diagnostics.eventHealth} />
          </div>

          <form className="event-manager-form" onSubmit={saveSelectedEvent}>
            <h3>Event Details</h3>
            <label>
              Name
              <input
                disabled={!canManage}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={eventForm.name}
              />
            </label>
            <label>
              Type
              <EventTypeSelect
                disabled={!canManage}
                onChange={(type) =>
                  setEventForm((current) => ({
                    ...current,
                    type,
                  }))
                }
                value={eventForm.type}
              />
            </label>
            <label>
              Lifecycle
              <select
                disabled={!canManage}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    lifecycleStage: event.target.value,
                  }))
                }
                value={eventForm.lifecycleStage}
              >
                {lifecycleOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Registration
              <RegistrationSelect
                disabled={!canManage}
                onChange={(registration) =>
                  setEventForm((current) => ({
                    ...current,
                    registration,
                  }))
                }
                value={eventForm.registration}
              />
            </label>
            <label>
              Start Date
              <input
                disabled={!canManage}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                type="date"
                value={eventForm.startDate}
              />
            </label>
            <label>
              End Date
              <input
                disabled={!canManage}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                type="date"
                value={eventForm.endDate}
              />
            </label>
            <label className="event-manager-wide">
              Description
              <textarea
                disabled={!canManage}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                value={eventForm.description}
              />
            </label>
            <label className="event-manager-wide">
              Rules
              <textarea
                disabled={!canManage}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    rules: event.target.value,
                  }))
                }
                rows={3}
                value={eventForm.rules}
              />
            </label>
            <div className="event-manager-actions event-manager-wide">
              <button disabled={!canManage || workingAction !== ''} type="submit">
                Save Event
              </button>
              <button
                disabled={!canManage || workingAction !== ''}
                onClick={() => void applyLifecycle()}
                type="button"
              >
                Apply Lifecycle
              </button>
              <button
                disabled={!canManage || workingAction !== ''}
                onClick={() => void setRegistration('Registration Open', 'openRegistration')}
                type="button"
              >
                Open Registration
              </button>
              <button
                disabled={!canManage || workingAction !== ''}
                onClick={() => void setRegistration('Registration Open', 'reopenRegistration')}
                type="button"
              >
                Reopen Registration
              </button>
              <button
                disabled={!canManage || workingAction !== ''}
                onClick={() => void setRegistration('Registration Closed', 'closeRegistration')}
                type="button"
              >
                Close Registration
              </button>
              <button
                disabled={!canManage || workingAction !== ''}
                onClick={() =>
                  void runManagerAction('currentEvent', () =>
                    eventRepository.setCurrentEvent({
                      eventId: selectedEventId,
                    }),
                  )
                }
                type="button"
              >
                Set Current Active Event
              </button>
              <button
                disabled={!canManage || workingAction !== ''}
                onClick={() =>
                  void runManagerAction('archive', () =>
                    eventRepository.setLifecycle({
                      archive: 'Archived',
                      eventId: selectedEventId,
                      lifecycleStage: 'Archived',
                      status: 'Archived',
                    }),
                  )
                }
                type="button"
              >
                Archive
              </button>
            </div>
          </form>

          <ParticipantsPanel
            canManage={canManage}
            form={participantForm}
            onChange={setParticipantForm}
            onStatusChange={updateParticipantStatus}
            onSubmit={saveParticipant}
            participants={data.participants}
            working={workingAction !== ''}
          />

          {isTeamTournament ? (
            <TeamOperationsPanel
              canManage={canManage}
              onPairingChange={setPairingForm}
              onPairingSubmit={savePairing}
              onTeamChange={setTeamForm}
              onTeamSubmit={saveTeam}
              pairingForm={pairingForm}
              pairings={data.pairings}
              teamForm={teamForm}
              teams={data.teams}
              working={workingAction !== ''}
            />
          ) : null}

          <form className="event-manager-form" onSubmit={createEvent}>
            <h3>Create Event</h3>
            <label>
              Event Name
              <input
                disabled={!canManage}
                onChange={(event) =>
                  setNewEventForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={newEventForm.name}
              />
            </label>
            <label>
              Type
              <EventTypeSelect
                disabled={!canManage}
                onChange={(type) =>
                  setNewEventForm((current) => ({
                    ...current,
                    type,
                  }))
                }
                value={newEventForm.type}
              />
            </label>
            <label>
              Start Date
              <input
                disabled={!canManage}
                onChange={(event) =>
                  setNewEventForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                type="date"
                value={newEventForm.startDate}
              />
            </label>
            <label>
              End Date
              <input
                disabled={!canManage}
                onChange={(event) =>
                  setNewEventForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                type="date"
                value={newEventForm.endDate}
              />
            </label>
            <label className="event-manager-wide">
              Description
              <textarea
                disabled={!canManage}
                onChange={(event) =>
                  setNewEventForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={2}
                value={newEventForm.description}
              />
            </label>
            <button disabled={!canManage || workingAction !== ''} type="submit">
              Create Event
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="event-manager-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EventTypeSelect({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean
  onChange: (value: string) => void
  value: string
}) {
  return (
    <select
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option>League</option>
      <option>Team Tournament</option>
      <option>ITS Tournament</option>
      <option>Narrative Campaign</option>
      <option>Casual Event</option>
      <option>Custom</option>
    </select>
  )
}

function RegistrationSelect({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean
  onChange: (value: string) => void
  value: string
}) {
  return (
    <select
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option>Registration Open</option>
      <option>Registration Closed</option>
      <option>Waitlist Open</option>
      <option>Capacity Full</option>
    </select>
  )
}

function ParticipantsPanel({
  canManage,
  form,
  onChange,
  onStatusChange,
  onSubmit,
  participants,
  working,
}: {
  canManage: boolean
  form: ParticipantForm
  onChange: (value: ParticipantForm) => void
  onStatusChange: (
    participant: EventRegistrationEntry,
    status: string,
  ) => Promise<void>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  participants: EventRegistrationEntry[]
  working: boolean
}) {
  return (
    <section className="event-manager-subpanel">
      <h3>Participants</h3>
      <div className="event-manager-table" role="table" aria-label="Event participants">
        {participants.slice(0, 12).map((participant) => (
          <div className="event-manager-row" key={`${participant.eventId}-${participant.player}`}>
            <strong>{participant.displayName || participant.player}</strong>
            <span>{participant.status}</span>
            <span>{participant.team || participant.preferredTeam || 'No team'}</span>
            <span>{participant.captain ? 'Captain' : participant.freeAgent ? 'Free Agent' : 'Player'}</span>
            <div className="event-manager-row-actions">
              <button
                disabled={!canManage || working}
                onClick={() => void onStatusChange(participant, 'Approved')}
                type="button"
              >
                Approve
              </button>
              <button
                disabled={!canManage || working}
                onClick={() => void onStatusChange(participant, 'Waitlisted')}
                type="button"
              >
                Waitlist
              </button>
              <button
                disabled={!canManage || working}
                onClick={() => void onStatusChange(participant, 'Removed')}
                type="button"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <form className="event-manager-form compact" onSubmit={onSubmit}>
        <label>
          Player
          <input
            disabled={!canManage}
            onChange={(event) => onChange({ ...form, player: event.target.value })}
            value={form.player}
          />
        </label>
        <label>
          Display Name
          <input
            disabled={!canManage}
            onChange={(event) =>
              onChange({ ...form, displayName: event.target.value })
            }
            value={form.displayName}
          />
        </label>
        <label>
          Status
          <select
            disabled={!canManage}
            onChange={(event) => onChange({ ...form, status: event.target.value })}
            value={form.status}
          >
            <option>Registered</option>
            <option>Approved</option>
            <option>Waitlisted</option>
            <option>Withdrawn</option>
            <option>Removed</option>
          </select>
        </label>
        <label>
          Team
          <input
            disabled={!canManage}
            onChange={(event) => onChange({ ...form, team: event.target.value })}
            value={form.team}
          />
        </label>
        <button disabled={!canManage || working} type="submit">
          Save Participant
        </button>
      </form>
    </section>
  )
}

function TeamOperationsPanel({
  canManage,
  onPairingChange,
  onPairingSubmit,
  onTeamChange,
  onTeamSubmit,
  pairingForm,
  pairings,
  teamForm,
  teams,
  working,
}: {
  canManage: boolean
  onPairingChange: (value: typeof pairingForm) => void
  onPairingSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTeamChange: (value: typeof teamForm) => void
  onTeamSubmit: (event: FormEvent<HTMLFormElement>) => void
  pairingForm: {
    playerPairings: string
    results: string
    round: string
    roundId: string
    status: string
    teamA: string
    teamB: string
  }
  pairings: EventManagerData['pairings']
  teamForm: {
    captain: string
    discordContact: string
    factionRestrictions: string
    players: string
    status: string
    teamId: string
    teamName: string
  }
  teams: EventManagerData['teams']
  working: boolean
}) {
  return (
    <section className="event-manager-subpanel">
      <h3>Team Tournament Operations</h3>
      <div className="event-manager-table" role="table" aria-label="Teams">
        {teams.map((team) => (
          <div className="event-manager-row" key={team.teamId}>
            <strong>{team.teamName}</strong>
            <span>{team.captain || 'No captain'}</span>
            <span>{team.status}</span>
            <span>{team.players || 'Roster empty'}</span>
          </div>
        ))}
      </div>
      <form className="event-manager-form compact" onSubmit={onTeamSubmit}>
        <label>
          Team Name
          <input
            disabled={!canManage}
            onChange={(event) =>
              onTeamChange({ ...teamForm, teamName: event.target.value })
            }
            value={teamForm.teamName}
          />
        </label>
        <label>
          Captain
          <input
            disabled={!canManage}
            onChange={(event) =>
              onTeamChange({ ...teamForm, captain: event.target.value })
            }
            value={teamForm.captain}
          />
        </label>
        <label className="event-manager-wide">
          Players
          <textarea
            disabled={!canManage}
            onChange={(event) =>
              onTeamChange({ ...teamForm, players: event.target.value })
            }
            rows={2}
            value={teamForm.players}
          />
        </label>
        <button disabled={!canManage || working} type="submit">
          Save Team
        </button>
      </form>

      <div className="event-manager-table" role="table" aria-label="Pairings">
        {pairings.map((pairing) => (
          <div
            className="event-manager-row"
            key={`${pairing.roundId}-${pairing.teamA}-${pairing.teamB}`}
          >
            <strong>{pairing.round}</strong>
            <span>{pairing.teamA}</span>
            <span>vs {pairing.teamB}</span>
            <span>{pairing.status}</span>
          </div>
        ))}
      </div>
      <form className="event-manager-form compact" onSubmit={onPairingSubmit}>
        <label>
          Round
          <input
            disabled={!canManage}
            onChange={(event) =>
              onPairingChange({ ...pairingForm, round: event.target.value })
            }
            value={pairingForm.round}
          />
        </label>
        <label>
          Team A
          <input
            disabled={!canManage}
            onChange={(event) =>
              onPairingChange({ ...pairingForm, teamA: event.target.value })
            }
            value={pairingForm.teamA}
          />
        </label>
        <label>
          Team B
          <input
            disabled={!canManage}
            onChange={(event) =>
              onPairingChange({ ...pairingForm, teamB: event.target.value })
            }
            value={pairingForm.teamB}
          />
        </label>
        <label>
          Status
          <select
            disabled={!canManage}
            onChange={(event) =>
              onPairingChange({ ...pairingForm, status: event.target.value })
            }
            value={pairingForm.status}
          >
            <option>Scheduled</option>
            <option>Published</option>
            <option>Completed</option>
            <option>Closed</option>
          </select>
        </label>
        <button disabled={!canManage || working} type="submit">
          Save Pairing
        </button>
      </form>
    </section>
  )
}

export default EventManagerPanel
