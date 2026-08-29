import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Skeleton from '../components/Skeleton'
import {
  getCanonicalArmyName,
  getCanonicalArmyOptions,
  getArmyParentFaction,
} from '../services/armyIdentity'
import {
  getCanonicalMissionName,
  getCanonicalMissionOptions,
} from '../config/missions'
import { GOOGLE_FORM_URLS } from '../config/googleForms'
import './SubmitResult.css'
import {
  apiClient,
  type CasualResultSubmission,
  type ArmyList,
  type EventHomeData,
  type EventBracketData,
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
  opponentArmyListId: '',
  opponentFaction: '',
  opponentObjectivePoints: '',
  opponentTournamentPoints: '',
  opponentVictoryPoints: '',
  player: '',
  player1ArmyCode: '',
  player2ArmyCode: '',
  playerArmyListId: '',
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
  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="submit-game-title">
        <p className="eyebrow">Game Submission</p>
        <h1 id="submit-game-title">Submit Game</h1>
        <p>Choose the type of game you want to submit.</p>
      </section>

      <section className="operations-grid" aria-label="Google Forms game submissions">
        <GoogleFormLauncher
          buttonLabel="Submit League Game"
          description="Submit an official League game."
          label="League Game"
          url={GOOGLE_FORM_URLS.league}
        />
        <GoogleFormLauncher
          buttonLabel="Submit Team Tournament Game"
          description="Submit an official Team Tournament game."
          label="Team Tournament"
          url={GOOGLE_FORM_URLS.teamTournament}
        />
        <GoogleFormLauncher
          buttonLabel="Submit Casual Game"
          description="Submit a Casual game for lifetime statistics."
          label="Casual Game"
          url={GOOGLE_FORM_URLS.casual}
        />
        <GoogleFormLauncher
          buttonLabel="Submit Top 40 Game"
          description="Submit a Top 40 tournament game."
          label="Lobo's American Top 40"
          url={GOOGLE_FORM_URLS.top40}
        />
      </section>
    </main>
  )
}

function GoogleFormLauncher({
  buttonLabel,
  description,
  label,
  url,
}: {
  buttonLabel: string
  description: string
  label: string
  url: string
}) {
  return (
    <article className="panel operations-panel">
      <p className="eyebrow">Google Form</p>
      <h2>{label}</h2>
      <p>{description}</p>
      <a
        className="submit-match-button"
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {buttonLabel}
      </a>
    </article>
  )
}

