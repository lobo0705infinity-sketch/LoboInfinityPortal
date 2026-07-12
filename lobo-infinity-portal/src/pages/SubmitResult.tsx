import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Skeleton from '../components/Skeleton'
import {
  getCanonicalMissionName,
  getCanonicalMissionOptions,
} from '../config/missions'
import './SubmitResult.css'
import {
  apiClient,
  type CasualResultSubmission,
  type EventHomeData,
  type LeagueResultSubmission,
  type SearchData,
  type TeamTournamentData,
} from '../services/api'

type SubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'submitting' }
  | { message: string; status: 'success' }
  | { message: string; status: 'error' }

const emptyLeagueResult: LeagueResultSubmission = {
  bestMoment: '',
  division: '',
  eventId: '',
  firstTurn: '',
  mission: '',
  notes: '',
  opponent: '',
  opponentFaction: '',
  opponentObjectivePoints: '',
  opponentTournamentPoints: '',
  opponentVictoryPoints: '',
  player: '',
  playerFaction: '',
  playerObjectivePoints: '',
  playerTournamentPoints: '',
  playerVictoryPoints: '',
  round: '',
  winner: '',
}

type PickerOption = {
  label: string
  meta?: string
  value: string
}

const canonicalFactionFallbacks = [
  'ALEPH',
  'Ariadna',
  'Combined Army',
  'Haqqislam',
  'JSA',
  'NA2',
  'Nomads',
  'O-12',
  'PanOceania',
  'Tohaa',
  'Yu Jing',
]

