import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Link, useParams } from 'react-router-dom'
import EntityPreviousNext from '../components/EntityPreviousNext'
import OperatorBadge from '../components/OperatorBadge'
import Skeleton from '../components/Skeleton'
import { getCanonicalMissionName } from '../config/missions'
import { apiClient, type CommissionerNewsItem, type RecentGame, type StreamedGame } from '../services/api'
import { formatPlayerName } from '../services/formatting'
import { getGameTimelineResult, isDrawGame } from '../services/gameResults'
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

type BattleParticipant = {
  displayName: string
  faction: string
  label: string
  name: string
  result: string
  scoreTone: 'cyan' | 'red'
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
        <div className="battle-report" aria-label="Battle report loading">
          <nav className="battle-report-breadcrumb" aria-label="Battle report navigation">
            <Link to="/">Dashboard</Link>
            <span aria-hidden="true">/</span>
            <Link to="/#recent-games">Battle Reports</Link>
          </nav>
          <section className="battle-report-hero">
            <Skeleton label="Battle report loading" rows={8} />
          </section>
          <section className="battle-report-grid">
            <Skeleton label="Battle report timeline loading" rows={6} />
            <Skeleton label="Battle report scoring loading" rows={6} />
          </section>
        </div>
      </main>
    )
  }

  if (gameState.status === 'not-found') {
    return <GameNotFound />
  }

  return <BattleReport game={gameState.game} stream={gameState.stream} />
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
    gameType: 'league',
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

