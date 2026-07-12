import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatObjectiveScore, formatPlayerName } from '../services/formatting'
import { getSearchIndex, updateProfile } from '../services/lightApi'
import { preloadRoute } from '../services/routePreload'
import PortalIcon from './PortalIcon'

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

let cachedSearchItems: SearchItem[] | null = null
let searchItemsPromise: Promise<SearchItem[]> | null = null

function GlobalSearch({ mode = 'desktop' }: { mode?: 'desktop' | 'mobile' }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [searchState, setSearchState] = useState<SearchState>({
    status: 'idle',
  })
  const [hasRequestedSearchData, setHasRequestedSearchData] = useState(false)
  const inputId = mode === 'mobile' ? 'mobile-global-search' : 'global-search'
  const resultsId =
    mode === 'mobile' ? 'mobile-global-search-results' : 'global-search-results'

  useEffect(() => {
    if (!hasRequestedSearchData) {
      return
    }

    const controller = new AbortController()

    async function loadSearchData() {
      try {
        const items = await getSearchItems()

        if (controller.signal.aborted) {
          return
        }

        setSearchState({
          items,
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
    setIsMobileOpen(false)
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

  const quickJumpItems = [
    { label: 'Dashboard', to: '/' },
    { label: 'Match Finder', to: '/match-finder' },
    { label: 'Standings', to: '/standings' },
    { label: 'Notifications', to: '/notifications' },
    { label: 'My Profile', to: '/profile' },
    { label: 'Army Lists', to: '/army-lists' },
  ]

  return (
    <div
      className={
        mode === 'mobile' && isMobileOpen
          ? 'global-search mobile-search-open'
          : mode === 'mobile'
            ? 'global-search mobile-search'
            : 'global-search'
      }
    >
      {mode === 'mobile' ? (
        <button
          aria-expanded={isMobileOpen}
          aria-label="Open search"
          className="mobile-search-trigger"
          onClick={() => {
            setIsMobileOpen(true)
            setHasRequestedSearchData(true)
          }}
          type="button"
        >
          <PortalIcon name="search" />
        </button>
      ) : null}
      <div className="global-search-surface">
        {mode === 'mobile' ? (
          <div className="mobile-search-heading">
            <strong>Search League</strong>
            <button onClick={closeSearch} type="button">
              Close
            </button>
          </div>
        ) : null}
      <label className="search-label" htmlFor={inputId}>
        Search
      </label>
      <input
        aria-activedescendant={
          results[activeIndex]
            ? `${mode}-search-result-${activeIndex}`
            : undefined
        }
        aria-controls={resultsId}
        aria-expanded={query.trim().length >= 2}
        autoComplete="off"
        id={inputId}
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
      {mode === 'mobile' && query.trim().length < 2 ? (
        <div className="mobile-quick-jump" aria-label="Quick jump">
          {quickJumpItems.map((item) => (
            <Link
              key={item.to}
              onClick={closeSearch}
              onMouseEnter={() => preloadRoute(item.to)}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
      {query.trim().length >= 2 ? (
        <div className="search-results" id={resultsId} role="listbox">
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
                id={`${mode}-search-result-${index}`}
                key={`${result.category}-${result.to}`}
                onClick={() => {
                  rememberSearch(result)
                  closeSearch()
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onPointerEnter={() => preloadRoute(result.to)}
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
    </div>
  )
}

async function getSearchItems() {
  if (cachedSearchItems) {
    return cachedSearchItems
  }

  searchItemsPromise ??= Promise.all([
    getSearchIndex(),
    import('../config/missions'),
  ])
    .then(([{ players, factions, missions, games, armyLists }, missionRegistry]) => {
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

      const missionItems = missionRegistry.filterCanonicalMissionRecords(missions).map((mission) => ({
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

      cachedSearchItems = [
        ...playerItems,
        ...factionItems,
        ...missionItems,
        ...matchItems,
        ...armyListItems,
      ]

      return cachedSearchItems
    })
    .finally(() => {
      searchItemsPromise = null
    })

  return searchItemsPromise
}

export default GlobalSearch
