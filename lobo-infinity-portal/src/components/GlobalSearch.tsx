import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../services/api'

type SearchItem = {
  category: string
  label: string
  meta: string
  to: string
}

type SearchState =
  | {
      status: 'idle'
    }
  | {
      items: SearchItem[]
      status: 'success'
    }
  | {
      status: 'error'
    }

function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState<SearchState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadSearchData() {
      try {
        const [players, factions, missions, games] = await Promise.all([
          apiClient.getPlayers({ signal: controller.signal }),
          apiClient.getFactions({ signal: controller.signal }),
          apiClient.getMissions({ signal: controller.signal }),
          apiClient.getRecentGames({ signal: controller.signal }),
        ])

        const playerItems = players.flatMap((division) =>
          division.standings.map((player) => ({
            category: 'Player',
            label: player.player,
            meta: `${division.divisionLabel} · Rank #${player.rank}`,
            to: `/players/${encodeURIComponent(player.player)}`,
          })),
        )

        const factionItems = factions.map((faction) => ({
          category: 'Faction',
          label: faction.name,
          meta: `${faction.games} games · ${faction.winRate}% win rate`,
          to: `/factions/${encodeURIComponent(faction.name)}`,
        }))

        const missionItems = missions.map((mission) => ({
          category: 'Mission',
          label: mission.mission,
          meta: `${mission.games} games · ${mission.firstTurnWinRate}% first turn`,
          to: `/missions/${encodeURIComponent(mission.mission)}`,
        }))

        const matchItems = games.map((game) => ({
          category: 'Match',
          label: `${game.winner} defeated ${game.loser}`,
          meta: `${game.mission} · ${game.vp}`,
          to: `/games/${game.id}`,
        }))

        setSearchState({
          items: [...playerItems, ...factionItems, ...missionItems, ...matchItems],
          status: 'success',
        })
      } catch {
        if (!controller.signal.aborted) {
          setSearchState({
            status: 'error',
          })
        }
      }
    }

    void loadSearchData()

    return () => {
      controller.abort()
    }
  }, [])

  const results = useMemo(() => {
    if (searchState.status !== 'success') {
      return []
    }

    const normalizedQuery = query.trim().toLowerCase()

    if (normalizedQuery.length < 2) {
      return []
    }

    return searchState.items
      .filter((item) =>
        `${item.category} ${item.label} ${item.meta}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 8)
  }, [query, searchState])

  return (
    <div className="global-search">
      <label className="search-label" htmlFor="global-search">
        Search
      </label>
      <input
        autoComplete="off"
        id="global-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search league"
        type="search"
        value={query}
      />
      {query.trim().length >= 2 ? (
        <div className="search-results" role="listbox">
          {searchState.status === 'error' ? (
            <p>Search is unavailable.</p>
          ) : results.length > 0 ? (
            results.map((result) => (
              <Link
                className="search-result"
                key={`${result.category}-${result.to}`}
                onClick={() => setQuery('')}
                to={result.to}
              >
                <span>{result.category}</span>
                <strong>{result.label}</strong>
                <small>{result.meta}</small>
              </Link>
            ))
          ) : (
            <p>No matching live records.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default GlobalSearch