function BattleReport({ game, stream }: { game: RecentGame; stream: StreamedGame | null }) {
  const mission = getCanonicalMissionName(game.mission)
  const isDraw = isDrawGame(game)
  const participants = useMemo(() => buildParticipants(game, isDraw), [game, isDraw])
  const scores = useMemo(() => buildScores(game), [game])
  const timeline = useMemo(() => buildBattleTimeline(game, mission), [game, mission])
  const reportType = formatReportType(game)
  const battleHighlight = game.bestMoment.trim()

  return (
    <main className="portal-shell">
      <article className="battle-report" aria-labelledby="battle-report-title">
        <nav className="battle-report-breadcrumb" aria-label="Battle report navigation">
          <Link to="/">Dashboard</Link>
          <span aria-hidden="true">/</span>
          <Link to="/#recent-games">Battle Reports</Link>
          {game.division ? (
            <>
              <span aria-hidden="true">/</span>
              <span>{game.division}</span>
            </>
          ) : null}
        </nav>

        <header className="battle-report-hero">
          <div>
            <p className="battle-report-kicker">Mission Dossier</p>
            <h1 id="battle-report-title">{mission || 'Mission Not Recorded'}</h1>
            <div className="battle-report-tags" aria-label="Battle report classifications">
              {game.division ? <span>{game.division}</span> : null}
              <span>{reportType}</span>
              {game.date ? <span>{game.date}</span> : null}
            </div>
          </div>
          <dl className="battle-report-identifiers" aria-label="Battle report identifiers">
            <div>
              <dt>Report ID</dt>
              <dd>BR-{game.id}</dd>
            </div>
            <div>
              <dt>Classification</dt>
              <dd>{reportType}</dd>
            </div>
            {game.date ? (
              <div>
                <dt>Date Played</dt>
                <dd>{game.date}</dd>
              </div>
            ) : null}
          </dl>
        </header>

        <section className={isDraw ? 'battle-report-versus is-draw' : 'battle-report-versus'} aria-label="Battle result">
          <ParticipantPanel participant={participants[0]} game={game} />
          <Scoreboard isDraw={isDraw} scores={scores} />
          <ParticipantPanel participant={participants[1]} game={game} />
        </section>

        <section className="battle-report-grid battle-report-grid-primary">
          <BattleCard title="Mission Summary" eyebrow="Mission Briefing">
            <dl className="battle-report-facts">
              <Fact label="Game Type" value={reportType} />
              <Fact label="Division" value={game.division || 'Not recorded'} />
              <Fact label="First Turn" value={formatGameParticipant(game, game.firstTurn) || 'Not recorded'} />
              <Fact label="Mission" value={mission || 'Mission not recorded'} />
            </dl>
          </BattleCard>

          <BattleCard title="Game Timeline" eyebrow="Timeline">
            <ol className="battle-report-timeline">
              {timeline.map((item) => (
                <li key={item.title}>
                  <span>{item.time}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </BattleCard>

          <BattleCard title="Battle Highlight" eyebrow="After Action Note" wide>
            <blockquote className="battle-report-highlight">
              "{battleHighlight || 'No Battle Highlight submitted.'}"
            </blockquote>
          </BattleCard>
        </section>

        <section className="battle-report-grid">
          <BattleCard title="Army Lists" eyebrow="Force Manifests" wide>
            <div className="battle-report-armies">
              {participants.map((participant) => (
                <article className={`battle-report-army is-${participant.scoreTone}`} key={participant.name}>
                  <strong>{participant.displayName}</strong>
                  <span>{participant.faction || 'Army not recorded'}</span>
                  {participant.faction ? (
                    <Link to={`/factions/${encodeURIComponent(participant.faction)}`}>
                      View Army Dossier
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </BattleCard>

          <BattleCard title="Mission Objectives" eyebrow="Scoring">
            <dl className="battle-report-objectives">
              {scores.map((score) => (
                <div key={score.label}>
                  <dt>{score.label}</dt>
                  <dd>
                    <span>{score.left}</span>
                    <b>{score.right}</b>
                  </dd>
                </div>
              ))}
            </dl>
          </BattleCard>

          {stream ? <StreamPanel game={game} stream={stream} /> : null}

          <BattleCard title="Report Information" eyebrow="Verification">
            <dl className="battle-report-facts">
              <Fact label="Reported On" value={game.date || 'Not recorded'} />
              <Fact label="Report ID" value={`BR-${game.id}`} />
              {stream ? <Fact label="Stream" value={stream.title || 'Linked stream'} /> : null}
              <Fact label="Result" value={isDraw ? 'Draw' : getGameTimelineResult(game)} />
            </dl>
          </BattleCard>
        </section>

        <nav className="battle-report-footer-nav" aria-label="Battle report footer navigation">
          <EntityPreviousNext current={game.id} type="match" />
          <Link to="/#recent-games">Back to Battle Reports</Link>
        </nav>
      </article>
    </main>
  )
}

function ParticipantPanel({ game, participant }: { game: RecentGame; participant: BattleParticipant }) {
  return (
    <article className={`battle-report-participant is-${participant.scoreTone}`}>
      <OperatorBadge
        competitiveHome={game.division || 'Casual Player'}
        player={{
          displayName: participant.displayName,
          division: game.division,
          favoriteFaction: participant.faction,
          name: participant.name,
          rank: 0,
        }}
        preferredFaction={participant.faction}
        rank={0}
        showBadges={false}
      />
      <div className="battle-report-participant-copy">
        <span>{participant.result}</span>
        <h2>{participant.displayName}</h2>
        {participant.faction ? (
          <Link to={`/factions/${encodeURIComponent(participant.faction)}`}>
            {participant.faction}
          </Link>
        ) : (
          <p>Army not recorded</p>
        )}
      </div>
    </article>
  )
}

function Scoreboard({
  isDraw,
  scores,
}: {
  isDraw: boolean
  scores: Array<{ label: 'TP' | 'OP' | 'VP'; left: string; right: string }>
}) {
  const primary = scores.find((score) => score.label === 'OP') ?? scores[0]

  return (
    <div className={isDraw ? 'battle-report-score is-draw' : 'battle-report-score'} aria-label="Final score">
      <span>{isDraw ? 'Draw' : 'Final Score'}</span>
      <strong>
        <b>{primary.left}</b>
        <em>{primary.label}</em>
        <b>{primary.right}</b>
      </strong>
      <dl>
        {scores.map((score) => (
          <div key={score.label}>
            <dt>{score.label}</dt>
            <dd>{score.left}-{score.right}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function BattleCard({
  children,
  eyebrow,
  title,
  wide = false,
}: {
  children: ReactNode
  eyebrow: string
  title: string
  wide?: boolean
}) {
  return (
    <section className={wide ? 'battle-report-card is-wide' : 'battle-report-card'} aria-labelledby={slugTitle(title)}>
      <p className="battle-report-card-eyebrow">{eyebrow}</p>
      <h2 id={slugTitle(title)}>{title}</h2>
      {children}
    </section>
  )
}

function StreamPanel({ game, stream }: { game: RecentGame; stream: StreamedGame }) {
  return (
    <BattleCard title="Stream / VOD" eyebrow="Transmission">
      <div className="battle-report-stream">
        {stream.thumbnailUrl ? (
          <img alt="" loading="lazy" src={stream.thumbnailUrl} />
        ) : null}
        <div>
          <strong>{stream.title || `${game.winner} vs ${game.loser}`}</strong>
          {stream.platform || stream.streamer ? (
            <span>{[stream.platform, stream.streamer].filter(Boolean).join(' / ')}</span>
          ) : null}
          <Link to={`/streams?streamId=${stream.id}`}>Watch Now</Link>
        </div>
      </div>
    </BattleCard>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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

function formatReportType(game: RecentGame) {
  const type = String(game.gameType || '').trim()

  if (type) {
    return `${type.charAt(0).toUpperCase()}${type.slice(1)}`
  }

  if (game.eventId || game.division) {
    return 'League'
  }

  return 'Battle Report'
}

function buildParticipants(game: RecentGame, isDraw: boolean): [BattleParticipant, BattleParticipant] {
  return [
    {
      displayName: formatPlayerName(game.winner, game.winnerDisplayName),
      faction: game.winnerFaction,
      label: isDraw ? 'Player One' : 'Winner',
      name: game.winner,
      result: isDraw ? 'Draw' : 'Winner',
      scoreTone: 'cyan',
    },
    {
      displayName: formatPlayerName(game.loser, game.loserDisplayName),
      faction: game.loserFaction,
      label: isDraw ? 'Player Two' : 'Defeated',
      name: game.loser,
      result: isDraw ? 'Draw' : 'Defeated',
      scoreTone: 'red',
    },
  ]
}

function buildScores(game: RecentGame) {
  return [
    { label: 'OP' as const, ...splitScoreValue(game.op) },
    { label: 'TP' as const, ...splitScoreValue(game.tp) },
    { label: 'VP' as const, ...splitScoreValue(game.vp) },
  ]
}

function buildBattleTimeline(game: RecentGame, mission: string) {
  const items = [
    {
      description: formatGameParticipant(game, game.firstTurn) || 'First turn not recorded',
      time: 'Phase 01',
      title: 'First Turn',
    },
    {
      description: mission || 'Mission not recorded',
      time: 'Phase 02',
      title: 'Mission Briefing',
    },
    {
      description: getGameTimelineResult(game),
      time: 'Phase 03',
      title: 'Mission Complete',
    },
  ]

  if (game.bestMoment.trim()) {
    items.splice(2, 0, {
      description: game.bestMoment.trim(),
      time: 'Phase 03',
      title: 'Battle Highlight',
    })
    items[3] = { ...items[3], time: 'Phase 04' }
  }

  return items
}

function splitScoreValue(value: number | string | undefined) {
  const normalized = normalizeScoreText(String(value ?? '').trim())
  const [left = 'Not recorded', right = 'Not recorded'] = normalized ? normalized.split('-') : []

  return {
    left: left.trim() || 'Not recorded',
    right: right.trim() || 'Not recorded',
  }
}

function normalizeScoreText(value: string) {
  if (value === '-0' || Object.is(Number(value), -0)) {
    return '0'
  }

  return value
    .split('-')
    .map((part) => {
      const trimmed = part.trim()
      return trimmed === '-0' || Object.is(Number(trimmed), -0) ? '0' : trimmed
    })
    .join('-')
}

function GameNotFound() {
  return (
    <main className="portal-shell">
      <div className="battle-report">
        <nav className="battle-report-breadcrumb" aria-label="Battle report navigation">
          <Link to="/">Dashboard</Link>
          <span aria-hidden="true">/</span>
          <Link to="/#recent-games">Battle Reports</Link>
        </nav>
        <section className="dashboard-state" aria-label="Game not found">
          <p role="alert">Game not found.</p>
        </section>
      </div>
    </main>
  )
}

function slugTitle(title: string) {
  return `battle-report-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export default GameDetails
