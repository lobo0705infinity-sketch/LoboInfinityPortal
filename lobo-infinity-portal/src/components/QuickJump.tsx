import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'

type JumpItem = {
  label: string
  to: string
}

function QuickJump() {
  const navigate = useNavigate()
  const [items, setItems] = useState<JumpItem[]>([])

  useEffect(() => {
    const controller = new AbortController()

    async function loadJumpItems() {
      const [players, factions, missions, games] = await Promise.allSettled([
        apiClient.getPlayers({ signal: controller.signal }),
        apiClient.getFactions({ signal: controller.signal }),
        apiClient.getMissions({ signal: controller.signal }),
        apiClient.getRecentGames({ signal: controller.signal }),
      ])

      if (controller.signal.aborted) {
        return
      }

      const playerItems =
        players.status === 'fulfilled'
          ? players.value.flatMap((division) =>
              division.standings.slice(0, 4).map((player) => ({
                label: `Player: ${player.player}`,
                to: `/players/${encodeURIComponent(player.player)}`,
              })),
            )
          : []

      const factionItems =
        factions.status === 'fulfilled'
          ? factions.value.slice(0, 4).map((faction) => ({
              label: `Faction: ${faction.name}`,
              to: `/factions/${encodeURIComponent(faction.name)}`,
            }))
          : []

      const missionItems =
        missions.status === 'fulfilled'
          ? missions.value.slice(0, 4).map((mission) => ({
              label: `Mission: ${mission.mission}`,
              to: `/missions/${encodeURIComponent(mission.mission)}`,
            }))
          : []

      const gameItems =
        games.status === 'fulfilled'
          ? games.value.slice(0, 3).map((game) => ({
              label: `Match: ${game.winner} vs ${game.loser}`,
              to: `/games/${game.id}`,
            }))
          : []

      setItems([
        { label: 'Dashboard', to: '/' },
        { label: 'Timeline', to: '/timeline' },
        { label: 'Notifications', to: '/notifications' },
        { label: 'League Intelligence', to: '/analytics' },
        ...playerItems,
        ...factionItems,
        ...missionItems,
        ...gameItems,
      ])
    }

    void loadJumpItems()

    return () => {
      controller.abort()
    }
  }, [])

  return (
    <label className="quick-jump">
      <span>Jump</span>
      <select
        aria-label="Quick jump menu"
        defaultValue=""
        onChange={(event) => {
          const nextPath = event.target.value

          if (nextPath) {
            navigate(nextPath)
            event.target.value = ''
          }
        }}
      >
        <option value="">Quick jump</option>
        {items.map((item) => (
          <option key={`${item.label}-${item.to}`} value={item.to}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default QuickJump
