import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useParams } from 'react-router-dom'
import EntityPreviousNext from '../components/EntityPreviousNext'
import Skeleton from '../components/Skeleton'
import { getCanonicalMissionName } from '../config/missions'
import { apiClient, type CommissionerNewsItem, type RecentGame, type StreamedGame } from '../services/api'
import {
  formatPlayerName,
} from '../services/formatting'
import './GameDetails.css'

type GameDetailsState =
  | {
      status: 'idle'
    }
  | {
      game: RecentGame
      gameId: number
      status: 'success'
      stream: StreamedGame | null
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
        gameId,
        signal: controller.signal,
      })
      .then((games) => {
        const game = games.find((candidate) => candidate.id === gameId)

        if (game) {
          setGameState({
            game,
            gameId,
            status: 'success',
            stream: null,
          })
          void loadLinkedStream(gameId, controller.signal, setGameState)
          return
        }

        return apiClient.getNews({ signal: controller.signal }).then((news) => {
          const linkedGame = buildNewsLinkedGame(gameId, news)

          if (linkedGame) {
            setGameState({
              game: linkedGame,
              gameId,
              status: 'success',
              stream: null,
            })
            void loadLinkedStream(gameId, controller.signal, setGameState)
            return
          }

          setGameState({
            gameId,
            status: 'not-found',
          })
        })
      })
      .then((result) => {
        if (result) {
          return
        }
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
        <div className="match-report" aria-label="Game loading">
          <nav className="match-nav" aria-label="Match navigation">
            <Link to="/">Back to Dashboard</Link>
            <Link to="/#recent-games">Back to Recent Games</Link>
          </nav>
          <section className="match-hero">
            <p className="match-kicker">Match Result</p>
            <Skeleton label="Match report loading" rows={8} />
          </section>
          <section className="match-details-grid">
            <Skeleton label="Match details loading" rows={6} />
            <Skeleton label="Match scoring loading" rows={6} />
          </section>
        </div>
      </main>
    )
  }

  if (gameState.status === 'not-found') {
    return <GameNotFound />
  }

  return <MatchReport game={gameState.game} stream={gameState.stream} />
}

function loadLinkedStream(
  gameId: number,
  signal: AbortSignal,
  setGameState: Dispatch<SetStateAction<GameDetailsState>>,
) {
  return apiClient
    .getStreams({ signal })
    .then((streams) => {
      const stream = streams.find((candidate) => candidate.gameId === gameId) ?? null
      setGameState((current) =>
        current.status === 'success' && current.gameId === gameId
          ? { ...current, stream }
          : current,
      )
    })
    .catch(() => undefined)
}

function buildNewsLinkedGame(gameId: number, news: CommissionerNewsItem[]): RecentGame | null {
  const item = news.find((candidate) => candidate.link === `/games/${gameId}`)
  const parsed = item ? parseNewsLinkedGame(item.body) : null

  if (!item || !parsed) {
    return null
  }

  return {
    id: gameId,
    eventId: 'event-current-league',
    date: item.date || '',
    division: '',
    winner: parsed.winner,
    winnerDisplayName: parsed.winner,
    loser: parsed.loser,
    loserDisplayName: parsed.loser,
    winnerFaction: '',
    loserFaction: '',
    mission: parsed.mission,
    tp: 'Not recorded',
    op: parsed.op,
    vp: 'Not recorded',
    bestMoment: item.body,
    firstTurn: '',
  }
}

function parseNewsLinkedGame(body: string) {
  const match = body.match(/^(.+?) defeated (.+?) on (.+?) with a (.+?) scoreline\.$/)

  if (!match) {
    return null
  }

  return {
    winner: match[1],
    loser: match[2],
    mission: match[3],
    op: match[4],
  }
}