function SubmitResult() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const selectedGameType = searchParams.get('gameType') ?? ''
  const eventId = searchParams.get('eventId') ?? 'event-current-league'
  const isCasualRoute = selectedGameType === 'casual'
  const shouldShowGameTypeSelector = !selectedGameType
  const [eventHome, setEventHome] = useState<EventHomeData | null>(null)
  const [teamTournament, setTeamTournament] = useState<TeamTournamentData | null>(null)
  const [searchIndex, setSearchIndex] = useState<SearchData | null>(null)
  const [showAllOpponents, setShowAllOpponents] = useState(false)
  const [state, setState] = useState<SubmitState>({ status: 'loading' })
  const [leagueResult, setLeagueResult] = useState<LeagueResultSubmission>({
    ...emptyLeagueResult,
    eventId,
  })
  const [casualResult, setCasualResult] = useState<CasualResultSubmission>({
    ...emptyLeagueResult,
    division: undefined,
    eventId: undefined,
    player: auth.user.leaguePlayer || auth.user.playerDisplayName || auth.user.displayName || '',
    playerFaction: auth.user.favoriteFaction || '',
    round: undefined,
  })
  const canOverrideOpponentFilter = auth.isAtLeastRole('Commissioner')
  const allPlayerOptions = useMemo(() => buildPlayerOptions(searchIndex), [searchIndex])
  const factionOptions = useMemo(
    () => buildFactionOptions(searchIndex, eventHome),
    [eventHome, searchIndex],
  )
  const missionOptions = useMemo(() => buildMissionOptions(), [])
  const leagueOpponentOptions = useMemo(
    () =>
      buildEventOpponentOptions(
        eventHome,
        allPlayerOptions,
        leagueResult.player,
        leagueResult.division,
        showAllOpponents && canOverrideOpponentFilter,
      ),
    [allPlayerOptions, canOverrideOpponentFilter, eventHome, leagueResult.division, leagueResult.player, showAllOpponents],
  )
  const casualOpponentOptions = useMemo(
    () => allPlayerOptions.filter((option) => !sameValue(option.value, casualResult.player)),
    [allPlayerOptions, casualResult.player],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadSubmissionContext() {
      if (shouldShowGameTypeSelector) {
        setEventHome(null)
        setTeamTournament(null)
        setSearchIndex(null)
        setState({ status: 'idle' })
        return
      }

      if (isCasualRoute) {
        setState({ status: 'loading' })

        try {
          const registry = await apiClient.getSearchIndex({
            signal: controller.signal,
          })

          if (controller.signal.aborted) {
            return
          }

          setSearchIndex(registry)
        } catch (error) {
          if (controller.signal.aborted) {
            return
          }

          setState({
            message:
              error instanceof Error
                ? error.message
                : 'Submission options are unavailable.',
            status: 'error',
          })
          return
        }

        setEventHome(null)
        setTeamTournament(null)
        setCasualResult((current) => ({
          ...current,
          player: current.player || auth.user.leaguePlayer || auth.user.playerDisplayName || auth.user.displayName || '',
          playerFaction: current.playerFaction || auth.user.favoriteFaction || '',
        }))
        setState({ status: 'idle' })
        return
      }

      setState({ status: 'loading' })

      try {
        const [home, registry] = await Promise.all([
          apiClient.getEventHome(eventId, {
            signal: controller.signal,
          }),
          apiClient.getSearchIndex({
            signal: controller.signal,
          }),
        ])

        if (controller.signal.aborted) {
          return
        }

        setEventHome(home)
        setSearchIndex(registry)

        const player = auth.user.leaguePlayer || home.registration.currentPlayer?.player || ''
        const currentPlayer = home.registration.currentPlayer
        setLeagueResult((current) => ({
          ...current,
          division: auth.user.leagueDivision || currentPlayer?.notes || '',
          eventId: home.event.id,
          mission:
            getCanonicalMissionName(
              getRoundValue(home.currentRound, 'mission') ||
                getRoundValue(home.currentRound, 'Mission'),
            ) || '',
          player,
          playerFaction: currentPlayer?.faction || auth.user.favoriteFaction || '',
          round:
            getRoundValue(home.currentRound, 'name') ||
            getRoundValue(home.currentRound, 'round') ||
            home.statistics.currentRound,
        }))

        if (home.event.type === 'Team Tournament') {
          const tournament = await apiClient.getTeamTournament(eventId, {
            signal: controller.signal,
          })

          if (!controller.signal.aborted) {
            setTeamTournament(tournament)
          }
        }

        if (!controller.signal.aborted) {
          setState({ status: 'idle' })
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setState({
          message:
            error instanceof Error
              ? error.message
              : 'Result submission is unavailable.',
          status: 'error',
        })
      }
    }

    void loadSubmissionContext()

    return () => {
      controller.abort()
    }
  }, [
    auth.user.favoriteFaction,
    auth.user.leagueDivision,
    auth.user.leaguePlayer,
    auth.user.playerDisplayName,
    auth.user.displayName,
    eventId,
    isCasualRoute,
    shouldShowGameTypeSelector,
  ])

  function updateCasualField(field: keyof CasualResultSubmission, value: string) {
    setCasualResult((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function submitCasual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateCasualResult(casualResult, {
      factions: factionOptions,
      missions: missionOptions,
      opponents: casualOpponentOptions,
    })

    if (validation.length > 0) {
      setState({ message: validation.join(' '), status: 'error' })
      return
    }

    setState({ status: 'submitting' })

    try {
      await apiClient.submitCasualResult(casualResult)
      setState({
        message: 'Casual game submitted. Analytics and lifetime records will refresh from the official game data.',
        status: 'success',
      })
    } catch {
      setState({
        message: 'Casual game could not be submitted. Please review the fields or contact a commissioner.',
        status: 'error',
      })
    }
  }

  if (shouldShowGameTypeSelector) {
    return (
      <main className="portal-shell">
        <section className="page-header" aria-labelledby="submit-game-title">
          <p className="eyebrow">Unified Game Submission</p>
          <h1 id="submit-game-title">Submit Game</h1>
          <p>Choose the game type. Each workflow reuses the same result validation and analytics pipeline.</p>
        </section>

        <section className="operations-grid">
          <SubmissionChoice
            description="Submit a game for the current league event."
            label="League"
            to="/submit-game?eventId=event-current-league&gameType=event"
          />
          <SubmissionChoice
            description="Submit an individual table result for the Team Tournament."
            label="Tournament"
            to="/submit-game?eventId=event-august-2026-team-tournament&gameType=event"
          />
          <SubmissionChoice
            description="Record a non-event game for lifetime analytics and activity feeds."
            label="Casual"
            to="/submit-game?gameType=casual"
          />
          <article className="panel operations-panel">
            <p className="eyebrow">Coming Soon</p>
            <h2>Narrative</h2>
            <p>Narrative submissions will use the same game pipeline when that game type is enabled.</p>
          </article>
        </section>
      </main>
    )
  }

  if (isCasualRoute) {
    return (
      <main className="portal-shell">
        <section className="page-header" aria-labelledby="casual-result-title">
          <p className="eyebrow">Casual Game</p>
          <h1 id="casual-result-title">Submit Game</h1>
          <p>Record a non-event game for lifetime analytics, faction trends, mission data, and activity feeds.</p>
          <Link className="submit-match-button" to="/">
            Return to Dashboard
          </Link>
        </section>

        {!auth.authenticated ? (
          <section className="dashboard-state" aria-label="Authentication required">
            <p role="alert">Sign in with a Portal account to submit a casual game.</p>
          </section>
        ) : null}

        {state.status === 'loading' ? (
          <section className="panel" aria-label="Submission options loading">
            <Skeleton label="Submission options loading" rows={4} />
          </section>
        ) : null}

        <form className="army-list-form panel" onSubmit={(event) => void submitCasual(event)}>
          <ReadOnlyField
            label="Player"
            value={casualResult.player}
          />
          <SearchableSelect
            label="Opponent"
            onChange={(value) => updateCasualField('opponent', value)}
            options={casualOpponentOptions}
            placeholder="Search active players"
            required
            value={casualResult.opponent}
          />
          <SearchableSelect
            label="Player Faction"
            onChange={(value) => updateCasualField('playerFaction', value)}
            options={factionOptions}
            placeholder="Search factions"
            required
            value={casualResult.playerFaction}
          />
          <SearchableSelect
            label="Opponent Faction"
            onChange={(value) => updateCasualField('opponentFaction', value)}
            options={factionOptions}
            placeholder="Search factions"
            required
            value={casualResult.opponentFaction}
          />
          <SearchableSelect
            label="Mission"
            onChange={(value) => updateCasualField('mission', value)}
            options={missionOptions}
            placeholder="Search missions"
            required
            value={casualResult.mission}
          />
          <SelectField
            label="Winner"
            onChange={(value) => updateCasualField('winner', value)}
            options={[casualResult.player, casualResult.opponent, 'Draw'].filter(Boolean)}
            required
            value={casualResult.winner}
          />
          <ScoreField
            label="Player Tournament Points"
            onChange={(value) => updateCasualField('playerTournamentPoints', value)}
            value={casualResult.playerTournamentPoints}
          />
          <ScoreField
            label="Opponent Tournament Points"
            onChange={(value) => updateCasualField('opponentTournamentPoints', value)}
            value={casualResult.opponentTournamentPoints}
          />
          <ScoreField
            label="Player Objective Points"
            onChange={(value) => updateCasualField('playerObjectivePoints', value)}
            value={casualResult.playerObjectivePoints}
          />
          <ScoreField
            label="Opponent Objective Points"
            onChange={(value) => updateCasualField('opponentObjectivePoints', value)}
            value={casualResult.opponentObjectivePoints}
          />
          <ScoreField
            label="Player Victory Points"
            onChange={(value) => updateCasualField('playerVictoryPoints', value)}
            value={casualResult.playerVictoryPoints}
          />
          <ScoreField
            label="Opponent Victory Points"
            onChange={(value) => updateCasualField('opponentVictoryPoints', value)}
            value={casualResult.opponentVictoryPoints}
          />
          <SelectField
            label="First Turn"
            onChange={(value) => updateCasualField('firstTurn', value)}
            options={[casualResult.player, casualResult.opponent].filter(Boolean)}
            required
            value={casualResult.firstTurn}
          />
          <label className="army-list-form-wide">
            <span>Best Moment</span>
            <textarea
              onChange={(event) => updateCasualField('bestMoment', event.target.value)}
              required
              rows={4}
              value={casualResult.bestMoment}
            />
          </label>
          <label className="army-list-form-wide">
            <span>Optional Notes</span>
            <textarea
              onChange={(event) => updateCasualField('notes', event.target.value)}
              rows={3}
              value={casualResult.notes}
            />
          </label>
          <div className="army-list-form-actions">
            <button disabled={!auth.authenticated || state.status === 'submitting'} type="submit">
              {state.status === 'submitting' ? 'Submitting...' : 'Submit Game'}
            </button>
            {state.status === 'success' ? <p role="status">{state.message}</p> : null}
            {state.status === 'error' ? <p role="alert">{state.message}</p> : null}
          </div>
        </form>
      </main>
    )
  }

  if (eventHome?.event.type === 'Team Tournament') {
    return (
      <TeamTournamentResultSubmission
        data={teamTournament}
        disabled={!auth.authenticated || state.status === 'loading'}
        eventHome={eventHome}
      />
    )
  }

  function updateField(field: keyof LeagueResultSubmission, value: string) {
    setLeagueResult((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!eventHome) {
      setState({ message: 'Event context is still loading.', status: 'error' })
      return
    }

    const validation = validateLeagueResult(eventHome, leagueResult, {
      factions: factionOptions,
      missions: missionOptions,
      opponents: leagueOpponentOptions,
    })

    if (validation.length > 0) {
      setState({ message: validation.join(' '), status: 'error' })
      return
    }

    setState({ status: 'submitting' })

    try {
      await apiClient.submitLeagueResult(leagueResult)
      setState({
        message: 'Result submitted. Standings will refresh from the official event data.',
        status: 'success',
      })
    } catch {
      setState({
        message: 'Result could not be submitted. Please review the fields or contact a commissioner.',
        status: 'error',
      })
    }
  }

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="submit-result-title">
        <p className="eyebrow">Event Result</p>
        <h1 id="submit-result-title">Submit Game</h1>
        <p>Report a completed match using the event context already attached to your account.</p>
        <Link className="submit-match-button" to={`/event/${encodeURIComponent(eventId)}`}>
          Return to Event
        </Link>
      </section>

      {!auth.authenticated ? (
        <section className="dashboard-state" aria-label="Authentication required">
          <p role="alert">Sign in with an enabled league account to submit a result.</p>
        </section>
      ) : null}

      {state.status === 'loading' ? (
        <section className="panel" aria-label="Submission context loading">
          <Skeleton label="Submission context loading" rows={4} />
        </section>
      ) : null}

      <form className="army-list-form panel" onSubmit={(event) => void submit(event)}>
        <ReadOnlyField label="Event" value={eventHome?.event.name || eventId} />
        <ReadOnlyField
          label="Round"
          value={leagueResult.round}
        />
        <ReadOnlyField
          label="Division"
          value={leagueResult.division}
        />
        <SearchableSelect
          label="Mission"
          onChange={(value) => updateField('mission', value)}
          options={missionOptions}
          placeholder="Search event missions"
          required
          value={leagueResult.mission}
        />
        <ReadOnlyField label="Player" value={leagueResult.player || auth.user.leaguePlayer} />
        <SearchableSelect
          label="Opponent"
          onChange={(value) => updateField('opponent', value)}
          options={leagueOpponentOptions}
          placeholder="Search eligible opponents"
          required
          value={leagueResult.opponent}
        />
        {canOverrideOpponentFilter ? (
          <label className="event-registration-check">
            <input
              checked={showAllOpponents}
              onChange={(event) => setShowAllOpponents(event.target.checked)}
              type="checkbox"
            />
            <span>Show All Players</span>
          </label>
        ) : null}
        <SearchableSelect
          label="Registered Faction"
          onChange={(value) => updateField('playerFaction', value)}
          options={factionOptions}
          placeholder="Search factions"
          required
          value={leagueResult.playerFaction}
        />
        <SearchableSelect
          label="Opponent Faction"
          onChange={(value) => updateField('opponentFaction', value)}
          options={factionOptions}
          placeholder="Search factions"
          value={leagueResult.opponentFaction}
        />
        <SelectField
          label="Winner"
          onChange={(value) => updateField('winner', value)}
          options={[leagueResult.player, leagueResult.opponent, 'Draw'].filter(Boolean)}
          required
          value={leagueResult.winner}
        />
        <ScoreField
          label="Your Tournament Points"
          onChange={(value) => updateField('playerTournamentPoints', value)}
          value={leagueResult.playerTournamentPoints}
        />
        <ScoreField
          label="Opponent Tournament Points"
          onChange={(value) => updateField('opponentTournamentPoints', value)}
          value={leagueResult.opponentTournamentPoints}
        />
        <ScoreField
          label="Your Objective Points"
          onChange={(value) => updateField('playerObjectivePoints', value)}
          value={leagueResult.playerObjectivePoints}
        />
        <ScoreField
          label="Opponent Objective Points"
          onChange={(value) => updateField('opponentObjectivePoints', value)}
          value={leagueResult.opponentObjectivePoints}
        />
        <ScoreField
          label="Your Victory Points"
          onChange={(value) => updateField('playerVictoryPoints', value)}
          value={leagueResult.playerVictoryPoints}
        />
        <ScoreField
          label="Opponent Victory Points"
          onChange={(value) => updateField('opponentVictoryPoints', value)}
          value={leagueResult.opponentVictoryPoints}
        />
        <SelectField
          label="First Turn"
          onChange={(value) => updateField('firstTurn', value)}
          options={[leagueResult.player, leagueResult.opponent].filter(Boolean)}
          value={leagueResult.firstTurn}
        />
        <label className="army-list-form-wide">
          <span>Best Moment</span>
          <textarea
            onChange={(event) => updateField('bestMoment', event.target.value)}
            rows={4}
            value={leagueResult.bestMoment}
          />
        </label>
        <label className="army-list-form-wide">
          <span>Optional Notes</span>
          <textarea
            onChange={(event) => updateField('notes', event.target.value)}
            rows={3}
            value={leagueResult.notes}
          />
        </label>
        <div className="army-list-form-actions">
          <button disabled={!auth.authenticated || state.status === 'submitting'} type="submit">
            {state.status === 'submitting' ? 'Submitting...' : 'Submit Game'}
          </button>
          {state.status === 'success' ? <p role="status">{state.message}</p> : null}
          {state.status === 'error' ? <p role="alert">{state.message}</p> : null}
        </div>
      </form>
    </main>
  )
}

function SubmissionChoice({
  description,
  label,
  to,
}: {
  description: string
  label: string
  to: string
}) {
  return (
    <article className="panel operations-panel">
      <p className="eyebrow">Game Type</p>
      <h2>{label}</h2>
      <p>{description}</p>
      <Link className="submit-match-button" to={to}>
        Continue
      </Link>
    </article>
  )
}

function TeamTournamentResultSubmission({
  data,
  disabled,
  eventHome,
}: {
  data: TeamTournamentData | null
  disabled: boolean
  eventHome: EventHomeData
}) {
  const [state, setState] = useState<SubmitState>({ status: 'idle' })
  const [winner, setWinner] = useState('')
  const assignment = getTournamentAssignment(data, eventHome)
  const alreadySubmitted = assignment ? assignment.status.toLowerCase() !== 'outstanding' : false

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!data) {
      setState({ message: 'Tournament context is still loading.', status: 'error' })
      return
    }

    const form = new FormData(event.currentTarget)
    const params = Object.fromEntries(form.entries()) as Record<string, string>
    const validation = validateTournamentResult(params, eventHome, assignment, alreadySubmitted)

    if (validation.length > 0) {
      setState({ message: validation.join(' '), status: 'error' })
      return
    }

    setState({ status: 'submitting' })

    try {
      await apiClient.saveTeamTournamentResult({
        ...params,
        eventId: eventHome.event.id,
      })
      setState({
        message: 'Tournament result submitted for commissioner review.',
        status: 'success',
      })
    } catch {
      setState({
        message: 'Tournament result could not be submitted.',
        status: 'error',
      })
    }
  }

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="submit-team-result-title">
        <p className="eyebrow">Team Tournament</p>
        <h1 id="submit-team-result-title">Submit Game</h1>
        <p>Report individual table results against the current tournament pairing.</p>
        <Link className="submit-match-button" to={`/event/${encodeURIComponent(eventHome.event.id)}/tournament`}>
          Return to Tournament
        </Link>
      </section>

      <form className="army-list-form panel" onSubmit={(event) => void submit(event)}>
        <ReadOnlyField label="Event" value={eventHome.event.name} />
        <ReadOnlyField label="Round" value={assignment?.round || getRoundValue(eventHome.currentRound, 'name') || 'Current round'} />
        <ReadOnlyField label="Team" value={assignment?.team || eventHome.registration.currentPlayer?.team || ''} />
        <ReadOnlyField label="Opponent Team" value={assignment?.opponentTeam || ''} />
        <ReadOnlyField label="Table" value={assignment?.table || 'Not published'} />
        <ReadOnlyField label="Mission" value={assignment?.mission || 'Not published'} />
        <ReadOnlyField label="Opponent" value={assignment?.opponent || 'Not published'} />
        {assignment ? (
          <>
            <HiddenField name="roundId" value={assignment.roundId} />
            <HiddenField name="round" value={assignment.round} />
            <HiddenField name="teamA" value={assignment.teamA} />
            <HiddenField name="teamB" value={assignment.teamB} />
            <HiddenField name="table" value={assignment.table} />
            <HiddenField name="player" value={assignment.player} />
            <HiddenField name="opponent" value={assignment.opponent} />
            <HiddenField name="mission" value={assignment.mission} />
          </>
        ) : null}
        <SelectField
          label="Winner"
          name="winner"
          onChange={setWinner}
          options={[assignment?.player ?? '', assignment?.opponent ?? '', 'Draw'].filter(Boolean)}
          required
          value={winner}
        />
        <FormField label="Tournament Points" name="tournamentPoints" required value="" />
        <FormField label="Objective Points" name="objectivePoints" required value="" />
        <FormField label="Victory Points" name="victoryPoints" required value="" />
        <label className="army-list-form-wide">
          <span>Best Moment</span>
          <textarea name="bestMoment" required rows={3} />
        </label>
        <div className="army-list-form-actions">
          <button disabled={disabled || !assignment || alreadySubmitted || state.status === 'submitting'} type="submit">
            {state.status === 'submitting' ? 'Submitting...' : 'Submit Game'}
          </button>
          {!eventHome.registration.currentPlayer ? (
            <p role="alert">You must be registered for this Team Tournament before submitting a result.</p>
          ) : null}
          {!assignment && data ? (
            <p role="alert">No active table pairing was found for your registration.</p>
          ) : null}
          {alreadySubmitted ? <p role="status">This match has already been submitted.</p> : null}
          {state.status === 'success' ? <p role="status">{state.message}</p> : null}
          {state.status === 'error' ? <p role="alert">{state.message}</p> : null}
        </div>
      </form>
    </main>
  )
}

