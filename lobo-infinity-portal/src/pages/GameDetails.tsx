import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EntityPreviousNext from '../components/EntityPreviousNext'
import Loading from '../components/Loading'
import { apiClient, type RecentGame } from '../services/api'
import './GameDetails.css'

type GameDetailsState =
  | {
      status: 'idle'
    }
  | {
      game: RecentGame
      gameId: number
      status: 'success'
    }
  | {
      gameId: number
      status: 'not-found'
    }

function GameDetails() {
  const { id } = useParams<{ id: string }>()
  const gameId = Number(id)
  const [gameState, setGameState] = useState<GameDetailsState>({
    status: 'idle',
  })

  useEffect(() => {
    if (!Number.isInteger(gameId)) {
      return
    }

    const controller = new AbortController()

    apiClient
      .getRecentGames({
        signal: controller.signal,
      })
      .then((games) => {
        const game = games.find((candidate) => candidate.id === gameId)

        if (game) {
          setGameState({
            game,
            gameId,
            status: 'success',
          })
          return
        }

        setGameState({
          gameId,
          status: 'not-found',
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setGameState({
            gameId,
            status: 'not-found',
          })
        }
      })

    return () => {
      controller.abort()
    }
  }, [gameId])

  if (!Number.isInteger(gameId)) {
    return <GameNotFound />
  }

  const isCurrentGame =
    gameState.status !== 'idle' && gameState.gameId === gameId

  if (!isCurrentGame) {
    return (
      <main className="portal-shell">
        <section className="match-loading" aria-label="Game loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (gameState.status === 'not-found') {
    return <GameNotFound />
  }

  return <MatchReport game={gameState.game} />
}

function MatchReport({ game }: { game: RecentGame }) {
  return (
    <main className="portal-shell">
      <div className="match-report">
        <nav className="match-nav" aria-label="Match navigation">
          <Link to="/">← Back to Dashboard</Link>
          <Link to="/#recent-games">← Back to Recent Games</Link>
        </nav>

        <section className="match-hero" aria-labelledby="match-result-title">
          <p className="match-kicker" id="match-result-title">
            🏆 Match Result
          </p>

          <div className="match-result">
            <div className="match-player winner">
              <span>Winner</span>
              <h1>{game.winner}</h1>
              <p>{game.winnerFaction}</p>
            </div>

            <div className="match-defeated">Defeated</div>

            <div className="match-player loser">
              <span>Loser</span>
              <h2>{game.loser}</h2>
              <p>{game.loserFaction}</p>
            </div>
          </div>

          <dl className="match-meta-strip" aria-label="Match summary">
            <div>
              <dt>Mission</dt>
              <dd>{game.mission}</dd>
            </div>
            <div>
              <dt>Division</dt>
              <dd>{game.division}</dd>
            </div>
            <div>
              <dt>Date Played</dt>
              <dd>{game.date}</dd>
            </div>
          </dl>
        </section>

        <section className="match-scoreboard" aria-labelledby="score-title">
          <p className="eyebrow" id="score-title">
            Score
          </p>
          <div className="score-grid">
            <ScoreLane label="TP" value={game.tp} />
            <ScoreLane label="OP" value={game.op} />
            <ScoreLane label="VP" value={game.vp} />
          </div>
        </section>

        <section className="best-moment-card" aria-labelledby="best-moment-title">
          <p className="eyebrow">Best Moment</p>
          <h2 id="best-moment-title">Best Moment</h2>
          <blockquote>
            “{game.bestMoment || 'No Best Moment was submitted for this match.'}”
          </blockquote>
        </section>

        <section
          className="match-info-card"
          aria-labelledby="match-information-title"
        >
          <p className="eyebrow">Match Information</p>
          <h2 id="match-information-title">Match Information</h2>
          <dl>
            <div>
              <dt>Mission</dt>
              <dd>{game.mission}</dd>
            </div>
            <div>
              <dt>Division</dt>
              <dd>{game.division}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{game.date}</dd>
            </div>
            <div>
              <dt>First Turn</dt>
              <dd>{game.firstTurn}</dd>
            </div>
          </dl>
        </section>

        <EntityPreviousNext current={game.id} type="match" />
      </div>
    </main>
  )
}

function ScoreLane({ label, value }: { label: string; value: string }) {
  const [winnerScore, loserScore] = splitScore(value)

  return (
    <div className="score-lane">
      <span>{label}</span>
      <strong>
        <b>{winnerScore}</b>–{loserScore}
      </strong>
    </div>
  )
}

function GameNotFound() {
  return (
    <main className="portal-shell">
      <div className="match-report">
        <nav className="match-nav" aria-label="Match navigation">
          <Link to="/">← Back to Dashboard</Link>
          <Link to="/#recent-games">← Back to Recent Games</Link>
        </nav>
        <section className="dashboard-state" aria-label="Game not found">
          <p role="alert">Game not found.</p>
        </section>
      </div>
    </main>
  )
}

function splitScore(value: string) {
  const [winnerScore = '0', loserScore = '0'] = value.split('-')
  return [winnerScore, loserScore]
}

export default GameDetails
