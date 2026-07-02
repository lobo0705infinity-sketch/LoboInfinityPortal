import { useEffect, useMemo, useState } from 'react'
import Loading from '../components/Loading'
import PlayerCard from '../components/PlayerCard'
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
  const [activeFilter, setActiveFilter] = useState<PlayerFilter>('all')
  const [playersState, setPlayersState] = useState<PlayersState>({
    status: 'loading',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getPlayers({
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
  }, [])

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
        <PageHeader />
        <section className="dashboard-state" aria-label="Players loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (playersState.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Players error">
          <p role="alert">{playersState.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />

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

      <section className="players-grid" aria-label="League competitors">
        {filteredPlayers.map((player) => (
          <PlayerCard
            divisionLabel={player.divisionLabel}
            key={`${player.division}-${player.player}`}
            player={player}
          />
        ))}
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="players-title">
      <p className="eyebrow">Players</p>
      <h1 id="players-title">Players</h1>
      <p>Browse league competitors</p>
    </section>
  )
}

export default Players
