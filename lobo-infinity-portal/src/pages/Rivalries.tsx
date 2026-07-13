import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type HomeData,
  type RecentGame,
} from '../services/api'
import {
  formatObjectiveScore,
  formatPlayerName,
  formatVictoryScore,
} from '../services/formatting'
import { getGameHeadline, isDrawGame } from '../services/gameResults'

type RivalriesState =
  | {
      status: 'loading'
    }
  | {
      data: HomeData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

type RivalrySummary = {
  averageMargin: number
  games: RecentGame[]
  key: string
  left: string
  leftDisplayName: string
  leftWins: number
  draws: number
  latest: RecentGame
  right: string
  rightDisplayName: string
  rightWins: number
  totalOP: string
  totalTP: string
  totalVP: string
}

function Rivalries() {
  const [state, setState] = useState<RivalriesState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getHome({ signal: controller.signal })
      .then((data) => setState({ data, status: 'success' }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Rivalry data could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <RivalriesHeader />
        <section className="rivalry-grid" aria-label="Rivalries loading">
          <Skeleton label="Rivalry cards loading" rows={7} />
          <Skeleton label="Rivalry cards loading" rows={7} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <section className="dashboard-state" aria-label="Rivalries error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return <RivalriesContent games={state.data.recentGames} />
}

function RivalriesContent({ games }: { games: RecentGame[] }) {
  const rivalries = useMemo(() => buildRivalries(games), [games])

  return (
    <main className="portal-shell">
      <RivalriesHeader />

      {rivalries.length === 0 ? (
        <section className="panel operations-empty">
          <h2>No established rivalries yet.</h2>
          <p>More repeated matchups need to be submitted before the league can tell this story.</p>
        </section>
      ) : null}

      <section className="rivalry-grid" aria-label="League rivalries">
        {rivalries.map((rivalry) => (
          <article className="panel rivalry-card" key={rivalry.key}>
            <div className="panel-heading">
              <p className="eyebrow">Rivalry</p>
              <h2>
                {formatPlayerName(rivalry.left, rivalry.leftDisplayName)} vs{' '}
                {formatPlayerName(rivalry.right, rivalry.rightDisplayName)}
              </h2>
            </div>
            <dl className="operations-metrics compact">
              <Metric label="Record" value={`${rivalry.leftWins}-${rivalry.rightWins}-${rivalry.draws}`} />
              <Metric label="TP" value={rivalry.totalTP} />
              <Metric label="OP" value={rivalry.totalOP} />
              <Metric label="VP" value={rivalry.totalVP} />
              <Metric label="Average Margin" value={`${rivalry.averageMargin} VP`} />
            </dl>
            <div className="dashboard-news-list">
              {rivalry.games.slice(0, 3).map((game) => (
                <Link className="dashboard-news-item" key={game.id} to={`/games/${game.id}`}>
                  <span>{game.date || game.division}</span>
                  <strong>
                    {getGameHeadline(game)}
                  </strong>
                  <p>
                    {game.mission} - {formatObjectiveScore(game)} - {formatVictoryScore(game)}
                  </p>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

function RivalriesHeader() {
  return (
    <section className="page-header">
      <p className="eyebrow">League Personality</p>
      <h1>Rivalry Room</h1>
      <p>
        Head-to-head stories built only from submitted league games. Rivalries
        appear here once the matchup has meaningful recent history.
      </p>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function buildRivalries(games: RecentGame[]) {
  const groups = new Map<string, RecentGame[]>()

  games.forEach((game) => {
    const players = [game.winner, game.loser].sort((a, b) =>
      a.localeCompare(b),
    )
    const key = players.join('::')
    const group = groups.get(key) ?? []
    group.push(game)
    groups.set(key, group)
  })

  return Array.from(groups.entries())
    .filter(([, group]) => group.length >= 2)
    .map(([key, group]) => buildRivalrySummary(key, group))
    .sort((left, right) => right.games.length - left.games.length)
    .slice(0, 12)
}

function buildRivalrySummary(key: string, games: RecentGame[]): RivalrySummary {
  const [left, right] = key.split('::')
  const latest = games[0]
  const draws = games.filter(isDrawGame).length
  const leftWins = games.filter((game) => !isDrawGame(game) && game.winner === left).length
  const rightWins = games.filter((game) => !isDrawGame(game) && game.winner === right).length
  const totalTP = sumScores(games, 'tp')
  const totalOP = sumScores(games, 'op')
  const totalVP = sumScores(games, 'vp')
  const totalMargin = games.reduce(
    (sum, game) => sum + Math.abs(scoreMargin(game.vp)),
    0,
  )

  return {
    averageMargin:
      games.length > 0 ? Math.round(totalMargin / games.length) : 0,
    games,
    key,
    latest,
    draws,
    left,
    leftDisplayName:
      latest.winner === left ? latest.winnerDisplayName : latest.loserDisplayName,
    leftWins,
    right,
    rightDisplayName:
      latest.winner === right ? latest.winnerDisplayName : latest.loserDisplayName,
    rightWins,
    totalOP: `${totalOP.left}-${totalOP.right}`,
    totalTP: `${totalTP.left}-${totalTP.right}`,
    totalVP: `${totalVP.left}-${totalVP.right}`,
  }
}

function sumScores(games: RecentGame[], field: 'op' | 'tp' | 'vp') {
  const [left] = [games[0].winner, games[0].loser].sort((a, b) =>
    a.localeCompare(b),
  )

  return games.reduce(
    (total, game) => {
      const score = parseScore(game[field])

      if (game.winner === left) {
        total.left += score.winner
        total.right += score.loser
      } else {
        total.left += score.loser
        total.right += score.winner
      }

      return total
    },
    { left: 0, right: 0 },
  )
}

function scoreMargin(value: string) {
  const score = parseScore(value)
  return score.winner - score.loser
}

function parseScore(value: string) {
  const [winner, loser] = value
    .split('-')
    .map((part) => Number(part.trim()) || 0)

  return {
    loser: loser ?? 0,
    winner: winner ?? 0,
  }
}

export default Rivalries