function validateLeagueResult(
  data: EventHomeData,
  submission: LeagueResultSubmission,
  options: {
    factions: PickerOption[]
    missions: PickerOption[]
    opponents: PickerOption[]
  },
) {
  const issues: string[] = []
  const registered = data.registration.currentPlayer

  if (!registered) {
    issues.push('You must be registered for this event before submitting a result.')
  }

  if (!isResultWindowOpen(data)) {
    issues.push('This event is not currently accepting results.')
  }

  if (!submission.opponent.trim()) {
    issues.push('Opponent is required.')
  } else if (!optionContains(options.opponents, submission.opponent)) {
    issues.push('Opponent must be selected from the eligible event players.')
  }

  if (normalize(submission.opponent) === normalize(submission.player)) {
    issues.push('Opponent must be a different player.')
  }

  if (!data.registration.registrations.some((entry) => normalize(entry.player) === normalize(submission.opponent))) {
    issues.push('Opponent must be registered for this event.')
  }

  if (!submission.playerFaction.trim() || !submission.opponentFaction.trim()) {
    issues.push('Both factions are required.')
  }

  if (submission.playerFaction.trim() && !optionContains(options.factions, submission.playerFaction)) {
    issues.push('Registered Faction must be selected from the faction database.')
  }

  if (submission.opponentFaction.trim() && !optionContains(options.factions, submission.opponentFaction)) {
    issues.push('Opponent Faction must be selected from the faction database.')
  }

  if (!submission.mission.trim()) {
    issues.push('Mission is required.')
  } else if (!optionContains(options.missions, submission.mission)) {
    issues.push('Mission must be selected from the mission database.')
  }

  const playerTp = parseScore(submission.playerTournamentPoints)
  const opponentTp = parseScore(submission.opponentTournamentPoints)
  const playerOp = parseScore(submission.playerObjectivePoints)
  const opponentOp = parseScore(submission.opponentObjectivePoints)
  const playerVp = parseScore(submission.playerVictoryPoints)
  const opponentVp = parseScore(submission.opponentVictoryPoints)

  if ([playerTp, opponentTp, playerOp, opponentOp, playerVp, opponentVp].some((score) => score === null)) {
    issues.push('Scores must be non-negative numbers.')
  }

  if (playerTp !== null && opponentTp !== null && playerTp + opponentTp > 10) {
    issues.push('Tournament Points cannot total more than 10.')
  }

  const expectedWinner = determineExpectedWinner(
    submission.player,
    submission.opponent,
    playerTp,
    opponentTp,
    playerOp,
    opponentOp,
    playerVp,
    opponentVp,
  )
  if (expectedWinner && submission.winner && normalize(expectedWinner) !== normalize(submission.winner)) {
    issues.push('Winner must match the submitted TP, OP, and VP scores.')
  }

  return issues
}

