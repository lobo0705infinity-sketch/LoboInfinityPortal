import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PlayerCard from '../components/PlayerCard'
import Skeleton from '../components/Skeleton'
import { apiClient } from '../services/api'
import {
  getStandingClassifications,
  statusFilterMatches,
  type PlayerStatusFilter,
} from '../services/playerClassification'
import type { DivisionKey, DivisionStandings, Standing } from '../types/dashboard'
import {
  getDivisionIdentity,
  getDivisionStyle,
} from '../utils/divisions'

type PlayerFilter = 'all' | DivisionKey
type CommunitySort = 'recent' | 'games' | 'winRate' | 'name'
type PlayerListItem = Standing & {
  divisionLabel?: string
}

type PlayersState =
  | {
      status: 'loading'
    }
  | {
      divisions: DivisionStandings[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function Players() {
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') || ''
  const eventScoped = Boolean(eventId)
  const [activeFilter, setActiveFilter] = useState<PlayerFilter>('all')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PlayerStatusFilter>('all')
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [sortBy, setSortBy] = useState<CommunitySort>('recent')
  const [playersState, setPlayersState] = useState<PlayersState>({
    status: 'loading',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getPlayers({
        eventId,
        signal: controller.signal,
      })
      .then((divisions) => {
        setPlayersState({
          divisions,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setPlayersState({
          error:
            error instanceof Error
              ? error.message
              : 'Player data could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [eventId])

  const players = useMemo(() => {
    if (playersState.status !== 'success') {
      return []
    }

    return playersState.divisions.flatMap((division) =>
      division.standings.map((player) => ({
        ...player,
        division: player.division || (eventScoped ? division.division : ''),
        divisionLabel: player.division || (eventScoped ? division.divisionLabel : 'Community'),
        statusBadges: getStandingClassifications(player),
      })),
    )
  }, [eventScoped, playersState])

  const filterOptions = useMemo(() => {
    if (playersState.status !== 'success') {
      return []
    }

    return playersState.divisions.map((division) => ({
      count: division.summary.players,
      id: division.division,
      identity: getDivisionIdentity(division.division),
    }))
  }, [playersState])

  const filteredPlayers =
    activeFilter === 'all'
      ? players
      : players.filter((player) => player.division === activeFilter)
  const communityDivisions = useMemo(
    () =>
      Array.from(
        new Set(
          players
            .map((player) => player.division)
            .filter((division): division is string => Boolean(division)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [players],
  )
  const communityCounts = useMemo(() => {
    const hasClassification = (
      player: (typeof players)[number],
      classification: ReturnType<typeof getStandingClassifications>[number],
    ) => getStandingClassifications(player).includes(classification)

    return {
      registered: players.length,
      league: players.filter((player) => hasClassification(player, 'League Player')).length,
      tournament: players.filter((player) => hasClassification(player, 'Tournament Player')).length,
      casual: players.filter((player) => hasClassification(player, 'Casual Player')).length,
      newPlayers: players.filter((player) => hasClassification(player, 'New Player')).length,
    }
  }, [players])
  const communityPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery = (player: (typeof players)[number]) => {
      if (!normalizedQuery) {
        return true
      }

      return [
        player.player,
        player.displayName,
        player.favoriteArmy,
        player.faction,
        player.division,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    }
    const matchesStatus = (player: (typeof players)[number]) => {
      return statusFilterMatches(getStandingClassifications(player), statusFilter)
    }
    const matchesDivision = (player: (typeof players)[number]) =>
      divisionFilter === 'all' || player.division === divisionFilter

    return players
      .filter(matchesQuery)
      .filter(matchesStatus)
      .filter(matchesDivision)
      .slice()
      .sort((left, right) => sortCommunityPlayers(left, right, sortBy))
  }, [divisionFilter, players, query, sortBy, statusFilter])

  if (playersState.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader eventScoped={eventScoped} />
        <section className="division-tabs" aria-label="Player filters loading">
          <button className="division-tab active" disabled type="button">
            All Players
          </button>
          <button className="division-tab" disabled type="button">
            Alpha
          </button>
          <button className="division-tab" disabled type="button">
            Beta
          </button>
        </section>
        <section className="players-grid" aria-label="Players loading">
          <Skeleton label="Player cards loading" rows={8} />
          <Skeleton label="Player cards loading" rows={8} />
          <Skeleton label="Player cards loading" rows={8} />
        </section>
      </main>
    )
  }

  if (playersState.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader eventScoped={eventScoped} />
        <section className="dashboard-state" aria-label="Players error">
          <p role="alert">{playersState.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader eventScoped={eventScoped} />

      {eventScoped ? (
        <section className="division-tabs" aria-label="Player filters">
          <button
            className={activeFilter === 'all' ? 'division-tab active' : 'division-tab'}
            onClick={() => setActiveFilter('all')}
            type="button"
          >
            All Players
          </button>
          {filterOptions.map((filter) => (
            <button
              className={
                activeFilter === filter.id ? 'division-tab active' : 'division-tab'
              }
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              style={getDivisionStyle(filter.id)}
              type="button"
            >
              {filter.identity.icon} {filter.identity.label} ({filter.count})
            </button>
          ))}
        </section>
      ) : (
        <>
          <section className="community-player-summary" aria-label="Community player counts">
            <SummaryCard label="Registered Players" value={communityCounts.registered} />
            <SummaryCard label="League Players" value={communityCounts.league} />
            <SummaryCard label="Tournament Players" value={communityCounts.tournament} />
            <SummaryCard label="Casual Players" value={communityCounts.casual} />
            <SummaryCard label="New Players" value={communityCounts.newPlayers} />
          </section>

          <section className="community-player-controls" aria-label="Community player filters">
            <label>
              <span>Search</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Player, display name, army, division"
                type="search"
                value={query}
              />
            </label>
            <FilterSelect
              label="Player Status"
              onChange={(value) => setStatusFilter(value as PlayerStatusFilter)}
              options={[
                ['all', 'All'],
                ['casual', 'Casual Player'],
                ['league', 'League Player'],
                ['tournament', 'Tournament Player'],
                ['new', 'New Player'],
              ]}
              value={statusFilter}
            />
            <FilterSelect
              label="Division"
              onChange={setDivisionFilter}
              options={[
                ['all', 'All'],
                ...communityDivisions.map((division) => [division, division] as [string, string]),
              ]}
              value={divisionFilter}
            />
            <FilterSelect
              label="Sort"
              onChange={(value) => setSortBy(value as CommunitySort)}
              options={[
                ['recent', 'Recently Active'],
                ['games', 'Lifetime Games'],
                ['winRate', 'Win Rate'],
                ['name', 'Name'],
              ]}
              value={sortBy}
            />
          </section>
        </>
      )}

      <section className="players-grid" aria-label="Portal players">
        {(eventScoped ? filteredPlayers : communityPlayers).map((player) => (
          <PlayerCard
            divisionLabel={player.divisionLabel}
            eventId={eventId}
            key={`${player.division}-${player.player}`}
            player={player}
          />
        ))}
      </section>

      {!eventScoped && communityPlayers.length === 0 ? (
        <section className="dashboard-state" aria-label="No players found">
          <p>No portal players match the current filters.</p>
        </section>
      ) : null}
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="event-overview-status-card neutral">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
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
  options: Array<[string, string]>
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}

function sortCommunityPlayers(
  left: PlayerListItem,
  right: PlayerListItem,
  sortBy: CommunitySort,
) {
  if (sortBy === 'name') {
    return (left.displayName || left.player).localeCompare(right.displayName || right.player)
  }

  if (sortBy === 'games') {
    return right.games - left.games || (left.displayName || left.player).localeCompare(right.displayName || right.player)
  }

  if (sortBy === 'winRate') {
    return getWinRate(right) - getWinRate(left) || right.games - left.games
  }

  return getTime(right.lastActive) - getTime(left.lastActive) || right.games - left.games
}

function getWinRate(player: { games: number; wins: number }) {
  return player.games > 0 ? player.wins / player.games : 0
}

function getTime(value: string | undefined) {
  const timestamp = Date.parse(value ?? '')
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function PageHeader({ eventScoped }: { eventScoped: boolean }) {
  return (
    <section className="page-header" aria-labelledby="players-title">
      <p className="eyebrow">Players</p>
      <h1 id="players-title">Players</h1>
      <p>{eventScoped ? 'Browse event participants' : 'Browse portal players across all games'}</p>
    </section>
  )
}

export default Players
