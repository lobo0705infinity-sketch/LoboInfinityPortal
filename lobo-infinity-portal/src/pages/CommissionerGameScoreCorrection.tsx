import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import {
  apiClient,
  type GameCenterGame,
  type GameScoreCorrectionRequest,
  type GameScoreCorrectionResult,
} from '../services/api'

type LoadState =
  | { status: 'loading' }
  | { status: 'success'; game: GameCenterGame }
  | { status: 'error'; message: string }

type ScoreFields = {
  p1Tp: string
  p2Tp: string
  p1Op: string
  p2Op: string
  p1Vp: string
  p2Vp: string
}

const emptyScores: ScoreFields = {
  p1Tp: '',
  p2Tp: '',
  p1Op: '',
  p2Op: '',
  p1Vp: '',
  p2Vp: '',
}

function CommissionerGameScoreCorrection() {
  const auth = useAuth()
  const { gameId } = useParams()
  const numericGameId = Number(gameId)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [scores, setScores] = useState<ScoreFields>(emptyScores)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<GameScoreCorrectionResult | null>(null)

  useEffect(() => {
    if (auth.status === 'loading') return
    if (!auth.authenticated || !auth.isAtLeastRole('Commissioner')) return
    if (!Number.isFinite(numericGameId)) {
      setState({ status: 'error', message: 'Invalid Game ID.' })
      return
    }

    const controller = new AbortController()

    setState({ status: 'loading' })
    apiClient
      .getGameCenter({ signal: controller.signal })
      .then((data) => {
        const game = data.games.find((entry) => entry.id === numericGameId)

        if (!game) {
          setState({
            status: 'error',
            message: `Game #${numericGameId} was not found in Game Center.`,
          })
          return
        }

        setScores(scoreFieldsFromGame(game))
        setState({ status: 'success', game })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The game could not be loaded from Game Center.',
        })
      })

    return () => controller.abort()
  }, [auth, numericGameId])

  const originalScores = useMemo(
    () => (state.status === 'success' ? scoreFieldsFromGame(state.game) : emptyScores),
    [state],
  )
  const changedPairs = useMemo(
    () => getChangedScorePairs(originalScores, scores),
    [originalScores, scores],
  )
  const canSubmit =
    state.status === 'success' &&
    reason.trim().length > 0 &&
    changedPairs.length > 0 &&
    !submitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state.status !== 'success' || !canSubmit) return

    setSubmitting(true)
    setSubmitError('')
    setResult(null)

    try {
      const correction = buildCorrectionRequest(state.game, scores, reason)
      const response = await apiClient.correctGameScore(correction)
      setResult(response)
      setState((current) =>
        current.status === 'success'
          ? {
              ...current,
              game: {
                ...current.game,
                tp: response.after.tp,
                op: response.after.op,
                vp: response.after.vp,
              },
            }
          : current,
      )
      setScores({
        p1Tp: splitScorePair(response.after.tp)[0],
        p2Tp: splitScorePair(response.after.tp)[1],
        p1Op: splitScorePair(response.after.op)[0],
        p2Op: splitScorePair(response.after.op)[1],
        p1Vp: splitScorePair(response.after.vp)[0],
        p2Vp: splitScorePair(response.after.vp)[1],
      })
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'The score correction failed.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (auth.status === 'loading') {
    return <ScoreCorrectionLoading />
  }

  if (!auth.authenticated || !auth.isAtLeastRole('Commissioner')) {
    return (
      <main className="portal-shell">
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h1>Game Score Corrections</h1>
          <p>
            Sign in with an enabled Commissioner account to correct game scores.
          </p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return <ScoreCorrectionLoading />
  }

  return (
    <main className="portal-shell score-correction-page">
      <section className="page-header game-center-header" aria-labelledby="score-correction-title">
        <div>
          <p className="eyebrow">Commissioner</p>
          <h1 id="score-correction-title">Game Score Correction</h1>
          <p>
            Correct TP, OP, or VP through the existing audited commissioner
            correction endpoint.
          </p>
        </div>
        <Link className="score-correction-return" to="/commissioner/game-center">
          Game Center
        </Link>
      </section>

      {state.status === 'error' ? (
        <section className="panel dashboard-state">
          <h2>Game could not be loaded.</h2>
          <p>{state.message}</p>
        </section>
      ) : (
        <>
          <section className="panel score-correction-summary" aria-label="Selected game">
            <div>
              <span>Game ID</span>
              <strong>#{state.game.id}</strong>
            </div>
            <div>
              <span>Event</span>
              <strong>{state.game.event}</strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{state.game.date || 'Unknown'}</strong>
            </div>
            <div>
              <span>Players</span>
              <strong>
                {state.game.player1DisplayName} vs {state.game.player2DisplayName}
              </strong>
            </div>
            <div>
              <span>Current TP</span>
              <strong>{state.game.tp || '-'}</strong>
            </div>
            <div>
              <span>Current OP</span>
              <strong>{state.game.op || '-'}</strong>
            </div>
            <div>
              <span>Current VP</span>
              <strong>{state.game.vp || '-'}</strong>
            </div>
          </section>

          <form className="panel score-correction-form" onSubmit={handleSubmit}>
            <ScorePairEditor
              label="Tournament Points"
              player1={state.game.player1DisplayName}
              player1Value={scores.p1Tp}
              player2={state.game.player2DisplayName}
              player2Value={scores.p2Tp}
              shortLabel="TP"
              onPlayer1Change={(value) => updateScore('p1Tp', value)}
              onPlayer2Change={(value) => updateScore('p2Tp', value)}
            />
            <ScorePairEditor
              label="Objective Points"
              player1={state.game.player1DisplayName}
              player1Value={scores.p1Op}
              player2={state.game.player2DisplayName}
              player2Value={scores.p2Op}
              shortLabel="OP"
              onPlayer1Change={(value) => updateScore('p1Op', value)}
              onPlayer2Change={(value) => updateScore('p2Op', value)}
            />
            <ScorePairEditor
              label="Victory Points"
              player1={state.game.player1DisplayName}
              player1Value={scores.p1Vp}
              player2={state.game.player2DisplayName}
              player2Value={scores.p2Vp}
              shortLabel="VP"
              onPlayer1Change={(value) => updateScore('p1Vp', value)}
              onPlayer2Change={(value) => updateScore('p2Vp', value)}
            />

            <label className="score-correction-reason">
              <span>Audit Reason</span>
              <textarea
                onChange={(event) => setReason(event.target.value)}
                placeholder="Commissioner score correction - explain the source of truth."
                required
                rows={4}
                value={reason}
              />
            </label>

            <div className="score-correction-actions">
              <p aria-live="polite">
                {changedPairs.length > 0
                  ? `${changedPairs.join(', ')} will be corrected.`
                  : 'No score changes selected.'}
              </p>
              <button disabled={!canSubmit} type="submit">
                {submitting ? 'Submitting...' : 'Submit Correction'}
              </button>
            </div>
          </form>

          {submitError ? (
            <section className="panel score-correction-message error" role="alert">
              <h2>Correction failed.</h2>
              <p>{submitError}</p>
            </section>
          ) : null}

          {result ? (
            <section className="panel score-correction-message success" aria-live="polite">
              <h2>Correction recorded.</h2>
              <dl>
                <div>
                  <dt>Before</dt>
                  <dd>
                    TP {result.before.tp} / OP {result.before.op} / VP {result.before.vp}
                  </dd>
                </div>
                <div>
                  <dt>After</dt>
                  <dd>
                    TP {result.after.tp} / OP {result.after.op} / VP {result.after.vp}
                  </dd>
                </div>
                <div>
                  <dt>Rebuild</dt>
                  <dd>
                    {result.gameEngineRebuilt && result.derivedAnalyticsRebuilt
                      ? 'Canonical game data and analytics were rebuilt.'
                      : 'Correction completed; review rebuild status in audit logs.'}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}
        </>
      )}
    </main>
  )

  function updateScore(key: keyof ScoreFields, value: string) {
    setScores((current) => ({
      ...current,
      [key]: value,
    }))
  }
}

function ScoreCorrectionLoading() {
  return (
    <main className="portal-shell">
      <section className="dashboard-state" aria-label="Game Score Correction loading">
        <Loading />
      </section>
    </main>
  )
}

function ScorePairEditor({
  label,
  player1,
  player1Value,
  player2,
  player2Value,
  shortLabel,
  onPlayer1Change,
  onPlayer2Change,
}: {
  label: string
  player1: string
  player1Value: string
  player2: string
  player2Value: string
  shortLabel: string
  onPlayer1Change: (value: string) => void
  onPlayer2Change: (value: string) => void
}) {
  return (
    <fieldset className="score-correction-fieldset">
      <legend>{label}</legend>
      <label>
        <span>{player1} {shortLabel}</span>
        <input
          inputMode="numeric"
          min="0"
          onChange={(event) => onPlayer1Change(event.target.value)}
          required
          step="1"
          type="number"
          value={player1Value}
        />
      </label>
      <label>
        <span>{player2} {shortLabel}</span>
        <input
          inputMode="numeric"
          min="0"
          onChange={(event) => onPlayer2Change(event.target.value)}
          required
          step="1"
          type="number"
          value={player2Value}
        />
      </label>
    </fieldset>
  )
}

function scoreFieldsFromGame(game: GameCenterGame): ScoreFields {
  const [p1Tp, p2Tp] = splitScorePair(game.tp)
  const [p1Op, p2Op] = splitScorePair(game.op)
  const [p1Vp, p2Vp] = splitScorePair(game.vp)

  return {
    p1Tp,
    p2Tp,
    p1Op,
    p2Op,
    p1Vp,
    p2Vp,
  }
}

function splitScorePair(score: string): [string, string] {
  const normalized = String(score || '').replace(/[\u2013\u2014]/g, '-')
  const [left = '', right = ''] = normalized.split('-')

  return [left.trim(), right.trim()]
}

function getChangedScorePairs(original: ScoreFields, current: ScoreFields) {
  return [
    normalizeScorePair(original.p1Tp, original.p2Tp) !== normalizeScorePair(current.p1Tp, current.p2Tp)
      ? 'TP'
      : '',
    normalizeScorePair(original.p1Op, original.p2Op) !== normalizeScorePair(current.p1Op, current.p2Op)
      ? 'OP'
      : '',
    normalizeScorePair(original.p1Vp, original.p2Vp) !== normalizeScorePair(current.p1Vp, current.p2Vp)
      ? 'VP'
      : '',
  ].filter(Boolean)
}

function buildCorrectionRequest(
  game: GameCenterGame,
  current: ScoreFields,
  reason: string,
): GameScoreCorrectionRequest {
  const request: GameScoreCorrectionRequest = {
    gameId: game.id,
    expectedEventId: game.eventId,
    expectedPlayer1: game.player1,
    expectedPlayer2: game.player2,
    expectedTp: normalizeExistingScore(game.tp),
    expectedOp: normalizeExistingScore(game.op),
    expectedVp: normalizeExistingScore(game.vp),
    reason: reason.trim(),
  }

  if (normalizeExistingScore(game.tp) !== normalizeScorePair(current.p1Tp, current.p2Tp)) {
    request.player1TournamentPoints = current.p1Tp.trim()
    request.player2TournamentPoints = current.p2Tp.trim()
  }

  if (normalizeExistingScore(game.op) !== normalizeScorePair(current.p1Op, current.p2Op)) {
    request.player1ObjectivePoints = current.p1Op.trim()
    request.player2ObjectivePoints = current.p2Op.trim()
  }

  if (normalizeExistingScore(game.vp) !== normalizeScorePair(current.p1Vp, current.p2Vp)) {
    request.player1VictoryPoints = current.p1Vp.trim()
    request.player2VictoryPoints = current.p2Vp.trim()
  }

  return request
}

function normalizeExistingScore(score: string) {
  const [left, right] = splitScorePair(score)
  return normalizeScorePair(left, right)
}

function normalizeScorePair(left: string, right: string) {
  return `${left.trim()}-${right.trim()}`
}

export default CommissionerGameScoreCorrection
