import { useEffect, useState } from 'react'
import { filterCanonicalMissionRecords } from '../config/missions'
import { apiClient } from '../services/api'
import { getPublicPlayersProjection } from '../services/publicPlayersProjection'
import { publicDetailProjection } from '../services/publicDetailProjection'
import { publicLeagueWorkspace } from '../services/publicLeagueWorkspaceProjection'
import { formatPlayerName } from '../services/formatting'
import { getGameHeadline } from '../services/gameResults'
import PreviousNextNav from './PreviousNextNav'

type EntityType = 'faction' | 'match' | 'mission' | 'player'

type EntityPreviousNextProps = {
  current: number | string
  eventId?: string
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

function EntityPreviousNext({ current, eventId, type }: EntityPreviousNextProps) {
  const [navState, setNavState] = useState<EntityNavState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadEntities() {
      const entities = await getEntities(type, controller.signal, eventId)

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
  }, [eventId, type])

  if (navState.status !== 'success') {
    return null
  }

  const currentValue = String(current)
  const currentIndex = navState.entities.findIndex((entity) =>
    entity.to.split('?')[0].endsWith(`/${encodeURIComponent(currentValue)}`),
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

async function getEntities(type: EntityType, signal: AbortSignal, eventId = '') {
  const eventQuery = eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''

  if (type === 'player') {
    const divisions = eventId ? await apiClient.getPlayers({ eventId, signal }) : await getPublicPlayersProjection({ signal })

    return divisions.flatMap((division) =>
      division.standings.map((player) => ({
        label: formatPlayerName(player.player, player.displayName),
        to: `/players/${encodeURIComponent(player.player)}${eventQuery}`,
      })),
    )
  }

  if (type === 'faction') {
    const factions = eventId ? await apiClient.getFactions({ eventId, signal }) : await publicLeagueWorkspace.getFactions(signal)

    return factions.map((faction) => ({
      label: faction.name,
      to: `/factions/${encodeURIComponent(faction.name)}${eventQuery}`,
    }))
  }

  if (type === 'mission') {
    const missions = eventId ? await apiClient.getMissions({ eventId, signal }) : await publicLeagueWorkspace.getMissions('current-league', signal)

    return filterCanonicalMissionRecords(missions).map((mission) => ({
      label: mission.mission,
      to: `/missions/${encodeURIComponent(mission.mission)}${eventQuery}`,
    }))
  }

  const games = eventId
    ? await apiClient.getRecentGames({ eventId, signal })
    : (await publicDetailProjection.getGames(signal)).games

  return games.map((game) => ({
    label: getGameHeadline(game),
    to: `/games/${game.id}`,
  }))
}

export default EntityPreviousNext