function validateCasualResult(
  submission: CasualResultSubmission,
  options: {
    factions: PickerOption[]
    missions: PickerOption[]
    opponents: PickerOption[]
  },
) {
  const issues: string[] = []

  if (!submission.player.trim()) {
    issues.push('Player is required.')
  }

  if (!submission.opponent.trim()) {
    issues.push('Opponent is required.')
  } else if (!optionContains(options.opponents, submission.opponent)) {
    issues.push('Opponent must be selected from active portal players.')
  }

  if (normalize(submission.opponent) === normalize(submission.player)) {
    issues.push('Opponent must be a different player.')
  }

  if (!submission.playerFaction.trim() || !submission.opponentFaction.trim()) {
    issues.push('Both factions are required.')
  }

  if (submission.playerFaction.trim() && !optionContains(options.factions, submission.playerFaction)) {
    issues.push('Player Faction must be selected from the faction database.')
  }

  if (submission.opponentFaction.trim() && !optionContains(options.factions, submission.opponentFaction)) {
    issues.push('Opponent Faction must be selected from the faction database.')
  }

  if (!submission.mission.trim()) {
    issues.push('Mission is required.')
  } else if (!optionContains(options.missions, submission.mission)) {
    issues.push('Mission must be selected from the mission database.')
  }

  if (!submission.firstTurn.trim()) {
    issues.push('First Turn is required.')
  }

  if (!submission.bestMoment.trim()) {
    issues.push('Best Moment is required.')
  }

  const playerTp = parseScore(submission.playerTournamentPoints)
  const opponentTp = parseScore(submission.opponentTournamentPoints)
  const playerOp = parseScore(submission.playerObjectivePoints)
  const opponentOp = parseScore(submission.opponentObjectivePoints)
  const playerVp = parseScore(submission.playerVictoryPoints)
  const opponentVp = parseScore(submission.opponentVictoryPoints)

  if ([playerTp, opponentTp, playerOp, opponentOp, playerVp, opponentVp].some((score) => score === null)) {
    issues.push('Scores must be non-negative numbers.')
  }

  if (playerTp !== null && opponentTp !== null && playerTp + opponentTp > 10) {
    issues.push('Tournament Points cannot total more than 10.')
  }

  const expectedWinner = determineExpectedWinner(
    submission.player,
    submission.opponent,
    playerTp,
    opponentTp,
    playerOp,
    opponentOp,
    playerVp,
    opponentVp,
  )
  if (!submission.winner.trim()) {
    issues.push('Winner is required.')
  } else if (expectedWinner && normalize(expectedWinner) !== normalize(submission.winner)) {
    issues.push('Winner must match the submitted TP, OP, and VP scores.')
  }

  return issues
}