export function LegacySubmitResult() {
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
  const [eventBracket, setEventBracket] = useState<EventBracketData | null>(null)
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
  const casualPlayerArmyListOptions = useMemo(
    () => buildArmyListPickerOptions(searchIndex?.armyLists ?? [], casualResult.player, casualResult.playerFaction),
    [casualResult.player, casualResult.playerFaction, searchIndex?.armyLists],
  )
  const casualOpponentArmyListOptions = useMemo(
    () => buildArmyListPickerOptions(searchIndex?.armyLists ?? [], casualResult.opponent, casualResult.opponentFaction),
    [casualResult.opponent, casualResult.opponentFaction, searchIndex?.armyLists],
  )
  const leaguePlayerArmyListOptions = useMemo(
    () => buildArmyListPickerOptions(searchIndex?.armyLists ?? [], leagueResult.player, leagueResult.playerFaction),
    [leagueResult.player, leagueResult.playerFaction, searchIndex?.armyLists],
  )
  const leagueOpponentArmyListOptions = useMemo(
    () => buildArmyListPickerOptions(searchIndex?.armyLists ?? [], leagueResult.opponent, leagueResult.opponentFaction),
    [leagueResult.opponent, leagueResult.opponentFaction, searchIndex?.armyLists],
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

        if (home.event.type === 'Team Tournament') {
          const tournament = await apiClient.getTeamTournament(eventId, {
            signal: controller.signal,
          })

          if (!controller.signal.aborted) {
            setTeamTournament(tournament)
          }
        }

        if (home.event.type === 'Individual Double Elimination') {
          const bracket = await apiClient.getEventBracket(home.event.id, { signal: controller.signal })
          if (!controller.signal.aborted) {
            setEventBracket(bracket)
            const active = bracket.matches.filter((match) => match.status === 'Active' && (sameValue(match.playerA, player) || sameValue(match.playerB, player)))
            if (active.length === 1) {
              const match = active[0]
              setLeagueResult((current) => ({
                ...current,
                matchId: match.matchId,
                mission: match.mission || '',
                opponent: sameValue(match.playerA, player) ? match.playerB : match.playerA,
                winner: '',
              }))
            }
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

  useEffect(() => {
    if (eventHome?.event.type !== 'Individual Double Elimination' || !eventBracket) return
    const player = leagueResult.player
    const active = eventBracket.matches.filter((match) => match.status === 'Active' && (sameValue(match.playerA, player) || sameValue(match.playerB, player)))
    setLeagueResult((current) => {
      if (active.length !== 1) return { ...current, matchId: '', opponent: '', winner: '' }
      const match = active[0]
      const opponent = sameValue(match.playerA, player) ? match.playerB : match.playerA
      const playerRegistration = eventHome.registration.registrations.find((entry) => sameValue(entry.player, player) || sameValue(entry.displayName, player))
      const opponentRegistration = eventHome.registration.registrations.find((entry) => sameValue(entry.player, opponent) || sameValue(entry.displayName, opponent))
      return { ...current, matchId: match.matchId, mission: match.mission || '', opponent, playerFaction: current.playerFaction || playerRegistration?.faction || '', opponentFaction: opponentRegistration?.faction || current.opponentFaction, winner: '' }
    })
  }, [eventBracket, eventHome, leagueResult.player])

  function updateCasualField(field: keyof CasualResultSubmission, value: string) {
    setCasualResult((current) => ({
      ...current,
      [field]: value,
      ...(field === 'player' || field === 'playerFaction' ? { playerArmyListId: '' } : {}),
      ...(field === 'opponent' || field === 'opponentFaction' ? { opponentArmyListId: '' } : {}),
    }))
  }

  async function submitCasual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const submission = {
      ...casualResult,
      bestMoment: getFormDataString(new FormData(event.currentTarget), 'bestMoment'),
    }
    const validation = validateCasualResult(submission, {
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
      await apiClient.submitCasualResult(buildCommissionerPayload(submission))
      setState({
        message: 'Casual game submitted. Analytics and lifetime records will refresh from the official game data.',
        status: 'success',
      })
    } catch (error) {
      setState({
        message:
          error instanceof Error
            ? error.message
            : 'Casual game could not be submitted. Please review the fields or contact a commissioner.',
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
            description="Submit an Active Lobo's American Top 40 bracket match."
            label="Top 40"
            to="/submit-game?eventId=event-lobo-s-american-top-40&gameType=event"
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
            <SearchableSelect
              label="Your Player"
              onChange={(value) => updateCasualField('player', value)}
              options={allPlayerOptions}
              placeholder="Search active players"
              required
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
            label="Player Army List"
            onChange={(value) => updateCasualField('playerArmyListId', value)}
            options={casualPlayerArmyListOptions}
            placeholder="Search approved lists"
            value={casualResult.playerArmyListId || ''}
          />
          <SearchableSelect
            label="Opponent Faction"
            onChange={(value) => updateCasualField('opponentFaction', value)}
            options={factionOptions}
            placeholder="Search factions"
            required
            value={casualResult.opponentFaction}
          />
          <FormField
            label="Player 1 Army Code"
            onChange={(value) => updateCasualField('player1ArmyCode', value)}
            required
            value={casualResult.player1ArmyCode ?? ''}
          />
          <FormField
            label="Player 2 Army Code"
            onChange={(value) => updateCasualField('player2ArmyCode', value)}
            required
            value={casualResult.player2ArmyCode ?? ''}
          />
          <SearchableSelect
            label="Opponent Army List"
            onChange={(value) => updateCasualField('opponentArmyListId', value)}
            options={casualOpponentArmyListOptions}
            placeholder="Search approved lists"
            value={casualResult.opponentArmyListId || ''}
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
              name="bestMoment"
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
            <button disabled={state.status === 'submitting'} type="submit">
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
        authenticatedPlayer={authenticatedSubmitGamePlayer}
        commissionerMode={isCommissionerSubmission}
        commissionerOverride={isCommissionerOverride}
        commissionerReason={commissionerReason}
        data={teamTournament}
        disabled={state.status === 'loading'}
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
      ...(field === 'player' || field === 'playerFaction' ? { playerArmyListId: '' } : {}),
      ...(field === 'opponent' || field === 'opponentFaction' ? { opponentArmyListId: '' } : {}),
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!eventHome) {
      setState({ message: 'Event context is still loading.', status: 'error' })
      return
    }

    const submission = {
      ...leagueResult,
      bestMoment: getFormDataString(new FormData(event.currentTarget), 'bestMoment'),
    }
    const validation = eventHome.event.type === 'Individual Double Elimination' ? validateTop40Result(submission, {
      factions: factionOptions,
      missions: missionOptions,
    }) : validateLeagueResult(eventHome, submission, {
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
      if (eventHome.event.type === 'Individual Double Elimination') {
        await apiClient.submitTop40Result(buildCommissionerPayload(submission))
      } else {
        await apiClient.submitLeagueResult(buildCommissionerPayload(submission))
      }
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
        {eventHome?.event.type === 'Individual Double Elimination' ? (
          <ReadOnlyField label="Match" value={leagueResult.matchId || 'No Active match'} />
        ) : (
          <>
            <ReadOnlyField label="Round" value={leagueResult.round} />
            <ReadOnlyField label="Division" value={leagueResult.division} />
          </>
        )}
        {eventHome?.event.type === 'Individual Double Elimination' ? (
          <ReadOnlyField label="Opponent" value={leagueResult.opponent || 'No Active match'} />
        ) : null}
        {eventHome?.event.type === 'Individual Double Elimination' ? (
          <ReadOnlyField label="Mission" value={leagueResult.mission || 'Mission not assigned'} />
        ) : (
          <SearchableSelect
            label="Mission"
            onChange={(value) => updateField('mission', value)}
            options={missionOptions}
            placeholder="Search event missions"
            required
            value={leagueResult.mission}
          />
        )}
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
          <SearchableSelect
            label="Your Player"
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
            placeholder="Search active players"
            required
            value={leagueResult.player}
          />
        )}
        {eventHome?.event.type !== 'Individual Double Elimination' ? <SearchableSelect
          label={isCommissionerSubmission ? 'Player 2' : 'Opponent'}
          onChange={(value) => updateField('opponent', value)}
          options={isCommissionerOverride ? allPlayerOptions.filter((option) => !sameValue(option.value, leagueResult.player)) : leagueOpponentOptions}
          placeholder="Search eligible opponents"
          required
          value={leagueResult.opponent}
        /> : null}
        {eventHome?.event.type !== 'Individual Double Elimination' && canOverrideOpponentFilter && !isCommissionerSubmission ? (
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
          label="Player Army List"
          onChange={(value) => updateField('playerArmyListId', value)}
          options={leaguePlayerArmyListOptions}
          placeholder="Search approved lists"
          value={leagueResult.playerArmyListId || ''}
        />
        <SearchableSelect
          label="Opponent Faction"
          onChange={(value) => updateField('opponentFaction', value)}
          options={factionOptions}
          placeholder="Search factions"
          value={leagueResult.opponentFaction}
        />
        <SearchableSelect
          label="Opponent Army List"
          onChange={(value) => updateField('opponentArmyListId', value)}
          options={leagueOpponentArmyListOptions}
          placeholder="Search approved lists"
          value={leagueResult.opponentArmyListId || ''}
        />
        <FormField
          label="Player 1 Army Code"
          onChange={(value) => updateField('player1ArmyCode', value)}
          required
          value={leagueResult.player1ArmyCode ?? ''}
        />
        <FormField
          label="Player 2 Army Code"
          onChange={(value) => updateField('player2ArmyCode', value)}
          required
          value={leagueResult.player2ArmyCode ?? ''}
        />
        <SelectField
          label="Game Result"
          onChange={(value) => updateField('winner', value)}
          options={buildGameResultOptions(leagueResult.player, leagueResult.opponent).filter((option) => eventHome?.event.type !== 'Individual Double Elimination' || option !== 'Draw')}
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
            name="bestMoment"
            onChange={(event) => updateField('bestMoment', event.target.value)}
            required
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
          <button disabled={state.status === 'submitting'} type="submit">
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
  authenticatedPlayer,
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
  authenticatedPlayer: string
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
  const currentTournamentRegistration =
    eventHome.registration.currentPlayer ||
    data?.registration.currentPlayer ||
    null
  const defaultPlayer =
    currentTournamentRegistration?.player ||
    currentTournamentRegistration?.displayName ||
    ''
  const [selectedPlayer, setSelectedPlayer] = useState(defaultPlayer)
  const [selectedOpponent, setSelectedOpponent] = useState('')
  const assignment = getTournamentAssignment(
    data,
    eventHome,
    commissionerMode ? selectedPlayer : '',
    authenticatedPlayer,
  )
  const tournamentPlayerOptions = useMemo(
    () => buildTournamentPlayerOptions(data, eventHome, allPlayerOptions, commissionerOverride),
    [allPlayerOptions, commissionerOverride, data, eventHome],
  )
  const tournamentOpponentOptions = useMemo(
    () => commissionerMode
      ? buildTournamentOpponentPickerOptions(data, eventHome, allPlayerOptions, selectedPlayer, commissionerOverride)
      : buildOpposingTeamRosterOptions(data, assignment?.opponentTeam || ''),
    [allPlayerOptions, assignment?.opponentTeam, commissionerMode, commissionerOverride, data, eventHome, selectedPlayer],
  )
  const effectiveOpponent = selectedOpponent || assignment?.opponent || ''
  const alreadySubmitted = Boolean(assignment && effectiveOpponent && data?.tournamentResults.some((result) => (
    result.roundId === assignment.roundId &&
    result.status.toLowerCase() !== 'rejected' &&
    ((sameValue(result.player, assignment.player) && sameValue(result.opponent, effectiveOpponent)) ||
      (sameValue(result.opponent, assignment.player) && sameValue(result.player, effectiveOpponent)))
  )))

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
      data,
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
        <ReadOnlyField label="Team" value={assignment?.team || ''} />
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
        ) : assignment?.opponent ? (
          <ReadOnlyField label="Opponent" value={assignment.opponent} />
        ) : (
          <SearchableSelect label="Opponent" onChange={(value) => { setSelectedOpponent(value); setWinner('') }} options={tournamentOpponentOptions} placeholder="Select an opposing team player" required value={effectiveOpponent} />
        )}
        {assignment ? (
          <>
            <HiddenField name="roundId" value={assignment.roundId} />
            <HiddenField name="round" value={assignment.round} />
            <HiddenField name="teamAId" value={assignment.teamAId} />
            <HiddenField name="teamBId" value={assignment.teamBId} />
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
        <FormField label="Player 1 Army Code" name="player1ArmyCode" required value="" />
        <FormField label="Player 2 Army Code" name="player2ArmyCode" required value="" />
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

  if (!submission.player1ArmyCode?.trim() || !submission.player2ArmyCode?.trim()) {
    issues.push('Player 1 Army Code and Player 2 Army Code are required.')
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

  if (!submission.player1ArmyCode?.trim() || !submission.player2ArmyCode?.trim()) {
    issues.push('Player 1 Army Code and Player 2 Army Code are required.')
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
  teamAId: string
  teamBId: string
}

function resolveTournamentTeamName(data: TeamTournamentData | null, teamId: string, fallback = '') {
  if (!teamId) {
    return fallback
  }

  return data?.teams.find((team) => team.teamId === teamId)?.teamName || ''
}

function getTournamentAssignment(
  data: TeamTournamentData | null,
  eventHome: EventHomeData,
  selectedPlayer = '',
  authenticatedPlayer = '',
): TournamentAssignment | null {
  if (!data) {
    return null
  }

  const registration =
    data.registration.currentPlayer ||
    eventHome.registration.currentPlayer

  const playerCandidates = uniqueNonEmpty([
    selectedPlayer,
    registration?.player,
    registration?.displayName,
    authenticatedPlayer,
  ])

  if (playerCandidates.length === 0) {
    return null
  }

  const player = playerCandidates[0]
  const selectedRegistration = data.registration.registrations.find((entry) => (
    playerCandidates.some((candidate) => (
      sameValue(entry.player, candidate) || sameValue(entry.displayName, candidate)
    ))
  ))
  const team =
    selectedRegistration?.team ||
    selectedRegistration?.preferredTeam ||
    registration?.team ||
    registration?.preferredTeam ||
    ''
  const teamId =
    selectedRegistration?.teamId ||
    registration?.teamId ||
    ''

  if (!player || (!teamId && !team)) {
    return null
  }

  const currentRoundId = getRoundValue(data.currentRound, 'id') || getRoundValue(eventHome.currentRound, 'id')
  const resultStatus = data.resultStatuses.find((status) => (
    (!currentRoundId || status.roundId === currentRoundId) &&
    playerCandidates.some((candidate) => (
      sameValue(status.player, candidate) || sameValue(status.opponent, candidate)
    ))
  )) || data.resultStatuses.find((status) => (
    (!currentRoundId || status.roundId === currentRoundId) &&
    (sameValue(status.teamA, team) || sameValue(status.teamB, team))
  ))
  const teamPairing = data.pairings.find((pairing) => (
    (!currentRoundId || pairing.roundId === currentRoundId) &&
    pairing.status.toLowerCase() !== 'completed' &&
    (sameValue(pairing.teamA, team) || sameValue(pairing.teamB, team))
  ))
  const table = resultStatus || teamPairing

  if (!table) {
    return null
  }

  const matchedPlayer =
    playerCandidates.find((candidate) => (
      sameValue(resultStatus?.player || '', candidate) || sameValue(resultStatus?.opponent || '', candidate)
    )) || player
  const flipped = sameValue(resultStatus?.opponent || '', matchedPlayer)
  const playerIsTeamA =
    table.teamAId && teamId
      ? table.teamAId === teamId
      : sameValue(table.teamA, team)
  const resolvedTeam =
    playerIsTeamA
      ? resolveTournamentTeamName(data, table.teamAId, table.teamA)
      : resolveTournamentTeamName(data, table.teamBId, table.teamB)
  const opponentTeam =
    playerIsTeamA
      ? resolveTournamentTeamName(data, table.teamBId, table.teamB)
      : resolveTournamentTeamName(data, table.teamAId, table.teamA)
  const mission = getCanonicalMissionName(
    getRoundValue(data.currentRound, 'mission') ||
      getRoundValue(data.currentRound, 'Mission') ||
      getRoundValue(eventHome.currentRound, 'mission') ||
      getRoundValue(eventHome.currentRound, 'Mission'),
  )

  return {
    mission,
    opponent: resultStatus ? (flipped ? resultStatus.player : resultStatus.opponent) : '',
    opponentTeam,
    player: matchedPlayer,
    round: table.round,
    roundId: table.roundId,
    status: 'Outstanding',
    table: resultStatus?.table || '',
    team: resolvedTeam || (teamId ? '' : team),
    teamA: resolveTournamentTeamName(data, table.teamAId, table.teamA),
    teamB: resolveTournamentTeamName(data, table.teamBId, table.teamB),
    teamAId: resultStatus?.teamAId || data.teams.find((candidate) => sameValue(candidate.teamName, table.teamA))?.teamId || '',
    teamBId: resultStatus?.teamBId || data.teams.find((candidate) => sameValue(candidate.teamName, table.teamB))?.teamId || '',
  }
}

function validateTop40Result(
  submission: LeagueResultSubmission,
  options: { factions: PickerOption[]; missions: PickerOption[] },
) {
  const issues: string[] = []
  if (!submission.player.trim()) issues.push('Player is required.')
  if (!submission.matchId || !submission.opponent.trim()) issues.push('An Active Top 40 bracket match is required.')
  if (!submission.playerFaction.trim() || !submission.opponentFaction.trim()) issues.push('Both factions are required.')
  if (!submission.player1ArmyCode?.trim() || !submission.player2ArmyCode?.trim()) issues.push('Player 1 Army Code and Player 2 Army Code are required.')
  if (submission.playerFaction && !optionContains(options.factions, submission.playerFaction)) issues.push('Registered Faction must be selected from the faction database.')
  if (submission.opponentFaction && !optionContains(options.factions, submission.opponentFaction)) issues.push('Opponent Faction must be selected from the faction database.')
  if (!submission.mission.trim()) issues.push('A mission has not been assigned to this bracket round.')
  else if (!optionContains(options.missions, submission.mission)) issues.push('Mission must be selected from the mission database.')
  if (!submission.firstTurn.trim()) issues.push('First Turn is required.')
  if (!submission.bestMoment.trim()) issues.push('Best Moment is required.')
  if (!submission.winner.trim()) issues.push('Game Result is required.')
  if (submission.winner === 'Draw') issues.push('Top 40 bracket matches require a winner.')
  const scores = [submission.playerTournamentPoints, submission.opponentTournamentPoints, submission.playerObjectivePoints, submission.opponentObjectivePoints, submission.playerVictoryPoints, submission.opponentVictoryPoints].map(parseScore)
  if (scores.some((score) => score === null)) issues.push('Scores must be non-negative numbers.')
  if (scores[0] !== null && scores[1] !== null && scores[0] + scores[1] > 10) issues.push('Tournament Points cannot total more than 10.')
  return issues
}

function buildOpposingTeamRosterOptions(data: TeamTournamentData | null, opponentTeam: string) {
  const team = data?.teams.find((candidate) => sameValue(candidate.teamName, opponentTeam))
  if (!team) return []
  return toPickerOptions(uniqueNonEmpty([team.captain, ...team.players.split(/[,;\n]/).map((player) => player.trim())]))
}

function validateTournamentResult(
  params: Record<string, string>,
  eventHome: EventHomeData,
  data: TeamTournamentData | null,
  assignment: TournamentAssignment | null,
  alreadySubmitted: boolean,
  commissionerMode = false,
  commissionerOverride = false,
) {
  const issues: string[] = []

  if (!eventHome.registration.currentPlayer && !data?.registration.currentPlayer && !commissionerMode) {
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

  if (!params.player1ArmyCode?.trim() || !params.player2ArmyCode?.trim()) {
    issues.push('Player 1 Army Code and Player 2 Army Code are required.')
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

function uniqueNonEmpty(values: Array<string | undefined>) {
  const seen = new Set<string>()

  return values.filter((value): value is string => {
    const normalized = normalize(value || '')

    if (!value || !normalized || seen.has(normalized)) {
      return false
    }

    seen.add(normalized)
    return true
  })
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

function buildArmyListPickerOptions(
  armyLists: ArmyList[],
  player: string,
  faction: string,
): PickerOption[] {
  const options: PickerOption[] = [
    {
      label: 'Army List not submitted',
      meta: 'Historical compatibility',
      value: '',
    },
  ]

  if (!player.trim() || !faction.trim()) {
    return options
  }

  return [
    ...options,
    ...armyLists
      .filter((list) => (
        list.approved &&
        sameValue(list.player, player) &&
        armyListMatchesSelectedFaction(list, faction)
      ))
      .sort((left, right) => {
        const nameComparison = left.armyName.localeCompare(right.armyName)
        if (nameComparison !== 0) return nameComparison
        return Number(left.id) - Number(right.id)
      })
      .map((list) => ({
        label: list.armyName || `Army List #${list.id}`,
        meta: [
          list.sectorial || list.faction,
          list.mission,
          list.event,
          `#${list.id}`,
        ].filter(Boolean).join(' | '),
        value: String(list.id),
      })),
  ]
}

function armyListMatchesSelectedFaction(list: ArmyList, faction: string) {
  const selectedFaction = getCanonicalArmyName(faction)
  if (!selectedFaction) return false

  const listSectorial = getCanonicalArmyName(list.sectorial)
  const listFaction = getCanonicalArmyName(list.faction)

  if (sameValue(listSectorial, selectedFaction) || sameValue(listFaction, selectedFaction)) {
    return true
  }

  const selectedParent = getArmyParentFaction(selectedFaction)
  const listParent = getArmyParentFaction(listSectorial || listFaction)

  return Boolean(selectedParent && listParent && sameValue(selectedParent, listParent))
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

function getFormDataString(form: FormData, name: string) {
  const value = form.get(name)

  return typeof value === 'string' ? value : ''
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
