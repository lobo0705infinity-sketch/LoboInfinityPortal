import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient, type RecentGame } from '../services/api'
import { formatObjectiveScore } from '../services/formatting'
import { getGameHeadline, isDrawGame } from '../services/gameResults'

type RecentGamesState = {
  games: RecentGame[]
  isLoading: boolean
}

type RecentGamesProps = {
  games?: RecentGame[]
  isLoading?: boolean
}

function RecentGames({
  games: controlledGames,
  isLoading: controlledIsLoading,
}: RecentGamesProps) {
  const [{ games, isLoading }, setState] = useState<RecentGamesState>({
    games: [],
    isLoading: true,
  })
  const hasControlledGames = controlledGames !== undefined

  useEffect(() => {
    if (hasControlledGames) {
      return
    }

    const controller = new AbortController()

    async function loadRecentGames() {
      try {
        const nextGames = await apiClient.getRecentGames({
          signal: controller.signal,
        })

        setState({
          games: nextGames,
          isLoading: false,
        })
      } catch {
        if (!controller.signal.aborted) {
          setState({
            games: [],
            isLoading: false,
          })
        }
      }
    }

    void loadRecentGames()

    return () => {
      controller.abort()
    }
  }, [hasControlledGames])

  const displayGames = controlledGames ?? games
  const displayIsLoading = controlledIsLoading ?? isLoading

  return (
    <section
      className="panel recent-games-panel"
      id="recent-games"
      aria-labelledby="recent-games-title"
    >
      <div className="panel-heading">
        <p className="eyebrow">Recent Games</p>
        <h2 id="recent-games-title">Recent Games</h2>
      </div>

      {displayIsLoading ? (
        <div className="recent-games-empty" aria-live="polite">
          <p>Loading recent games...</p>
        </div>
      ) : displayGames.length > 0 ? (
        <div className="recent-games-list">
          {displayGames.map((game) => (
            <Link
              className="recent-game-card"
              key={game.id}
              to={`/games/${game.id}`}
            >
              <div>
                <span className="eyebrow">{formatRelativeDate(game.date)}</span>
                <h3>
                  {getGameHeadline(game)}
                </h3>
              </div>

              <dl className="recent-game-summary">
                <div>
                  <dt>Mission</dt>
                  <dd>{game.mission || 'Mission not recorded'}</dd>
                </div>
                <div>
                  <dt>{isDrawGame(game) ? 'Player 1 Faction' : 'Winner Faction'}</dt>
                  <dd>{game.winnerFaction}</dd>
                </div>
                <div>
                  <dt>OP Score</dt>
                  <dd>{formatObjectiveScore(game)}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      ) : (
        <div className="recent-games-empty">
          <strong>No games have been reported yet.</strong>
        </div>
      )}
    </section>
  )
}

function formatRelativeDate(dateText: string) {
  const date = parseDate(dateText)

  if (!date) {
    return dateText
  }

  const today = startOfDay(new Date())
  const gameDate = startOfDay(date)
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.round((today.getTime() - gameDate.getTime()) / dayMs)

  if (diffDays === 0) {
    return 'Today'
  }

  if (diffDays === 1) {
    return 'Yesterday'
  }

  if (diffDays > 1 && diffDays < 7) {
    return `${diffDays} days ago`
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function parseDate(dateText: string) {
  const isoParts = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (isoParts) {
    return new Date(
      Number(isoParts[1]),
      Number(isoParts[2]) - 1,
      Number(isoParts[3]),
    )
  }

  const parsed = new Date(dateText)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export default RecentGames