type TournamentAssignment = {
  mission: string
  opponent: string
  opponentTeam: string
  player: string
  round: string
  roundId: string
  status: string
  table: string
  team: string
  teamA: string
  teamB: string
}

function getTournamentAssignment(
  data: TeamTournamentData | null,
  eventHome: EventHomeData,
): TournamentAssignment | null {
  if (!data || !eventHome.registration.currentPlayer) {
    return null
  }

  const registration = eventHome.registration.currentPlayer
  const player = registration.player || registration.displayName
  const team = registration.team || registration.preferredTeam

  if (!player || !team) {
    return null
  }

  const table = data.resultStatuses.find((status) => (
    sameValue(status.player, player) || sameValue(status.opponent, player)
  ))

  if (!table) {
    return null
  }

  const flipped = sameValue(table.opponent, player)
  const mission = getCanonicalMissionName(
    getRoundValue(data.currentRound, 'mission') ||
      getRoundValue(data.currentRound, 'Mission') ||
      getRoundValue(eventHome.currentRound, 'mission') ||
      getRoundValue(eventHome.currentRound, 'Mission'),
  )

  return {
    mission,
    opponent: flipped ? table.player : table.opponent,
    opponentTeam: sameValue(table.teamA, team) ? table.teamB : table.teamA,
    player,
    round: table.round,
    roundId: table.roundId,
    status: table.status,
    table: table.table,
    team,
    teamA: table.teamA,
    teamB: table.teamB,
  }
}

