import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import { apiClient, type GameCenterGame } from '../services/api'
import {
  applyGameCenterView,
  buildGameCenterFilterOptions,
  defaultGameCenterFilters,
  defaultGameCenterSort,
  gameCenterColumns,
  nextGameCenterSort,
  type GameCenterFilterKey,
  type GameCenterFilters,
  type GameCenterSortKey,
  type GameCenterSortState,
} from '../services/gameCenter'

type GameCenterState =
  | { status: 'loading' }
  | { status: 'success'; games: GameCenterGame[]; generatedAt: string }
  | { status: 'error'; message: string }

const filterControls: Array<{
  key: Exclude<GameCenterFilterKey, 'search'>
  label: string
  optionKey: 'events' | 'players' | 'factions' | 'gameTypes' | 'missions' | 'teams'
}> = [
  { key: 'event', label: 'Event', optionKey: 'events' },
  { key: 'player', label: 'Player', optionKey: 'players' },
  { key: 'faction', label: 'Faction', optionKey: 'factions' },
  { key: 'gameType', label: 'Game Type', optionKey: 'gameTypes' },
  { key: 'mission', label: 'Mission', optionKey: 'missions' },
  { key: 'team', label: 'Team', optionKey: 'teams' },
]

function CommissionerGameCenter() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<GameCenterState>({ status: 'loading' })
  const [filters, setFilters] = useState<GameCenterFilters>(defaultGameCenterFilters)
  const [sort, setSort] = useState<GameCenterSortState>(defaultGameCenterSort)

  useEffect(() => {
    if (auth.status === 'loading') return
    if (!auth.authenticated || !auth.isAtLeastRole('Assistant Commissioner')) return

    const controller = new AbortController()

    setState({ status: 'loading' })
    apiClient
      .getGameCenter({ signal: controller.signal })
      .then((data) => {
        setState({
          status: 'success',
          games: data.games,
          generatedAt: data.generatedAt,
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Game Center could not be loaded.',
        })
      })

    return () => controller.abort()
  }, [auth])

  const games = state.status === 'success' ? state.games : []
  const options = useMemo(() => buildGameCenterFilterOptions(games), [games])
  const visibleGames = useMemo(
    () => applyGameCenterView(games, filters, sort),
    [filters, games, sort],
  )
  const hasActiveFilters = Object.values(filters).some(Boolean)
  const canCorrectScores = auth.isAtLeastRole('Commissioner')

  function updateFilter(key: GameCenterFilterKey, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function sortBy(key: GameCenterSortKey) {
    setSort((current) => nextGameCenterSort(current, key))
  }

  if (auth.status === 'loading') {
    return <GameCenterLoading />
  }

  if (!auth.authenticated || !auth.isAtLeastRole('Assistant Commissioner')) {
    return (
      <main className="portal-shell">
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h1>Game Center</h1>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to inspect the complete game database.
          </p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return <GameCenterLoading />
  }

  return (
    <main className="portal-shell game-center-page">
      <section className="page-header game-center-header" aria-labelledby="game-center-title">
        <div>
          <p className="eyebrow">Commissioner</p>
          <h1 id="game-center-title">Game Center</h1>
          <p>
            Search, sort, and filter the canonical game database. Rows open the
            existing Game Details workflow.
          </p>
        </div>
        <div className="game-center-count" aria-live="polite">
          <strong>{visibleGames.length.toLocaleString()}</strong>
          <span>{visibleGames.length === 1 ? 'Game' : 'Games'}</span>
        </div>
      </section>

      <section className="panel operations-panel" aria-label="Games and Army Lists tools">
        <div className="panel-heading">
          <p className="eyebrow">Games & Army Lists</p>
          <h2>Canonical Corrections</h2>
          <p>Score corrections remain available from individual game rows. Use the dedicated tools for historical Army List links and Army Code exceptions.</p>
        </div>
        <div className="operations-actions wrap">
          <Link to="/commissioner/army-list-links">Historical Army List Links</Link>
          <Link to="/commissioner/army-code-validation">Army Code Validation</Link>
        </div>
      </section>

      {state.status === 'error' ? (
        <section className="panel dashboard-state">
          <h2>Game Center is unavailable.</h2>
          <p>{state.message}</p>
        </section>
      ) : (
        <>
          <section className="panel game-center-controls" aria-label="Game Center filters">
            <label className="game-center-search">
              <span>Search</span>
              <input
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="Player, mission, faction, team, or game ID"
                type="search"
                value={filters.search}
              />
            </label>

            <div className="game-center-filter-grid">
              {filterControls.map((control) => (
                <label key={control.key}>
                  <span>{control.label}</span>
                  <select
                    onChange={(event) => updateFilter(control.key, event.target.value)}
                    value={filters[control.key]}
                  >
                    <option value="">All</option>
                    {options[control.optionKey].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="game-center-toolbar">
              <p>
                {state.generatedAt
                  ? `Loaded ${formatTimestamp(state.generatedAt)}`
                  : 'Loaded from canonical game data'}
              </p>
              <button
                disabled={!hasActiveFilters}
                onClick={() => setFilters(defaultGameCenterFilters)}
                type="button"
              >
                Reset Filters
              </button>
            </div>
          </section>

          <section className="panel game-center-table-card" aria-label="Game Center results">
            {visibleGames.length === 0 ? (
              <div className="dashboard-state">
                <h2>No games found.</h2>
                <p>Adjust the filters or search term to widen the result set.</p>
              </div>
            ) : (
              <div className="game-center-table-wrap">
                <table className="game-center-table">
                  <thead>
                    <tr>
                      {gameCenterColumns.map((column) => (
                        <th key={column.key} scope="col">
                          <button
                            aria-sort={
                              sort.key === column.key
                                ? sort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                            className={sort.key === column.key ? 'active' : ''}
                            onClick={() => sortBy(column.key)}
                            type="button"
                          >
                            <span>{column.label}</span>
                            <span aria-hidden="true">
                              {sort.key === column.key
                                ? sort.direction === 'asc'
                                  ? '?'
                                  : '?'
                                : '?'}
                            </span>
                          </button>
                        </th>
                      ))}
                      {canCorrectScores ? <th scope="col">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleGames.map((game) => (
                      <tr
                        key={game.id}
                        onClick={() => navigate(`/games/${game.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            navigate(`/games/${game.id}`)
                          }
                        }}
                        tabIndex={0}
                      >
                        {gameCenterColumns.map((column) => (
                          <td key={column.key}>{getGameCenterCell(game, column.key)}</td>
                        ))}
                        {canCorrectScores ? (
                          <td>
                            <button
                              aria-label={`Correct score for game ${game.id}`}
                              className="game-center-row-action"
                              onClick={(event) => {
                                event.stopPropagation()
                                navigate(`/commissioner/game-center/${game.id}/score-correction`)
                              }}
                              type="button"
                            >
                              Correct Score
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function GameCenterLoading() {
  return (
    <main className="portal-shell">
      <section className="dashboard-state" aria-label="Game Center loading">
        <Loading />
      </section>
    </main>
  )
}

function getGameCenterCell(game: GameCenterGame, key: GameCenterSortKey) {
  if (key === 'id') return `#${game.id}`
  if (key === 'gameTypeLabel') return game.gameTypeLabel
  if (key === 'player1DisplayName') return game.player1DisplayName
  if (key === 'player2DisplayName') return game.player2DisplayName

  return String(game[key] || '?')
}

function formatTimestamp(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default CommissionerGameCenter
