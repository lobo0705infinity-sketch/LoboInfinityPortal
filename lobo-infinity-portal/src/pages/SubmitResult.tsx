import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Skeleton from '../components/Skeleton'
import {
  getCanonicalArmyName,
  getCanonicalArmyOptions,
} from '../config/armies'
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
import { resolveSubmitGamePlayer } from '../services/submitGameIdentity'
import {
  buildSubmitGameOpponentEventHome,
  buildSubmitGameOpponentResolution,
  buildSubmitGamePlayerOptions,
  isTournamentEventType,
} from '../services/submitGameOpponents'
import { recordSubmitGameOpponentResolutionDiagnostic } from '../services/diagnostics'

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

function SubmitResult() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const rememberedSubmitContext = searchParams.get('f') ?? ''
  const inferredSubmitContext = useMemo(
    () => inferSubmitGameContext(rememberedSubmitContext),
    [rememberedSubmitContext],
  )
  const selectedGameType =
    searchParams.get('gameType') ??
    inferredSubmitContext.gameType
  const eventId =
    searchParams.get('eventId') ??
    inferredSubmitContext.eventId ??
    'event-current-league'
  const isCasualRoute = selectedGameType === 'casual'
  const shouldShowGameTypeSelector = !selectedGameType
  const [eventHome, setEventHome] = useState<EventHomeData | null>(null)
  const [teamTournament, setTeamTournament] = useState<TeamTournamentData | null>(null)
  const [searchIndex, setSearchIndex] = useState<SearchData | null>(null)
  const [showAllOpponents, setShowAllOpponents] = useState(false)
  const [commissionerMode, setCommissionerMode] = useState(false)
  const [commissionerOverride, setCommissionerOverride] = useState(false)
  const [commissionerReason, setCommissionerReason] = useState('')
  const [state, setState] = useState<SubmitState>({ status: 'loading' })
  const authenticatedSubmitGamePlayer = useMemo(
    () =>
      resolveSubmitGamePlayer(
        auth.authenticated,
        auth.user.canonicalPlayer,
        auth.user.leaguePlayer,
        auth.user.playerDisplayName,
        auth.user.displayName,
      ),
    [
      auth.authenticated,
      auth.user.canonicalPlayer,
      auth.user.displayName,
      auth.user.leaguePlayer,
      auth.user.playerDisplayName,
    ],
  )
  const [leagueResult, setLeagueResult] = useState<LeagueResultSubmission>({
    ...emptyLeagueResult,
    eventId,
  })
  const [casualResult, setCasualResult] = useState<CasualResultSubmission>({
    ...emptyLeagueResult,
    division: undefined,
    eventId: undefined,
    player: authenticatedSubmitGamePlayer,
    playerFaction: getCanonicalArmyName(auth.user.favoriteFaction),
    round: undefined,
  })
  const canOverrideOpponentFilter = auth.isAtLeastRole('Commissioner')
  const isCommissionerSubmission = canOverrideOpponentFilter && commissionerMode
  const isCommissionerOverride = isCommissionerSubmission && commissionerOverride
  const allPlayerOptions = useMemo(() => buildSubmitGamePlayerOptions(searchIndex), [searchIndex])
  const factionOptions = useMemo(() => buildFactionOptions(), [])
  const missionOptions = useMemo(() => buildMissionOptions(), [])
  const leagueOpponentEventHome = useMemo(
    () => buildSubmitGameOpponentEventHome(eventHome),
    [eventHome],
  )
  const leagueOpponentResolution = useMemo(
    () =>
      buildSubmitGameOpponentResolution({
        allPlayers: allPlayerOptions,
        currentPlayer: leagueResult.player,
        currentPlayerDivision: leagueResult.division,
        currentUserEmail: auth.user.email,
        eventHome: leagueOpponentEventHome,
        showAllPlayers:
          (showAllOpponents || commissionerOverride) && canOverrideOpponentFilter,
        tournamentRegistrations: teamTournament?.registration.registrations,
      }),
    [allPlayerOptions, auth.user.email, canOverrideOpponentFilter, commissionerOverride, leagueOpponentEventHome, leagueResult.division, leagueResult.player, showAllOpponents, teamTournament?.registration.registrations],
  )
  const leagueOpponentOptions = leagueOpponentResolution.options
  const casualOpponentOptions = useMemo(
    () => allPlayerOptions.filter((option) => !sameValue(option.value, casualResult.player)),
    [allPlayerOptions, casualResult.player],
  )

  function buildCommissionerPayload<T extends LeagueResultSubmission | CasualResultSubmission>(
    submission: T,
  ): T {
    if (!isCommissionerSubmission) {
      return submission
    }

    return {
      ...submission,
      commissionerMode: true,
      commissionerOverride: isCommissionerOverride,
      commissionerReason,
    }
  }

  useEffect(() => {
    if (
      !eventHome ||
      isTournamentEventType(eventHome.event.type) ||
      leagueOpponentResolution.options.length > 0
    ) {
      return
    }

    const exclusionReasonCounts = new Map<string, number>()
    leagueOpponentResolution.exclusions.forEach((entry) => {
      exclusionReasonCounts.set(
        entry.reason,
        (exclusionReasonCounts.get(entry.reason) ?? 0) + 1,
      )
    })

    recordSubmitGameOpponentResolutionDiagnostic({
      authenticatedPlayer: authenticatedSubmitGamePlayer,
      currentRegistrationPlayer:
        leagueOpponentResolution.currentRegistration?.player ?? '',
      currentRegistrationStatus:
        leagueOpponentResolution.currentRegistration?.status ?? '',
      eligibleOpponentCount: leagueOpponentResolution.options.length,
      eventId: eventHome.event.id,
      eventName: eventHome.event.name,
      exclusionReasons: Array.from(exclusionReasonCounts.entries()).map(
        ([reason, count]) => ({ count, reason }),
      ),
      leaguePlayer: auth.user.canonicalPlayer || auth.user.leaguePlayer,
      participantCount: leagueOpponentResolution.participantCount,
      playerId: leagueResult.player,
      resolvedDivision: leagueOpponentResolution.resolvedDivision,
      timestamp: new Date().toISOString(),
    })

    console.groupCollapsed('LOBO SUBMIT GAME OPPONENT RESOLUTION')
    console.info({
      authenticatedPlayer: authenticatedSubmitGamePlayer,
      currentRegistration: leagueOpponentResolution.currentRegistration,
      eligibleOpponentCount: leagueOpponentResolution.options.length,
      event: eventHome.event,
      exclusions: leagueOpponentResolution.exclusions,
      leaguePlayer: auth.user.canonicalPlayer || auth.user.leaguePlayer,
      participantCount: leagueOpponentResolution.participantCount,
      playerId: leagueResult.player,
      resolvedDivision: leagueOpponentResolution.resolvedDivision,
    })
    console.groupEnd()
  }, [
    auth.user.canonicalPlayer,
    auth.user.leaguePlayer,
    authenticatedSubmitGamePlayer,
    eventHome,
    leagueOpponentResolution,
    leagueResult.player,
  ])

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
          player: authenticatedSubmitGamePlayer || current.player,
          playerFaction:
            getCanonicalArmyName(current.playerFaction) ||
            getCanonicalArmyName(auth.user.favoriteFaction),
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

        const player =
          authenticatedSubmitGamePlayer ||
          home.registration.currentPlayer?.player ||
          ''
        const currentPlayer = home.registration.currentPlayer
        setLeagueResult((current) => ({
          ...current,
          division: currentPlayer?.notes || auth.user.leagueDivision || '',
          eventId: home.event.id,
          mission:
            getCanonicalMissionName(
              getRoundValue(home.currentRound, 'mission') ||
                getRoundValue(home.currentRound, 'Mission'),
            ) || '',
          player,
          playerFaction:
            getCanonicalArmyName(currentPlayer?.faction) ||
            getCanonicalArmyName(auth.user.favoriteFaction),
          round:
            getRoundValue(home.currentRound, 'name') ||
            getRoundValue(home.currentRound, 'round') ||
            home.statistics.currentRound,
        }))

        if (isTournamentEventType(home.event.type)) {
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
    authenticatedSubmitGamePlayer,
    auth.user.favoriteFaction,
    auth.user.leagueDivision,
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
      await apiClient.submitCasualResult(buildCommissionerPayload(casualResult))
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
          {canOverrideOpponentFilter ? (
            <CommissionerModeControls
              commissionerMode={commissionerMode}
              commissionerOverride={commissionerOverride}
              reason={commissionerReason}
              setCommissionerMode={setCommissionerMode}
              setCommissionerOverride={setCommissionerOverride}
              setReason={setCommissionerReason}
            />
          ) : null}
          {isCommissionerSubmission ? (
            <SearchableSelect
              label="Player 1"
              onChange={(value) => updateCasualField('player', value)}
              options={allPlayerOptions}
              placeholder="Search active players"
              required
              value={casualResult.player}
            />
          ) : (
            <ReadOnlyField
              label="Player"
              value={casualResult.player}
            />
          )}
          <SearchableSelect
            label={isCommissionerSubmission ? 'Player 2' : 'Opponent'}
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
            label="Game Result"
            onChange={(value) => updateCasualField('winner', value)}
            options={buildGameResultOptions(casualResult.player, casualResult.opponent)}
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
        allPlayerOptions={allPlayerOptions}
        commissionerMode={isCommissionerSubmission}
        commissionerOverride={isCommissionerOverride}
        commissionerReason={commissionerReason}
        data={teamTournament}
        disabled={!auth.authenticated || state.status === 'loading'}
        eventHome={eventHome}
        isCommissioner={canOverrideOpponentFilter}
        setCommissionerMode={setCommissionerMode}
        setCommissionerOverride={setCommissionerOverride}
        setCommissionerReason={setCommissionerReason}
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
      commissionerMode: isCommissionerSubmission,
      commissionerOverride: isCommissionerOverride,
      factions: factionOptions,
      missions: missionOptions,
      opponents: isCommissionerOverride
        ? allPlayerOptions.filter((option) => !sameValue(option.value, leagueResult.player))
        : leagueOpponentOptions,
    })

    if (validation.length > 0) {
      setState({ message: validation.join(' '), status: 'error' })
      return
    }

    setState({ status: 'submitting' })

    try {
      await apiClient.submitLeagueResult(buildCommissionerPayload(leagueResult))
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
        {canOverrideOpponentFilter ? (
          <CommissionerModeControls
            commissionerMode={commissionerMode}
            commissionerOverride={commissionerOverride}
            reason={commissionerReason}
            setCommissionerMode={setCommissionerMode}
            setCommissionerOverride={setCommissionerOverride}
            setReason={setCommissionerReason}
          />
        ) : null}
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
        {isCommissionerSubmission ? (
          <SearchableSelect
            label="Player 1"
            onChange={(value) => {
              const registration = eventHome?.registration.registrations.find((entry) => (
                sameValue(entry.player, value) || sameValue(entry.displayName, value)
              ))
              updateField('player', value)
              updateField('division', registration?.notes || getPlayerOptionMeta(allPlayerOptions, value))
              updateField('opponent', '')
              updateField('winner', '')
              setShowAllOpponents(false)
            }}
            options={allPlayerOptions}
            placeholder="Search players"
            required
            value={leagueResult.player}
          />
        ) : (
          <ReadOnlyField
            label="Player"
            value={leagueResult.player || auth.user.canonicalPlayer || auth.user.leaguePlayer}
          />
        )}
        <SearchableSelect
          label={isCommissionerSubmission ? 'Player 2' : 'Opponent'}
          onChange={(value) => updateField('opponent', value)}
          options={isCommissionerOverride ? allPlayerOptions.filter((option) => !sameValue(option.value, leagueResult.player)) : leagueOpponentOptions}
          placeholder="Search eligible opponents"
          required
          value={leagueResult.opponent}
        />
        {canOverrideOpponentFilter && !isCommissionerSubmission ? (
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
          label="Game Result"
          onChange={(value) => updateField('winner', value)}
          options={buildGameResultOptions(leagueResult.player, leagueResult.opponent)}
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

function CommissionerModeControls({
  commissionerMode,
  commissionerOverride,
  reason,
  setCommissionerMode,
  setCommissionerOverride,
  setReason,
}: {
  commissionerMode: boolean
  commissionerOverride: boolean
  reason: string
  setCommissionerMode: (value: boolean) => void
  setCommissionerOverride: (value: boolean) => void
  setReason: (value: string) => void
}) {
  return (
    <fieldset className="army-list-form-wide submit-game-commissioner-mode">
      <legend>Commissioner Mode</legend>
      <label className="event-registration-check">
        <input
          checked={commissionerMode}
          onChange={(event) => {
            setCommissionerMode(event.target.checked)
            if (!event.target.checked) {
              setCommissionerOverride(false)
              setReason('')
            }
          }}
          type="checkbox"
        />
        <span>Submit Game For Other Players</span>
      </label>
      {commissionerMode ? (
        <>
          <label className="event-registration-check">
            <input
              checked={commissionerOverride}
              onChange={(event) => setCommissionerOverride(event.target.checked)}
              type="checkbox"
            />
            <span>Commissioner Override</span>
          </label>
          <label>
            <span>Reason</span>
            <input
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional audit note"
              value={reason}
            />
          </label>
        </>
      ) : null}
    </fieldset>
  )
}

function TeamTournamentResultSubmission({
  allPlayerOptions,
  commissionerMode,
  commissionerOverride,
  commissionerReason,
  data,
  disabled,
  eventHome,
  isCommissioner,
  setCommissionerMode,
  setCommissionerOverride,
  setCommissionerReason,
}: {
  allPlayerOptions: PickerOption[]
  commissionerMode: boolean
  commissionerOverride: boolean
  commissionerReason: string
  data: TeamTournamentData | null
  disabled: boolean
  eventHome: EventHomeData
  isCommissioner: boolean
  setCommissionerMode: (value: boolean) => void
  setCommissionerOverride: (value: boolean) => void
  setCommissionerReason: (value: string) => void
}) {
  const [state, setState] = useState<SubmitState>({ status: 'idle' })
  const [winner, setWinner] = useState('')
  const defaultPlayer =
    eventHome.registration.currentPlayer?.player ||
    eventHome.registration.currentPlayer?.displayName ||
    ''
  const [selectedPlayer, setSelectedPlayer] = useState(defaultPlayer)
  const [selectedOpponent, setSelectedOpponent] = useState('')
  const assignment = getTournamentAssignment(
    data,
    eventHome,
    commissionerMode ? selectedPlayer : '',
  )
  const alreadySubmitted = assignment ? assignment.status.toLowerCase() !== 'outstanding' : false
  const tournamentPlayerOptions = useMemo(
    () => buildTournamentPlayerOptions(data, eventHome, allPlayerOptions, commissionerOverride),
    [allPlayerOptions, commissionerOverride, data, eventHome],
  )
  const tournamentOpponentOptions = useMemo(
    () => buildTournamentOpponentPickerOptions(
      data,
      eventHome,
      allPlayerOptions,
      selectedPlayer,
      commissionerOverride,
    ),
    [allPlayerOptions, commissionerOverride, data, eventHome, selectedPlayer],
  )
  const effectiveOpponent = commissionerMode
    ? selectedOpponent || assignment?.opponent || ''
    : assignment?.opponent || ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!data) {
      setState({ message: 'Tournament context is still loading.', status: 'error' })
      return
    }

    const form = new FormData(event.currentTarget)
    const params = Object.fromEntries(form.entries()) as Record<string, string>
    const validation = validateTournamentResult(
      {
        ...params,
        opponent: effectiveOpponent,
        player: commissionerMode ? selectedPlayer : assignment?.player || '',
      },
      eventHome,
      assignment,
      alreadySubmitted,
      commissionerMode,
      commissionerOverride,
    )

    if (validation.length > 0) {
      setState({ message: validation.join(' '), status: 'error' })
      return
    }

    setState({ status: 'submitting' })

    try {
      await apiClient.saveTeamTournamentResult({
        ...params,
        commissionerMode: commissionerMode ? 'true' : '',
        commissionerOverride: commissionerOverride ? 'true' : '',
        commissionerReason,
        eventId: eventHome.event.id,
        opponent: effectiveOpponent,
        player: commissionerMode ? selectedPlayer : assignment?.player || '',
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
        {isCommissioner ? (
          <CommissionerModeControls
            commissionerMode={commissionerMode}
            commissionerOverride={commissionerOverride}
            reason={commissionerReason}
            setCommissionerMode={setCommissionerMode}
            setCommissionerOverride={setCommissionerOverride}
            setReason={setCommissionerReason}
          />
        ) : null}
        <ReadOnlyField label="Event" value={eventHome.event.name} />
        <ReadOnlyField label="Round" value={assignment?.round || getRoundValue(eventHome.currentRound, 'name') || 'Current round'} />
        <ReadOnlyField label="Team" value={assignment?.team || eventHome.registration.currentPlayer?.team || ''} />
        <ReadOnlyField label="Opponent Team" value={assignment?.opponentTeam || ''} />
        <ReadOnlyField label="Table" value={assignment?.table || 'Not published'} />
        <ReadOnlyField label="Mission" value={assignment?.mission || 'Not published'} />
        {commissionerMode ? (
          <>
            <SearchableSelect
              label="Player 1"
              onChange={(value) => {
                setSelectedPlayer(value)
                setSelectedOpponent('')
                setWinner('')
              }}
              options={tournamentPlayerOptions}
              placeholder="Search tournament players"
              required
              value={selectedPlayer}
            />
            <SearchableSelect
              label="Player 2"
              onChange={(value) => {
                setSelectedOpponent(value)
                setWinner('')
              }}
              options={tournamentOpponentOptions}
              placeholder="Search tournament opponents"
              required
              value={effectiveOpponent}
            />
          </>
        ) : (
          <ReadOnlyField label="Opponent" value={assignment?.opponent || 'Not published'} />
        )}
        {assignment ? (
          <>
            <HiddenField name="roundId" value={assignment.roundId} />
            <HiddenField name="round" value={assignment.round} />
            <HiddenField name="teamA" value={assignment.teamA} />
            <HiddenField name="teamB" value={assignment.teamB} />
            <HiddenField name="table" value={assignment.table} />
            <HiddenField name="player" value={commissionerMode ? selectedPlayer : assignment.player} />
            <HiddenField name="opponent" value={effectiveOpponent} />
            <HiddenField name="mission" value={assignment.mission} />
          </>
        ) : null}
        <SelectField
          label="Game Result"
          name="winner"
          onChange={setWinner}
          options={buildGameResultOptions(commissionerMode ? selectedPlayer : assignment?.player ?? '', effectiveOpponent)}
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
          <button disabled={disabled || (!assignment && !commissionerOverride) || alreadySubmitted || state.status === 'submitting'} type="submit">
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
    commissionerMode?: boolean
    commissionerOverride?: boolean
    factions: PickerOption[]
    missions: PickerOption[]
    opponents: PickerOption[]
  },
) {
  const issues: string[] = []
  const registered = data.registration.currentPlayer

  if (!registered && !options.commissionerMode) {
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

  if (
    !options.commissionerOverride &&
    !data.eligibleOpponents.some((entry) => entry.active && normalize(entry.playerId) === normalize(submission.opponent))
  ) {
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

  if (!submission.winner.trim()) {
    issues.push('Game Result is required.')
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

  if (!submission.winner.trim()) {
    issues.push('Game Result is required.')
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
  selectedPlayer = '',
): TournamentAssignment | null {
  if (!data || (!eventHome.registration.currentPlayer && !selectedPlayer)) {
    return null
  }

  const registration = eventHome.registration.currentPlayer
  const player = selectedPlayer || registration?.player || registration?.displayName || ''
  const selectedRegistration = data.registration.registrations.find((entry) => (
    sameValue(entry.player, player) || sameValue(entry.displayName, player)
  ))
  const team =
    selectedRegistration?.team ||
    selectedRegistration?.preferredTeam ||
    registration?.team ||
    registration?.preferredTeam ||
    ''

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
  commissionerMode = false,
  commissionerOverride = false,
) {
  const issues: string[] = []

  if (!eventHome.registration.currentPlayer && !commissionerMode) {
    issues.push('You must be registered for this Team Tournament before submitting a result.')
  }

  if (!isResultWindowOpen(eventHome)) {
    issues.push('This Team Tournament round is not currently accepting results.')
  }

  if (!assignment && !commissionerOverride) {
    issues.push('No active table pairing was found for your registration.')
    return issues
  }

  if (alreadySubmitted) {
    issues.push('This match has already been submitted.')
  }

  if (!params.tournamentPoints?.trim() || !params.objectivePoints?.trim() || !params.victoryPoints?.trim()) {
    issues.push('Tournament Points, Objective Points, and Victory Points are required.')
  }

  if (!params.player?.trim() || !params.opponent?.trim()) {
    issues.push('Player 1 and Player 2 are required.')
  }

  if (normalize(params.player || '') === normalize(params.opponent || '')) {
    issues.push('Player 2 must be different from Player 1.')
  }

  if (!params.winner?.trim()) {
    issues.push('Game Result is required.')
  }

  return issues
}

function isResultWindowOpen(data: EventHomeData) {
  const status = `${data.event.status} ${data.event.lifecycleStage}`.toLowerCase()
  return !status.includes('archived') && !status.includes('completed') && !status.includes('registration open')
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

function getPlayerOptionMeta(options: PickerOption[], value: string) {
  return options.find((option) => (
    sameValue(option.value, value) ||
    sameValue(option.label, value)
  ))?.meta ?? ''
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

function buildFactionOptions() {
  return toPickerOptions(getCanonicalArmyOptions())
}

function buildMissionOptions() {
  return getCanonicalMissionOptions()
}

function inferSubmitGameContext(route: string): {
  eventId?: string
  gameType: string
} {
  if (!route || route === '/') {
    return { gameType: '' }
  }

  const [pathname, search = ''] = route.split('?')
  const params = new URLSearchParams(search)
  const explicitGameType = params.get('gameType')
  const explicitEventId = params.get('eventId')

  if (explicitGameType) {
    return {
      eventId: explicitEventId || undefined,
      gameType: explicitGameType,
    }
  }

  const routeEventId =
    explicitEventId ||
    pathname.match(/^\/event\/([^/?#]+)/)?.[1] ||
    (pathname === '/team-tournament'
      ? 'event-august-2026-team-tournament'
      : '')

  if (routeEventId) {
    return {
      eventId: decodeURIComponent(routeEventId),
      gameType: 'event',
    }
  }

  if (/^\/(?:army-lists|news|notifications|streams|timeline)(?:\/|$)/.test(pathname)) {
    return { gameType: 'casual' }
  }

  if (
    /^\/(?:analytics|compare|factions|hall-of-fame|intelligence|match-finder|missions|players|rivalries|rules|schedule|standings)(?:\/|$)/.test(pathname)
  ) {
    return {
      eventId: 'event-current-league',
      gameType: 'event',
    }
  }

  return { gameType: '' }
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

    return candidates
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

type SelectFieldOption = string | { label: string; value: string }

function buildGameResultOptions(player: string, opponent: string): SelectFieldOption[] {
  const options: SelectFieldOption[] = []

  if (player.trim()) {
    options.push({ label: 'Player 1 Victory', value: player })
  }

  if (opponent.trim()) {
    options.push({ label: 'Player 2 Victory', value: opponent })
  }

  options.push({ label: 'Draw', value: 'Draw' })

  return options
}

function buildTournamentPlayerOptions(
  data: TeamTournamentData | null,
  eventHome: EventHomeData,
  allPlayers: PickerOption[],
  commissionerOverride: boolean,
) {
  if (commissionerOverride) {
    return allPlayers
  }

  return toPickerOptions(
    (data?.registration.registrations ?? eventHome.registration.registrations)
      .filter((entry) => !['deleted', 'removed', 'withdrawn'].includes(normalize(entry.status)))
      .map((entry) => entry.player || entry.displayName),
  )
}

function buildTournamentOpponentPickerOptions(
  data: TeamTournamentData | null,
  eventHome: EventHomeData,
  allPlayers: PickerOption[],
  selectedPlayer: string,
  commissionerOverride: boolean,
) {
  if (commissionerOverride) {
    return allPlayers.filter((option) => !sameValue(option.value, selectedPlayer))
  }

  return toPickerOptions(
    (data?.registration.registrations ?? eventHome.registration.registrations)
      .filter((entry) => !['deleted', 'removed', 'withdrawn'].includes(normalize(entry.status)))
      .map((entry) => entry.player || entry.displayName)
      .filter((player) => !sameValue(player, selectedPlayer)),
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
  options: SelectFieldOption[]
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
        {options.map((option) => {
          const label = typeof option === 'string' ? option : option.label
          const optionValue = typeof option === 'string' ? option : option.value

          return (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
          )
        })}
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