function validateTournamentResult(
  params: Record<string, string>,
  eventHome: EventHomeData,
  assignment: TournamentAssignment | null,
  alreadySubmitted: boolean,
) {
  const issues: string[] = []

  if (!eventHome.registration.currentPlayer) {
    issues.push('You must be registered for this Team Tournament before submitting a result.')
  }

  if (!isResultWindowOpen(eventHome)) {
    issues.push('This Team Tournament round is not currently accepting results.')
  }

  if (!assignment) {
    issues.push('No active table pairing was found for your registration.')
    return issues
  }

  if (alreadySubmitted) {
    issues.push('This match has already been submitted.')
  }

  if (!params.tournamentPoints?.trim() || !params.objectivePoints?.trim() || !params.victoryPoints?.trim()) {
    issues.push('Tournament Points, Objective Points, and Victory Points are required.')
  }

  if (!params.winner?.trim()) {
    issues.push('Winner is required.')
  }

  return issues
}

function isResultWindowOpen(data: EventHomeData) {
  const status = `${data.event.status} ${data.event.lifecycleStage}`.toLowerCase()
  return !status.includes('archived') && !status.includes('completed') && !status.includes('registration open')
}

function determineExpectedWinner(
  player: string,
  opponent: string,
  playerTp: number | null,
  opponentTp: number | null,
  playerOp: number | null,
  opponentOp: number | null,
  playerVp: number | null,
  opponentVp: number | null,
) {
  if ([playerTp, opponentTp, playerOp, opponentOp, playerVp, opponentVp].some((score) => score === null)) {
    return ''
  }

  if (playerTp !== opponentTp) {
    return Number(playerTp) > Number(opponentTp) ? player : opponent
  }

  if (playerOp !== opponentOp) {
    return Number(playerOp) > Number(opponentOp) ? player : opponent
  }

  if (playerVp !== opponentVp) {
    return Number(playerVp) > Number(opponentVp) ? player : opponent
  }

  return 'Draw'
}

