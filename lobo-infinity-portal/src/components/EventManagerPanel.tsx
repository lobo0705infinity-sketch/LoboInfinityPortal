import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  apiClient,
  type EventBracketData,
  type EventManagerData,
  type EventRegistrationEntry,
} from '../services/api'
import { eventRepository } from '../services/data'
import { isCanonicalMission } from '../config/missions'
import {
  getPublicMissionGeistCatalog,
  type MissionGeistCatalogMission,
} from '../services/publicSnapshot'
import Skeleton from './Skeleton'
import TeamPairingEditor from './TeamPairingEditor'

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

export type EventManagerFocus = 'all' | 'league' | 'top40' | 'team'

function EventManagerPanel({
  canManage,
  focus = 'all',
  initialEventId = 'event-current-league',
}: {
  canManage: boolean
  focus?: EventManagerFocus
  initialEventId?: string
}) {
  const [state, setState] = useState<EventManagerState>({ status: 'loading' })
  const [selectedEventId, setSelectedEventId] = useState(initialEventId)
  const initialEventIdRef = useRef(initialEventId)
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
  const [leagueOperationsForm, setLeagueOperationsForm] = useState({
    mission1: '',
    mission1GeistId: '',
    mission1MapA: '',
    mission1MapB: '',
    mission2: '',
    mission2GeistId: '',
    mission2MapA: '',
    mission2MapB: '',
    weekNumber: '',
  })
  const [leagueMissionCatalog, setLeagueMissionCatalog] = useState<MissionGeistCatalogMission[]>([])
  const [leagueMissionCatalogError, setLeagueMissionCatalogError] = useState('')
  const selectedEventType = state.status === 'success' ? state.data.selectedEvent.type : ''

  useEffect(() => {
    const needsLeagueMissionCatalog =
      focus === 'league' ||
      (focus === 'all' && selectedEventType === 'League')
    if (!needsLeagueMissionCatalog) return

    const controller = new AbortController()
    setLeagueMissionCatalogError('')
    getPublicMissionGeistCatalog(controller.signal)
      .then((catalog) => {
        if (!controller.signal.aborted) {
          setLeagueMissionCatalog(
            catalog.missions.filter((mission) => isCanonicalMission(mission.name)).sort((left, right) =>
              left.sourceCollectionName.localeCompare(right.sourceCollectionName)
              || left.name.localeCompare(right.name)
              || left.id.localeCompare(right.id)),
          )
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLeagueMissionCatalogError(
            error instanceof Error
              ? error.message
              : 'Mission catalog could not be loaded.',
          )
        }
      })

    return () => controller.abort()
  }, [focus, selectedEventType])

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
    setLeagueOperationsForm({
      mission1: data.leagueOperations.missions[0]?.mission ?? '',
      mission1GeistId: data.leagueOperations.missions[0]?.missionGeistId ?? '',
      mission1MapA: data.leagueOperations.missions[0]?.maps[0] ?? '',
      mission1MapB: data.leagueOperations.missions[0]?.maps[1] ?? '',
      mission2: data.leagueOperations.missions[1]?.mission ?? '',
      mission2GeistId: data.leagueOperations.missions[1]?.missionGeistId ?? '',
      mission2MapA: data.leagueOperations.missions[1]?.maps[0] ?? '',
      mission2MapB: data.leagueOperations.missions[1]?.maps[1] ?? '',
      weekNumber: data.leagueOperations.weekNumber,
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
      .getEventManager(initialEventIdRef.current, { signal: controller.signal })
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
    successMessage = 'Event Manager updated.',
    pendingMessage = '',
  ) {
    setWorkingAction(action)
    setActionError('')
    setActionMessage(pendingMessage)

    try {
      const data = await handler()
      applyManagerData(data)
      setActionMessage(successMessage)
      return data
    } catch (error) {
      setActionMessage('')
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

    if (!eventForm.name.trim()) {
      setActionMessage('')
      setActionError('Event name is required.')
      return
    }

    if (!eventForm.type.trim()) {
      setActionMessage('')
      setActionError('Event type is required.')
      return
    }

    try {
      await runManagerAction(
        'saveEvent',
        () =>
          eventRepository.saveEvent({
            ...eventForm,
            eventId: selectedEventId,
          }),
        'Event saved.',
        'Saving event...',
      )
    } catch {
      // runManagerAction has already rendered the safe backend error.
    }
  }

  async function saveLeagueOperations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorkingAction('leagueOperations')
    setActionError('')
    setActionMessage('')

    try {
      const operations = await eventRepository.saveLeagueOperations(leagueOperationsForm)
      setLeagueOperationsForm({
        mission1: operations.missions[0]?.mission ?? '',
        mission1GeistId: operations.missions[0]?.missionGeistId ?? '',
        mission1MapA: operations.missions[0]?.maps[0] ?? '',
        mission1MapB: operations.missions[0]?.maps[1] ?? '',
        mission2: operations.missions[1]?.mission ?? '',
        mission2GeistId: operations.missions[1]?.missionGeistId ?? '',
        mission2MapA: operations.missions[1]?.maps[0] ?? '',
        mission2MapB: operations.missions[1]?.maps[1] ?? '',
        weekNumber: operations.weekNumber,
      })
      setState((current) =>
        current.status === 'success'
          ? {
              ...current,
              data: {
                ...current.data,
                leagueOperations: operations,
              },
            }
          : current,
      )
      setActionMessage('Mission & Map updated.')
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Mission & Map could not be saved.',
      )
    } finally {
      setWorkingAction('')
    }
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
        seed: participant.seed,
        status,
        team: participant.team,
      }),
    )
  }

  async function saveSeeding(assignments: Array<{ player: string; seed: number }>) {
    try {
      await runManagerAction(
        'seeding',
        () =>
          eventRepository.saveParticipant({
            eventId: selectedEventId,
            seedAssignments: JSON.stringify(assignments),
          }),
        'Seeding saved.',
        'Saving seeding...',
      )
    } catch {
      // runManagerAction has already rendered the safe backend error.
    }
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

  async function savePairing(params: Record<string, string>) {
    await runManagerAction('pairing', () =>
      eventRepository.savePairing({
        ...params,
        eventId: selectedEventId,
      }),
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="event-manager" aria-label="Event Manager loading">
        <div className="panel-heading">
          <p className="eyebrow">Event Engine</p>
          <h2>Event Manager</h2>
        </div>
        <Skeleton label="Event Manager controls loading" rows={8} />
      </div>
    )
  }

  if (state.status === 'error') {
    return <p role="alert">{state.error}</p>
  }

  const { data } = state
  const isTeamTournament = data.selectedEvent.type === 'Team Tournament'
  const isIndividualDoubleElimination =
    data.selectedEvent.type === 'Individual Double Elimination'

  if (focus === 'league') {
    return (
      <div className="event-manager">
        <div className="panel-heading"><p className="eyebrow">League Operations</p><h2>Mission &amp; Map</h2></div>
        {data.selectedEvent.type === 'League' ? (
          <form className="event-manager-form" onSubmit={saveLeagueOperations}>
            <label>Week Number<input disabled={!canManage} onChange={(event) => setLeagueOperationsForm((current) => ({ ...current, weekNumber: event.target.value }))} value={leagueOperationsForm.weekNumber} /></label>
            <LeagueOperationsSelect
              disabled={!canManage || leagueMissionCatalog.length === 0}
              label="Mission 1"
              missionGeistId={leagueOperationsForm.mission1GeistId}
              onChange={(selection) => setLeagueOperationsForm((current) => ({ ...current, mission1: selection.mission, mission1GeistId: selection.missionGeistId }))}
              options={leagueMissionCatalog}
              value={leagueOperationsForm.mission1}
            />
            <LeagueOperationsMapInput disabled={!canManage} label="Mission 1 Map 1" onChange={(mission1MapA) => setLeagueOperationsForm((current) => ({ ...current, mission1MapA }))} value={leagueOperationsForm.mission1MapA} />
            <LeagueOperationsMapInput disabled={!canManage} label="Mission 1 Map 2" onChange={(mission1MapB) => setLeagueOperationsForm((current) => ({ ...current, mission1MapB }))} value={leagueOperationsForm.mission1MapB} />
            <LeagueOperationsSelect
              disabled={!canManage || leagueMissionCatalog.length === 0}
              label="Mission 2"
              missionGeistId={leagueOperationsForm.mission2GeistId}
              onChange={(selection) => setLeagueOperationsForm((current) => ({ ...current, mission2: selection.mission, mission2GeistId: selection.missionGeistId }))}
              options={leagueMissionCatalog}
              value={leagueOperationsForm.mission2}
            />
            <LeagueOperationsMapInput disabled={!canManage} label="Mission 2 Map 1" onChange={(mission2MapA) => setLeagueOperationsForm((current) => ({ ...current, mission2MapA }))} value={leagueOperationsForm.mission2MapA} />
            <LeagueOperationsMapInput disabled={!canManage} label="Mission 2 Map 2" onChange={(mission2MapB) => setLeagueOperationsForm((current) => ({ ...current, mission2MapB }))} value={leagueOperationsForm.mission2MapB} />
            <div className="event-manager-actions event-manager-wide"><button disabled={!canManage || workingAction !== ''} type="submit">Save Mission &amp; Map</button><a className="button-link" href="/league-operations">View Public Page</a></div>
            {leagueMissionCatalogError ? <p className="form-error event-manager-wide" role="alert">{leagueMissionCatalogError}</p> : null}
            <div aria-live="polite" className="event-manager-wide">{actionError ? <p className="form-error" role="alert">{actionError}</p> : null}{actionMessage ? <p className="form-success" role="status">{actionMessage}</p> : null}</div>
          </form>
        ) : <p>This tool is available for League events only.</p>}
      </div>
    )
  }

  if (focus === 'top40') {
    return (
      <div className="event-manager">
        <div className="panel-heading"><p className="eyebrow">Tournament Operations</p><h2>Top 40 Operations</h2></div>
        {isIndividualDoubleElimination ? <><TournamentSeedingPanel canManage={canManage} key={`${data.selectedEvent.id}-${data.generatedAt}`} onSave={saveSeeding} participants={data.participants} working={workingAction !== ''} /><BracketGenerationPanel canManage={canManage} eventId={data.selectedEvent.id} /></> : <p>This tool is available for the Top 40 event only.</p>}
      </div>
    )
  }

  if (focus === 'team') {
    return (
      <div className="event-manager">
        <div className="panel-heading"><p className="eyebrow">Tournament Operations</p><h2>Team Tournament Operations</h2></div>
        {isTeamTournament ? <TeamOperationsPanel canManage={canManage} onPairingSubmit={savePairing} onTeamChange={setTeamForm} onTeamSubmit={saveTeam} pairings={data.pairings} rounds={data.rounds} currentRound={data.events.find((event) => event.event.id === data.selectedEvent.id)?.currentRound ?? data.rounds[0] ?? null} teamForm={teamForm} teams={data.teams} working={workingAction !== ''} /> : <p>This tool is available for Team Tournament events only.</p>}
      </div>
    )
  }

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
            <div aria-live="polite" className="event-manager-wide">
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
              {!canManage ? (
                <p className="form-error" role="alert">
                  Commissioner event permission is required.
                </p>
              ) : null}
            </div>
          </form>

          {data.selectedEvent.type === 'League' ? (
            <form className="event-manager-form" onSubmit={saveLeagueOperations}>
              <h3>Mission & Map</h3>
              <label>
                Week Number
                <input
                  disabled={!canManage}
                  onChange={(event) =>
                    setLeagueOperationsForm((current) => ({
                      ...current,
                      weekNumber: event.target.value,
                    }))
                  }
                  value={leagueOperationsForm.weekNumber}
                />
              </label>
              <LeagueOperationsSelect
                disabled={!canManage || leagueMissionCatalog.length === 0}
                label="Mission 1"
                missionGeistId={leagueOperationsForm.mission1GeistId}
                onChange={(selection) =>
                  setLeagueOperationsForm((current) => ({
                    ...current,
                    mission1: selection.mission,
                    mission1GeistId: selection.missionGeistId,
                  }))
                }
                options={leagueMissionCatalog}
                value={leagueOperationsForm.mission1}
              />
              <LeagueOperationsMapInput
                disabled={!canManage}
                label="Mission 1 Map 1"
                onChange={(mission1MapA) =>
                  setLeagueOperationsForm((current) => ({
                    ...current,
                    mission1MapA,
                  }))
                }
                value={leagueOperationsForm.mission1MapA}
              />
              <LeagueOperationsMapInput
                disabled={!canManage}
                label="Mission 1 Map 2"
                onChange={(mission1MapB) =>
                  setLeagueOperationsForm((current) => ({
                    ...current,
                    mission1MapB,
                  }))
                }
                value={leagueOperationsForm.mission1MapB}
              />
              <LeagueOperationsSelect
                disabled={!canManage || leagueMissionCatalog.length === 0}
                label="Mission 2"
                missionGeistId={leagueOperationsForm.mission2GeistId}
                onChange={(selection) =>
                  setLeagueOperationsForm((current) => ({
                    ...current,
                    mission2: selection.mission,
                    mission2GeistId: selection.missionGeistId,
                  }))
                }
                options={leagueMissionCatalog}
                value={leagueOperationsForm.mission2}
              />
              <LeagueOperationsMapInput
                disabled={!canManage}
                label="Mission 2 Map 1"
                onChange={(mission2MapA) =>
                  setLeagueOperationsForm((current) => ({
                    ...current,
                    mission2MapA,
                  }))
                }
                value={leagueOperationsForm.mission2MapA}
              />
              <LeagueOperationsMapInput
                disabled={!canManage}
                label="Mission 2 Map 2"
                onChange={(mission2MapB) =>
                  setLeagueOperationsForm((current) => ({
                    ...current,
                    mission2MapB,
                  }))
                }
                value={leagueOperationsForm.mission2MapB}
              />
              <div className="event-manager-actions event-manager-wide">
                <button disabled={!canManage || workingAction !== ''} type="submit">
                  Save Mission & Map
                </button>
                <a className="button-link" href="/league-operations">
                  View Public Page
                </a>
              </div>
              {leagueMissionCatalogError ? (
                <p className="form-error event-manager-wide" role="alert">
                  {leagueMissionCatalogError}
                </p>
              ) : null}
            </form>
          ) : null}

          <ParticipantsPanel
            canManage={canManage}
            form={participantForm}
            onChange={setParticipantForm}
            onStatusChange={updateParticipantStatus}
            onSubmit={saveParticipant}
            participants={data.participants}
            working={workingAction !== ''}
          />

          {isIndividualDoubleElimination ? (
            <>
              <TournamentSeedingPanel
                canManage={canManage}
                key={`${data.selectedEvent.id}-${data.generatedAt}`}
                onSave={saveSeeding}
                participants={data.participants}
                working={workingAction !== ''}
              />
              <BracketGenerationPanel
                canManage={canManage}
                eventId={data.selectedEvent.id}
              />
            </>
          ) : null}

          {isTeamTournament ? (
            <TeamOperationsPanel
              canManage={canManage}
              onPairingSubmit={savePairing}
              onTeamChange={setTeamForm}
              onTeamSubmit={saveTeam}
              pairings={data.pairings}
              rounds={data.rounds}
              currentRound={
                data.events.find((event) => event.event.id === data.selectedEvent.id)
                  ?.currentRound ??
                data.rounds[0] ??
                null
              }
              teamForm={teamForm}
              teams={data.teams}
              working={workingAction !== ''}
            />
          ) : null}

        </section>
      </div>
    </div>
  )
}

