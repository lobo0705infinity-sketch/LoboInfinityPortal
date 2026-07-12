import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PlayerCard from '../components/PlayerCard'
import Skeleton from '../components/Skeleton'
import { apiClient } from '../services/api'
import type { DivisionKey, DivisionStandings } from '../types/dashboard'
import {
  getDivisionIdentity,
  getDivisionStyle,
} from '../utils/divisions'

type PlayerFilter = 'all' | DivisionKey

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
  const [activeFilter, setActiveFilter] = useState<PlayerFilter>('all')
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
        division: division.division,
        divisionLabel: division.divisionLabel,
      })),
    )
  }, [playersState])

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

  if (playersState.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader eventScoped={Boolean(eventId)} />
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
        <PageHeader eventScoped={Boolean(eventId)} />
        <section className="dashboard-state" aria-label="Players error">
          <p role="alert">{playersState.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader eventScoped={Boolean(eventId)} />

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

      <section className="players-grid" aria-label="Portal players">
        {filteredPlayers.map((player) => (
          <PlayerCard
            divisionLabel={player.divisionLabel}
            eventId={eventId}
            key={`${player.division}-${player.player}`}
            player={player}
          />
        ))}
      </section>
    </main>
  )
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