function parseScore(value: string) {
  if (value.trim() === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function getRoundValue(round: Record<string, unknown> | null, key: string) {
  return typeof round?.[key] === 'string' ? round[key] : ''
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function sameValue(left: string, right: string) {
  return normalize(left) === normalize(right)
}

function optionContains(options: PickerOption[], value: string) {
  const normalized = normalize(value)
  return options.some((option) => normalize(option.value) === normalized)
}

function toPickerOptions(values: string[]) {
  const seen = new Set<string>()

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const normalized = normalize(value)
      if (seen.has(normalized)) {
        return false
      }

      seen.add(normalized)
      return true
    })
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      label: value,
      value,
    }))
}

function buildPlayerOptions(searchIndex: SearchData | null): PickerOption[] {
  const seen = new Map<string, PickerOption>()

  searchIndex?.players.forEach((division) => {
    division.standings.forEach((player) => {
      const value = player.player.trim()
      if (!value) {
        return
      }

      const key = normalize(value)
      if (seen.has(key)) {
        return
      }

      seen.set(key, {
        label: player.displayName || value,
        meta: division.divisionLabel,
        value,
      })
    })
  })

  return Array.from(seen.values()).sort((left, right) =>
    left.label.localeCompare(right.label),
  )
}

function buildFactionOptions(
  searchIndex: SearchData | null,
  eventHome: EventHomeData | null,
) {
  return toPickerOptions([
    ...(searchIndex?.factions.map((faction) => faction.name) ?? []),
    ...(eventHome?.registration.registrations.map((entry) => entry.faction) ?? []),
    ...canonicalFactionFallbacks,
  ])
}

function buildMissionOptions() {
  return getCanonicalMissionOptions()
}

function buildEventOpponentOptions(
  eventHome: EventHomeData | null,
  allPlayers: PickerOption[],
  currentPlayer: string,
  currentPlayerDivision: string,
  showAllPlayers: boolean,
) {
  if (showAllPlayers) {
    return allPlayers.filter((option) => !sameValue(option.value, currentPlayer))
  }

  const currentRegistration = eventHome?.registration.currentPlayer
  const currentDivision = resolveLeagueDivision(
    currentPlayerDivision,
    currentRegistration?.notes,
    getPlayerRegistryDivision(allPlayers, currentPlayer),
  )
  const isLeagueEvent = eventHome?.event.type.toLowerCase().includes('league') ?? false
  const scheduledOpponent = eventHome?.playerStatus.upcomingMatch ?? ''
  const options = (eventHome?.registration.registrations ?? [])
    .filter((entry) => !sameValue(entry.player, currentPlayer))
    .filter((entry) => !['removed', 'withdrawn'].includes(entry.status.toLowerCase()))
    .filter((entry) => {
      if (!isLeagueEvent) {
        return true
      }

      const entryDivision = resolveLeagueDivision(
        entry.notes,
        getPlayerRegistryDivision(allPlayers, entry.player),
      )

      return currentDivision !== '' && entryDivision === currentDivision
    })
    .map((entry) => ({
      label: entry.displayName || entry.player,
      meta: [
        isLeagueEvent && currentDivision ? 'Same division' : '',
        entry.team || entry.preferredTeam || '',
        entry.faction || '',
      ].filter(Boolean).join(' · '),
      value: entry.player,
    }))

  return options.sort((left, right) => {
    const leftScheduled = isScheduledOpponent(left, scheduledOpponent) ? 0 : 1
    const rightScheduled = isScheduledOpponent(right, scheduledOpponent) ? 0 : 1
    const leftSameDivision = left.meta?.includes('Same division') ? 0 : 1
    const rightSameDivision = right.meta?.includes('Same division') ? 0 : 1
    return (
      leftScheduled - rightScheduled ||
      leftSameDivision - rightSameDivision ||
      left.label.localeCompare(right.label)
    )
  })
}

