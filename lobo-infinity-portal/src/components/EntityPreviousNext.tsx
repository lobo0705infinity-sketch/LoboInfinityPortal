import { useEffect, useState } from 'react'
import { apiClient } from '../services/api'
import PreviousNextNav from './PreviousNextNav'

type EntityType = 'faction' | 'match' | 'mission' | 'player'

type EntityPreviousNextProps = {
  current: number | string
  type: EntityType
}

type NavEntity = {
  label: string
  to: string
}

type EntityNavState =
  | {
      status: 'idle'
    }
  | {
      entities: NavEntity[]
      status: 'success'
    }

function EntityPreviousNext({ current, type }: EntityPreviousNextProps) {
  const [navState, setNavState] = useState<EntityNavState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadEntities() {
      const entities = await getEntities(type, controller.signal)

      if (!controller.signal.aborted) {
        setNavState({
          entities,
          status: 'success',
        })
      }
    }

    void loadEntities().catch(() => {
      if (!controller.signal.aborted) {
        setNavState({
          entities: [],
          status: 'success',
        })
      }
    })

    return () => {
      controller.abort()
    }
  }, [type])

  if (navState.status !== 'success') {
    return null
  }

  const currentValue = String(current)
  const currentIndex = navState.entities.findIndex((entity) =>
    entity.to.endsWith(`/${encodeURIComponent(currentValue)}`),
  )

  if (currentIndex < 0) {
    return null
  }

  return (
    <PreviousNextNav
      next={navState.entities[currentIndex + 1] ?? null}
      previous={navState.entities[currentIndex - 1] ?? null}
    />
  )
}

async function getEntities(type: EntityType, signal: AbortSignal) {
  if (type === 'player') {
    const divisions = await apiClient.getPlayers({ signal })

    return divisions.flatMap((division) =>
      division.standings.map((player) => ({
        label: player.player,
        to: `/players/${encodeURIComponent(player.player)}`,
      })),
    )
  }

  if (type === 'faction') {
    const factions = await apiClient.getFactions({ signal })

    return factions.map((faction) => ({
      label: faction.name,
      to: `/factions/${encodeURIComponent(faction.name)}`,
    }))
  }

  if (type === 'mission') {
    const missions = await apiClient.getMissions({ signal })

    return missions.map((mission) => ({
      label: mission.mission,
      to: `/missions/${encodeURIComponent(mission.mission)}`,
    }))
  }

  const games = await apiClient.getRecentGames({ signal })

  return games.map((game) => ({
    label: `${game.winner} defeated ${game.loser}`,
    to: `/games/${game.id}`,
  }))
}

export default EntityPreviousNext