function BracketGenerationPanel({ canManage, eventId }: { canManage: boolean; eventId: string }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [bracket, setBracket] = useState<EventBracketData | null>(null)
  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<string, string>>({})
  const [savingDeadline, setSavingDeadline] = useState('')
  const [forfeitWinners, setForfeitWinners] = useState<Record<string, string>>({})
  const [awardingForfeit, setAwardingForfeit] = useState('')
  const [missionDrafts, setMissionDrafts] = useState<Record<string, { mission: string; missionGeistId: string }>>({})
  const [missionCatalog, setMissionCatalog] = useState<MissionGeistCatalogMission[]>([])
  const [savingMissions, setSavingMissions] = useState(false)
  const loadBracket = useCallback(() => {
    apiClient.getEventBracket(eventId).then((nextBracket) => {
      setBracket(nextBracket)
      setMissionDrafts(Object.fromEntries(nextBracket.missions.map((assignment) => [
        `${assignment.bracket}:${assignment.bracketRound}`,
        { mission: assignment.mission, missionGeistId: assignment.missionGeistId || '' },
      ])))
    }).catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : 'Bracket status could not be loaded.'),
    )
  }, [eventId])
  useEffect(loadBracket, [loadBracket])
  useEffect(() => {
    const controller = new AbortController()
    getPublicMissionGeistCatalog(controller.signal).then((catalog) => {
      setMissionCatalog(catalog.missions.filter((mission) => isCanonicalMission(mission.name)))
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Mission catalog could not be loaded.'))
    return () => controller.abort()
  }, [])

  async function generateBracket() {
    setGenerating(true)
    setMessage('Generating bracket...')
    setError('')
    try {
      setBracket(await apiClient.generateEventBracket(eventId))
      setMessage('Bracket generated.')
    } catch (reason) {
      setMessage('')
      setError(reason instanceof Error ? reason.message : 'Bracket could not be generated.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveDeadline(matchId: string) {
    const deadline = deadlineDrafts[matchId]
    if (!deadline) {
      setError('Enter a valid deadline.')
      return
    }
    setSavingDeadline(matchId)
    setMessage('Saving deadline...')
    setError('')
    try {
      setBracket(await apiClient.updateEventBracketDeadline(eventId, matchId, deadline.replace('T', ' ') + ':00'))
      setMessage('Deadline saved.')
    } catch (reason) {
      setMessage('')
      setError(reason instanceof Error ? reason.message : 'Deadline could not be saved.')
    } finally {
      setSavingDeadline('')
    }
  }

  async function saveMissions() {
    if (!bracket) return
    setSavingMissions(true)
    setMessage('Saving missions...')
    setError('')
    try {
      const rounds = discoverBracketRounds(bracket)
      setBracket(await apiClient.saveEventBracketMissions(eventId, rounds.map((round) => ({
        bracket: round.bracket,
        bracketRound: round.bracketRound,
        mission: missionDrafts[round.key]?.mission || '',
        missionGeistId: missionDrafts[round.key]?.missionGeistId || '',
      }))))
      setMessage('Missions saved.')
    } catch (reason) {
      setMessage('')
      setError(reason instanceof Error ? reason.message : 'Missions could not be saved.')
    } finally {
      setSavingMissions(false)
    }
  }

  async function awardForfeit(match: EventBracketData['matches'][number]) {
    const winner = forfeitWinners[match.matchId]
    if (!winner) {
      setError('Choose Player A or Player B as the forfeit winner.')
      return
    }
    if (!window.confirm(`Award this match to ${winner} by forfeit?`)) return
    setAwardingForfeit(match.matchId)
    setMessage('Awarding forfeit...')
    setError('')
    try {
      setBracket(await apiClient.awardEventBracketForfeit(eventId, match.matchId, winner))
      setMessage('Forfeit awarded.')
    } catch (reason) {
      setMessage('')
      setError(reason instanceof Error ? reason.message : 'Forfeit could not be awarded.')
    } finally {
      setAwardingForfeit('')
    }
  }

  const readiness = bracket?.readiness
  const activeMatches = bracket?.matches.filter((match) => match.status === 'Active') ?? []
  return (
    <section className="event-manager-subpanel">
      <h3>Bracket Generation</h3>
      <div className="event-manager-summary" aria-label="Bracket readiness">
        <Metric label="Registered Players" value={readiness ? `${readiness.registeredCount} / ${readiness.capacity || '—'}` : 'Loading'} />
        <Metric label="Seeded Players" value={readiness ? `${readiness.seededCount} / ${readiness.registeredCount}` : 'Loading'} />
        <Metric label="Registration" value={readiness ? (readiness.registrationClosed ? 'Closed' : 'Open') : 'Loading'} />
        <Metric label="Bracket" value={bracket?.generated ? 'Generated' : 'Not Generated'} />
      </div>
      <div aria-live="polite">
        {bracket?.generated ? <p>Bracket Generated</p> : readiness?.ready ? <p>Ready to generate bracket.</p> : readiness?.reasons.map((reason) => <p key={reason}>{reason}</p>)}
        {message ? <p className="form-success" role="status">{message}</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
      {!bracket?.generated ? <div className="event-manager-actions">
        <button disabled={!canManage || !readiness?.ready || generating} onClick={generateBracket} type="button">
          {generating ? 'Generating bracket...' : 'Generate Bracket'}
        </button>
      </div> : null}
      <section aria-labelledby="bracket-missions-title">
        <h4 id="bracket-missions-title">Bracket Missions</h4>
        {!bracket?.generated ? <p>Generate the bracket before assigning missions.</p> : (
          <>
            {(['Winners', 'Losers', 'Grand Final'] as const).map((bracketName) => {
              const rounds = discoverBracketRounds(bracket).filter((round) => round.bracket === bracketName)
              return rounds.length ? <div key={bracketName} className="event-manager-mission-group">
                <strong>{bracketName === 'Grand Final' ? 'Grand Final' : `${bracketName} Bracket`}</strong>
                {rounds.map((round) => <div key={round.key}>
                  <LeagueOperationsSelect
                    disabled={!canManage || savingMissions}
                    label={bracketName === 'Grand Final' ? 'Mission' : `Round ${round.bracketRound}`}
                    missionGeistId={missionDrafts[round.key]?.missionGeistId || ''}
                    onChange={(selection) => setMissionDrafts((current) => ({ ...current, [round.key]: selection }))}
                    options={missionCatalog}
                    value={missionDrafts[round.key]?.mission || ''}
                  />
                </div>)}
              </div> : null
            })}
            <div className="event-manager-actions">
              <button disabled={!canManage || savingMissions} onClick={() => void saveMissions()} type="button">
                {savingMissions ? 'Saving missions...' : 'Save Missions'}
              </button>
            </div>
          </>
        )}
      </section>
      {bracket ? <section aria-labelledby="active-bracket-matches-title">
        <h4 id="active-bracket-matches-title">Active Matches</h4>
        {activeMatches.length === 0 ? <p>No active bracket matches.</p> : activeMatches.map((match) => (
          <div className="event-manager-row" key={match.matchId}>
            <div>
              <strong>{match.matchId}</strong>
              <span>{match.playerA} vs {match.playerB}</span>
              <small>Activated At: {formatBracketTimestamp(match.activatedAt)}</small>
            </div>
            <label>
              Deadline
              <input
                disabled={!canManage || savingDeadline !== ''}
                onChange={(event) => setDeadlineDrafts((current) => ({ ...current, [match.matchId]: event.target.value }))}
                type="datetime-local"
                value={deadlineDrafts[match.matchId] ?? match.deadline.replace(' ', 'T').slice(0, 16)}
              />
            </label>
            <button disabled={!canManage || savingDeadline !== ''} onClick={() => saveDeadline(match.matchId)} type="button">
              {savingDeadline === match.matchId ? 'Saving...' : 'Edit Deadline'}
            </button>
            <label>
              Forfeit Winner
              <select
                disabled={!canManage || awardingForfeit !== ''}
                onChange={(event) => setForfeitWinners((current) => ({ ...current, [match.matchId]: event.target.value }))}
                value={forfeitWinners[match.matchId] || ''}
              >
                <option value="">Choose winner</option>
                <option value={match.playerA}>{match.playerA}</option>
                <option value={match.playerB}>{match.playerB}</option>
              </select>
            </label>
            <button disabled={!canManage || awardingForfeit !== ''} onClick={() => void awardForfeit(match)} type="button">
              {awardingForfeit === match.matchId ? 'Awarding...' : 'Award Forfeit'}
            </button>
          </div>
        ))}
      </section> : null}
    </section>
  )
}

function discoverBracketRounds(bracket: EventBracketData) {
  const seen = new Set<string>()
  return bracket.matches.flatMap((match) => {
    const key = `${match.bracket}:${match.bracketRound}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ bracket: match.bracket, bracketRound: match.bracketRound, key }]
  })
}

function formatBracketTimestamp(value: string) {
  return value ? value.replace('T', ' ') : 'Not set'
}

function TournamentSeedingPanel({
  canManage,
  onSave,
  participants,
  working,
}: {
  canManage: boolean
  onSave: (assignments: Array<{ player: string; seed: number }>) => Promise<void>
  participants: EventRegistrationEntry[]
  working: boolean
}) {
  const registered = participants.filter((participant) => participant.status === 'Registered')
  const [seeds, setSeeds] = useState<Record<string, string>>(() =>
    Object.fromEntries(registered.map((participant) => [participant.player, participant.seed])),
  )
  const [validationError, setValidationError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = registered.map((participant) => Number(seeds[participant.player]))
    const valid =
      values.length > 0 &&
      values.every(
        (seed) => Number.isInteger(seed) && seed >= 1 && seed <= registered.length,
      ) &&
      new Set(values).size === registered.length

    if (!valid) {
      setValidationError(
        `Every registered player must have a unique seed from 1 to ${registered.length}.`,
      )
      return
    }

    setValidationError('')
    await onSave(
      registered.map((participant, index) => ({
        player: participant.player,
        seed: values[index],
      })),
    )
  }

  return (
    <section className="event-manager-subpanel">
      <h3>Tournament Seeding</h3>
      {registered.length === 0 ? (
        <p>No registered players to seed.</p>
      ) : (
        <form onSubmit={submit}>
          <div className="event-manager-table" role="table" aria-label="Tournament seeding">
            <div className="event-manager-row event-manager-seeding-header" role="row">
              <strong>Seed</strong>
              <strong>Player</strong>
              <strong>ITS Name</strong>
              <strong>Faction</strong>
            </div>
            {registered.map((participant) => (
              <div className="event-manager-row event-manager-seeding-row" key={participant.player} role="row">
                <input
                  aria-label={`Seed for ${participant.displayName || participant.player}`}
                  disabled={!canManage || working}
                  max={registered.length}
                  min={1}
                  onChange={(event) =>
                    setSeeds((current) => ({
                      ...current,
                      [participant.player]: event.target.value,
                    }))
                  }
                  step={1}
                  type="number"
                  value={seeds[participant.player] ?? ''}
                />
                <span>{participant.displayName || participant.player}</span>
                <span>{participant.itsName || '—'}</span>
                <span>{participant.faction || '—'}</span>
              </div>
            ))}
          </div>
          {validationError ? <p role="alert">{validationError}</p> : null}
          <div className="event-manager-actions">
            <button disabled={!canManage || working} type="submit">
              Save Seeding
            </button>
          </div>
        </form>
      )}
    </section>
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
      <option>Individual Double Elimination</option>
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

function LeagueOperationsSelect({
  disabled,
  label,
  missionGeistId,
  onChange,
  options,
  value,
}: {
  disabled: boolean
  label: string
  missionGeistId: string
  onChange: (selection: { mission: string; missionGeistId: string }) => void
  options: MissionGeistCatalogMission[]
  value: string
}) {
  const selectedValue = missionGeistId || (value ? `legacy:${value}` : '')

  return (
    <label>
      {label}
      <select
        disabled={disabled}
        onChange={(event) => {
          const mission = options.find((option) => option.id === event.target.value)
          onChange(mission
            ? { mission: mission.name, missionGeistId: mission.id }
            : { mission: '', missionGeistId: '' })
        }}
        value={selectedValue}
      >
        <option value="">Select {label}</option>
        {!missionGeistId && value ? (
          <option disabled value={`legacy:${value}`}>
            Legacy — {value} (identity not recorded)
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.sourceCollectionName || option.sourceCollectionId} — {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function LeagueOperationsMapInput({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label>
      {label}
      <input
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter map name"
        value={value}
      />
    </label>
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
  onPairingSubmit,
  onTeamChange,
  onTeamSubmit,
  pairings,
  currentRound,
  rounds,
  teamForm,
  teams,
  working,
}: {
  canManage: boolean
  onPairingSubmit: (params: Record<string, string>) => void
  onTeamChange: (value: typeof teamForm) => void
  onTeamSubmit: (event: FormEvent<HTMLFormElement>) => void
  pairings: EventManagerData['pairings']
  currentRound: Record<string, unknown> | null
  rounds: Array<Record<string, unknown>>
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
      <TeamPairingEditor
        currentRound={currentRound}
        disabled={!canManage || working}
        onSubmit={onPairingSubmit}
        pairings={pairings}
        rounds={rounds}
        teams={teams.filter((team) => team.status !== 'Deleted')}
      />
    </section>
  )
}

export default EventManagerPanel
