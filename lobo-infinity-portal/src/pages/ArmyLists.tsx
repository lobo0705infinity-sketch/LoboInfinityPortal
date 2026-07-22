import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import OperatorBadge from '../components/OperatorBadge'
import Skeleton from '../components/Skeleton'
import { normalizeArmyForDisplay } from '../config/armies'
import {
  apiClient,
  type SubmittedArmyListEntry,
} from '../services/api'
import { formatPlayerName } from '../services/formatting'
import { resolvePlayerFactionIdentity } from '../services/playerFactionIdentity'

type ArmyListFilter = {
  event: string
  faction: string
  gameType: string
  player: string
  result: string
}

type ArmyListsState =
  | {
      status: 'loading'
    }
  | {
      lists: SubmittedArmyListEntry[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

const defaultFilters: ArmyListFilter = {
  event: 'all',
  faction: 'all',
  gameType: 'all',
  player: 'all',
  result: 'all',
}

function ArmyLists() {
  const [state, setState] = useState<ArmyListsState>({
    status: 'loading',
  })
  const [filters, setFilters] = useState<ArmyListFilter>(defaultFilters)

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getSubmittedArmyListLibrary({
        signal: controller.signal,
      })
      .then((lists) => {
        setState({
          lists,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Submitted army lists could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  const filterOptions = useMemo(() => {
    if (state.status !== 'success') {
      return {
        events: [],
        factions: [],
        gameTypes: [],
        players: [],
        results: [],
      }
    }

    return {
      events: getUniqueOptions(state.lists.map((list) => list.eventName)),
      factions: getUniqueOptions(state.lists.map((list) => getDisplayFaction(list))),
      gameTypes: getUniqueOptions(state.lists.map((list) => list.gameType)),
      players: getUniqueOptions(state.lists.map((list) => getDisplayPlayer(list))),
      results: getUniqueOptions(state.lists.map((list) => list.result)),
    }
  }, [state])

  const visibleLists = useMemo(() => {
    if (state.status !== 'success') {
      return []
    }

    return state.lists
      .filter((list) => matchesFilter(getDisplayPlayer(list), filters.player))
      .filter((list) => matchesFilter(getDisplayFaction(list), filters.faction))
      .filter((list) => matchesFilter(list.gameType, filters.gameType))
      .filter((list) => matchesFilter(list.eventName, filters.event))
      .filter((list) => matchesFilter(list.result, filters.result))
  }, [filters, state])

  function updateFilter(name: keyof ArmyListFilter, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
      <section className="army-list-controls army-list-library-controls" aria-label="Army list filters loading">
          <select disabled><option>Player</option></select>
          <select disabled><option>Faction</option></select>
          <select disabled><option>Game Type</option></select>
          <select disabled><option>Event</option></select>
          <select disabled><option>Result</option></select>
        </section>
        <section className="army-list-grid" aria-label="Army lists loading">
          <Skeleton label="Submitted army lists loading" rows={8} />
          <Skeleton label="Submitted army lists loading" rows={8} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Army lists error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />

      <section className="army-list-controls army-list-library-controls" aria-label="Army list filters">
        <FilterSelect
          label="Player"
          onChange={(value) => updateFilter('player', value)}
          options={filterOptions.players}
          value={filters.player}
        />
        <FilterSelect
          label="Faction"
          onChange={(value) => updateFilter('faction', value)}
          options={filterOptions.factions}
          value={filters.faction}
        />
        <FilterSelect
          label="Game Type"
          onChange={(value) => updateFilter('gameType', value)}
          options={filterOptions.gameTypes}
          value={filters.gameType}
        />
        <FilterSelect
          label="Event"
          onChange={(value) => updateFilter('event', value)}
          options={filterOptions.events}
          value={filters.event}
        />
        <FilterSelect
          label="Result"
          onChange={(value) => updateFilter('result', value)}
          options={filterOptions.results}
          value={filters.result}
        />
      </section>

      {visibleLists.length === 0 ? (
        <section className="dashboard-state" aria-label="No army lists">
          <p>No submitted army lists match the current filters.</p>
        </section>
      ) : (
        <section className="army-list-grid army-list-library-grid" aria-label="Army List Library">
          {visibleLists.map((list) => (
            <ArmyListCard key={list.id} list={list} />
          ))}
        </section>
      )}
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="army-lists-title">
      <p className="eyebrow">Community</p>
      <h1 id="army-lists-title">Army List Library</h1>
      <p>Submitted game lists from League, Casual, and Tournament battle reports</p>
    </section>
  )
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: string[]
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function ArmyListCard({ list }: { list: SubmittedArmyListEntry }) {
  const factionIdentity = resolvePlayerFactionIdentity({
    favoriteFaction: list.faction,
  })
  const portraitPath = factionIdentity.portraitPath
  const displayFaction = factionIdentity.normalizedFaction || getDisplayFaction(list)

  return (
    <article className={`army-list-card army-list-library-card is-${list.result.toLowerCase()}`}>
      {portraitPath ? (
        <span className="army-list-library-portrait" aria-label={`${displayFaction} portrait`}>
          <img
            alt={`${displayFaction} portrait`}
            decoding="async"
            loading="lazy"
            src={portraitPath}
          />
        </span>
      ) : null}
      <div className="army-list-library-badge">
        <OperatorBadge
          player={{
            displayName: getDisplayPlayer(list),
            favoriteFaction: displayFaction,
            name: list.player,
          }}
          preferredFaction={displayFaction}
          showBadges={false}
        />
      </div>
      <div className="army-list-library-body">
        <div className="army-list-card-heading">
          <div>
            <p className="eyebrow">{list.gameType}</p>
            <h2>{getDisplayPlayer(list)}</h2>
          </div>
          <strong>{list.result}</strong>
        </div>
        <p className="army-list-library-faction">{displayFaction || 'Faction not recorded'}</p>
        <dl className="army-list-meta army-list-library-meta">
          <div>
            <dt>Event</dt>
            <dd>{list.eventName || 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Opponent</dt>
            <dd>{formatPlayerName(list.opponent, list.opponentDisplayName)}</dd>
          </div>
          <div>
            <dt>Mission</dt>
            <dd>{list.mission || 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{list.date || 'Not recorded'}</dd>
          </div>
        </dl>
        <div className="army-list-actions army-list-library-actions">
          <ArmyListExternalLink armyCode={list.armyCode} />
          <Link to={list.battleReportPath}>View Battle Report</Link>
        </div>
      </div>
    </article>
  )
}

function ArmyListExternalLink({ armyCode }: { armyCode: string }) {
  const target = getArmyListTarget(armyCode)

  if (target.external) {
    return (
      <a href={target.href} rel="noreferrer" target="_blank">
        View in Infinity Army
      </a>
    )
  }

  return <Link to={target.href}>View in Infinity Army</Link>
}

function getArmyListTarget(armyCode: string) {
  const value = armyCode.trim()

  if (/^https?:\/\//i.test(value)) {
    return {
      external: true,
      href: value,
    }
  }

  return {
    external: false,
    href: `/army-list/${encodeURIComponent(value)}`,
  }
}

function matchesFilter(value: string, filter: string) {
  return filter === 'all' || value === filter
}

function getUniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}

function getDisplayFaction(list: SubmittedArmyListEntry) {
  return normalizeArmyForDisplay(list.faction)
}

function getDisplayPlayer(list: SubmittedArmyListEntry) {
  return formatPlayerName(list.player, list.playerDisplayName)
}

export default ArmyLists
