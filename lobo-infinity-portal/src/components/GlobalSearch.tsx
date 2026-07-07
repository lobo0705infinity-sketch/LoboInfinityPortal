import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatObjectiveScore, formatPlayerName } from '../services/formatting'
import { getSearchIndex, updateProfile } from '../services/lightApi'

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
  const auth = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [searchState, setSearchState] = useState<SearchState>({
    status: 'idle',
  })
  const [hasRequestedSearchData, setHasRequestedSearchData] = useState(false)

  useEffect(() => {
    if (!hasRequestedSearchData) {
      return
    }

    const controller = new AbortController()

    async function loadSearchData() {
      try {
        const { players, factions, missions, games, armyLists } =
          await getSearchIndex({
            signal: controller.signal,
          })

        const playerItems = players.flatMap((division) =>
          division.standings.map((player) => ({
            category: 'Player',
            label: formatPlayerName(player.player, player.displayName),
            meta: `${division.divisionLabel} - Rank #${player.rank}`,
            to: `/players/${encodeURIComponent(player.player)}`,
          })),
        )

        const factionItems = factions.map((faction) => ({
          category: 'Faction',
          label: faction.name,
          meta: `${faction.games} games - ${faction.winRate}% win rate`,
          to: `/factions/${encodeURIComponent(faction.name)}`,
        }))

        const missionItems = missions.map((mission) => ({
          category: 'Mission',
          label: mission.mission,
          meta: `${mission.games} games - ${mission.firstTurnWinRate}% first turn`,
          to: `/missions/${encodeURIComponent(mission.mission)}`,
        }))

        const matchItems = games.map((game) => ({
          category: 'Match',
          label: `${formatPlayerName(game.winner, game.winnerDisplayName)} defeated ${formatPlayerName(game.loser, game.loserDisplayName)}`,
          meta: `${game.mission} - ${formatObjectiveScore(game)}`,
          to: `/games/${game.id}`,
        }))

        const armyListItems = armyLists.map((list) => ({
          category: 'Army List',
          label: list.armyName,
          meta: `${formatPlayerName(list.player, list.playerDisplayName)} - ${list.faction} - ${list.mission || 'Mission not recorded'}`,
          to: '/army-lists',
        }))

        setSearchState({
          items: [
            ...playerItems,
            ...factionItems,
            ...missionItems,
            ...matchItems,
            ...armyListItems,
          ],
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
  }, [hasRequestedSearchData])

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

  function closeSearch() {
    setQuery('')
    setActiveIndex(0)
  }

  function rememberSearch(item: SearchItem) {
    if (!auth.authenticated) {
      return
    }

    const history = [
      item.label,
      ...auth.user.searchHistory.filter((entry) => entry !== item.label),
    ].slice(0, 12)

    void updateProfile({
      searchHistory: JSON.stringify(history),
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      closeSearch()
      return
    }

    if (results.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % results.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + results.length) % results.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      rememberSearch(results[activeIndex])
      navigate(results[activeIndex].to)
      closeSearch()
    }
  }

  return (
    <div className="global-search">
      <label className="search-label" htmlFor="global-search">
        Search
      </label>
      <input
        aria-activedescendant={
          results[activeIndex] ? `search-result-${activeIndex}` : undefined
        }
        aria-controls="global-search-results"
        aria-expanded={query.trim().length >= 2}
        autoComplete="off"
        id="global-search"
        onFocus={() => setHasRequestedSearchData(true)}
        onChange={(event) => {
          setHasRequestedSearchData(true)
          setQuery(event.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search league"
        role="combobox"
        type="search"
        value={query}
      />
      {query.trim().length >= 2 ? (
        <div className="search-results" id="global-search-results" role="listbox">
          {searchState.status === 'error' ? (
            <p>Search is unavailable.</p>
          ) : results.length > 0 ? (
            results.map((result, index) => (
              <Link
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? 'search-result active'
                    : 'search-result'
                }
                id={`search-result-${index}`}
                key={`${result.category}-${result.to}`}
                onClick={() => {
                  rememberSearch(result)
                  closeSearch()
                }}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
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