function MatchReport({ game, stream }: { game: RecentGame; stream: StreamedGame | null }) {
  const firstTurnPlayer = formatGameParticipant(game, game.firstTurn)
  const mission = getCanonicalMissionName(game.mission)

  return (
    <main className="portal-shell">
      <div className="match-report">
        <nav className="match-nav" aria-label="Match navigation">
          <Link to="/">Back to Dashboard</Link>
          <Link to="/#recent-games">Back to Recent Games</Link>
        </nav>

        <section className="match-hero" aria-labelledby="match-result-title">
          <p className="match-kicker" id="match-result-title">
            Match Result
          </p>

          <div className="match-result">
            <div className="match-player winner">
              <span>Winner</span>
              <h1>{formatPlayerName(game.winner, game.winnerDisplayName)}</h1>
              <Link to={`/factions/${encodeURIComponent(game.winnerFaction)}`}>
                {game.winnerFaction}
              </Link>
            </div>

            <div className="match-defeated">Defeated</div>

            <div className="match-player loser">
              <span>Loser</span>
              <h2>{formatPlayerName(game.loser, game.loserDisplayName)}</h2>
              <Link to={`/factions/${encodeURIComponent(game.loserFaction)}`}>
                {game.loserFaction}
              </Link>
            </div>
          </div>

          <dl className="match-meta-strip" aria-label="Match summary">
            <div>
              <dt>Mission</dt>
              <dd>
                {mission ? (
                  <Link to={`/missions/${encodeURIComponent(mission)}`}>
                    {mission}
                  </Link>
                ) : (
                  'Mission not recorded'
                )}
              </dd>
            </div>
            <div>
              <dt>Division</dt>
              <dd>{game.division || 'Not recorded'}</dd>
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
            <ScoreLane score={formatBattleReportScore(game.tp, 'TP')} />
            <ScoreLane score={formatBattleReportScore(game.op, 'OP')} />
            <ScoreLane score={formatBattleReportScore(game.vp, 'VP')} />
          </div>
        </section>

        {stream ? (
          <section className="match-info-card" aria-labelledby="watch-battle-report-title">
            <p className="eyebrow">Stream</p>
            <h2 id="watch-battle-report-title">Watch Battle Report</h2>
            <p>{stream.title || `${game.winner} vs ${game.loser}`}</p>
            <Link to={`/streams?streamId=${stream.id}`}>Watch Battle Report</Link>
          </section>
        ) : null}

        <section className="battle-timeline" aria-labelledby="timeline-title">
          <div className="panel-heading">
            <p className="eyebrow">Timeline</p>
            <h2 id="timeline-title">Battle Report Timeline</h2>
          </div>
          <ol>
            <li>
              <span>First Turn</span>
              <strong>{firstTurnPlayer || 'Not recorded'}</strong>
            </li>
            <li>
              <span>Mission Briefing</span>
              <strong>{mission || 'Mission not recorded'}</strong>
            </li>
            <li>
              <span>Final Result</span>
              <strong>
                {formatPlayerName(game.winner, game.winnerDisplayName)} defeated{' '}
                {formatPlayerName(game.loser, game.loserDisplayName)}
              </strong>
            </li>
          </ol>
        </section>

        <section className="best-moment-card" aria-labelledby="best-moment-title">
          <p className="eyebrow">Best Moment</p>
          <h2 id="best-moment-title">Best Moment</h2>
          <blockquote>
            "{game.bestMoment || 'No Best Moment was submitted for this match.'}"
          </blockquote>
        </section>

        <section
          className="match-info-card"
          aria-labelledby="match-information-title"
        >
          <p className="eyebrow">Match Information</p>
          <h2 id="match-information-title">Mission Briefing</h2>
          <dl>
            <div>
              <dt>Winner</dt>
              <dd>
                <Link to={`/players/${encodeURIComponent(game.winner)}`}>
                  {formatPlayerName(game.winner, game.winnerDisplayName)}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Loser</dt>
              <dd>
                <Link to={`/players/${encodeURIComponent(game.loser)}`}>
                  {formatPlayerName(game.loser, game.loserDisplayName)}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Mission</dt>
              <dd>{mission || 'Mission not recorded'}</dd>
            </div>
            <div>
              <dt>Division</dt>
              <dd>{game.division || 'Not recorded'}</dd>
            </div>
          </dl>
        </section>

        <EntityPreviousNext current={game.id} type="match" />
      </div>
    </main>
  )
}

function formatGameParticipant(game: RecentGame, player: string) {
  if (player === game.winner) {
    return formatPlayerName(game.winner, game.winnerDisplayName)
  }

  if (player === game.loser) {
    return formatPlayerName(game.loser, game.loserDisplayName)
  }

  return player
}

function formatBattleReportScore(score: number | string | undefined, label: 'TP' | 'OP' | 'VP') {
  const value = String(score ?? '').trim()

  if (!value) {
    return `Not recorded ${label}`
  }

  return `${value} ${label}`
}

function ScoreLane({ score }: { score: string }) {
  const { label, value } = splitFormattedScore(score)
  const [winnerScore, loserScore] = splitScore(value)

  return (
    <div className="score-lane">
      <span>{label}</span>
      <strong>
        <b>{winnerScore}</b>-{loserScore}
      </strong>
    </div>
  )
}

function GameNotFound() {
  return (
    <main className="portal-shell">
      <div className="match-report">
        <nav className="match-nav" aria-label="Match navigation">
          <Link to="/">Back to Dashboard</Link>
          <Link to="/#recent-games">Back to Recent Games</Link>
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

function splitFormattedScore(score: string) {
  const [value = '0-0', label = ''] = score.split(' ')
  return { label, value }
}

export default GameDetails