function getPlayerRegistryDivision(players: PickerOption[], player: string) {
  return players.find((option) => sameValue(option.value, player) || sameValue(option.label, player))?.meta ?? ''
}

function resolveLeagueDivision(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizeDivision(value)

    if (normalized) {
      return normalized
    }
  }

  return ''
}

function normalizeDivision(value: string | undefined) {
  const normalized = normalize(value ?? '')

  if (!normalized) {
    return ''
  }

  if (normalized === 'main' || normalized.includes('mainman') || normalized.includes('main')) {
    return 'main'
  }

  if (
    normalized === 'pga' ||
    normalized.includes('provinggroundsa') ||
    normalized.includes('provinggrounda')
  ) {
    return 'pga'
  }

  if (
    normalized === 'pgb' ||
    normalized.includes('provinggroundsb') ||
    normalized.includes('provinggroundb')
  ) {
    return 'pgb'
  }

  return normalized
}

function isScheduledOpponent(option: PickerOption, scheduledOpponent: string) {
  const scheduled = normalize(scheduledOpponent)

  if (!scheduled) {
    return false
  }

  const value = normalize(option.value)
  const label = normalize(option.label)

  return scheduled === value || scheduled === label || scheduled.includes(value) || scheduled.includes(label)
}

function HiddenField({ name, value }: { name: string; value: string }) {
  return <input name={name} readOnly type="hidden" value={value} />
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label>
      <span>{label}</span>
      <input readOnly value={value} />
    </label>
  )
}

function ScoreField({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <FormField
      label={label}
      onChange={onChange}
      required
      type="number"
      value={value}
    />
  )
}

function SearchableSelect({
  disabled = false,
  label,
  name,
  onChange,
  options,
  placeholder = 'Search',
  required = false,
  value,
}: {
  disabled?: boolean
  label: string
  name?: string
  onChange: (value: string) => void
  options: PickerOption[]
  placeholder?: string
  required?: boolean
  value: string
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = options.find((option) => sameValue(option.value, value))
  const displayValue = selected?.label || value
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query)
    const candidates = normalizedQuery
      ? options.filter((option) =>
          normalize(`${option.label} ${option.meta ?? ''}`).includes(normalizedQuery),
        )
      : options

    return candidates.slice(0, 20)
  }, [options, query])

  function choose(option: PickerOption) {
    onChange(option.value)
    setQuery('')
    setIsOpen(false)
    setActiveIndex(0)
  }

  return (
    <label className="searchable-select">
      <span>{label}</span>
      {name ? <input name={name} readOnly type="hidden" value={value} /> : null}
      <input
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-invalid={required && value === '' ? true : undefined}
        disabled={disabled}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
          setActiveIndex(0)
        }}
        onFocus={() => {
          setQuery('')
          setIsOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false)
            setQuery('')
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIsOpen(true)
            setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1))
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((index) => Math.max(index - 1, 0))
            return
          }

          if (event.key === 'Enter' && isOpen && filteredOptions[activeIndex]) {
            event.preventDefault()
            choose(filteredOptions[activeIndex])
          }
        }}
        placeholder={placeholder}
        role="combobox"
        value={isOpen ? query : displayValue}
      />
      {isOpen ? (
        <div className="searchable-select-menu" role="listbox">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <button
                aria-selected={sameValue(option.value, value)}
                className={index === activeIndex ? 'active' : ''}
                key={option.value}
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(option)
                }}
                role="option"
                type="button"
              >
                <strong>{option.label}</strong>
                {option.meta ? <small>{option.meta}</small> : null}
              </button>
            ))
          ) : (
            <span className="searchable-select-empty">No matching options</span>
          )}
        </div>
      ) : null}
    </label>
  )
}

function SelectField({
  label,
  name,
  onChange,
  options,
  required = false,
  value,
}: {
  label: string
  name?: string
  onChange: (value: string) => void
  options: string[]
  required?: boolean
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function FormField({
  label,
  name,
  onChange,
  required = false,
  type = 'text',
  value,
}: {
  label: string
  name?: string
  onChange?: (value: string) => void
  required?: boolean
  type?: string
  value: string
}) {
  const valueProps = onChange
    ? {
        value,
      }
    : {
        defaultValue: value,
      }

  return (
    <label>
      <span>{label}</span>
      <input
        {...valueProps}
        name={name}
        onChange={(event) => {
          onChange?.(event.target.value)
        }}
        required={required}
        type={type}
      />
    </label>
  )
}

export default SubmitResult
