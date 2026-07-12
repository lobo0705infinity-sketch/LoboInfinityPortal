import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatPlayerName } from '../services/formatting'
import { getSearchIndex } from '../services/lightApi'
import { preloadRoute } from '../services/routePreload'

type JumpItem = {
  label: string
  to: string
}

function QuickJump() {
  const navigate = useNavigate()
  const [items, setItems] = useState<JumpItem[]>([])
  const [hasRequestedItems, setHasRequestedItems] = useState(false)

  useEffect(() => {
    if (!hasRequestedItems) {
      return
    }

    const controller = new AbortController()

    async function loadJumpItems() {
      const searchIndex = await getSearchIndex({
        signal: controller.signal,
      })

      if (controller.signal.aborted) {
        return
      }

      const playerItems = searchIndex.players.flatMap((division) =>
        division.standings.slice(0, 4).map((player) => ({
          label: `Player: ${formatPlayerName(player.player, player.displayName)}`,
          to: `/players/${encodeURIComponent(player.player)}`,
        })),
      )

      const factionItems = searchIndex.factions.slice(0, 4).map((faction) => ({
        label: `Faction: ${faction.name}`,
        to: `/factions/${encodeURIComponent(faction.name)}`,
      }))

      const missionItems = searchIndex.missions.slice(0, 4).map((mission) => ({
        label: `Mission: ${mission.mission}`,
        to: `/missions/${encodeURIComponent(mission.mission)}`,
      }))

      const gameItems = searchIndex.games.slice(0, 3).map((game) => ({
        label: `Match: ${formatPlayerName(game.winner, game.winnerDisplayName)} vs ${formatPlayerName(game.loser, game.loserDisplayName)}`,
        to: `/games/${game.id}`,
      }))

      setItems([
        { label: 'Dashboard', to: '/' },
        { label: 'Submit Game', to: '/submit-game' },
        { label: 'July 2026 League', to: '/event/event-current-league' },
        { label: 'League Submit Game', to: '/submit-game?eventId=event-current-league&gameType=event' },
        { label: 'League Registration', to: '/event/event-current-league/registration' },
        { label: 'Team Tournament Submit Game', to: '/submit-game?eventId=event-august-2026-team-tournament&gameType=event' },
        { label: 'Casual Submit Game', to: '/submit-game?gameType=casual' },
        { label: 'Schedule', to: '/schedule?eventId=event-current-league' },
        { label: 'Past Events', to: '/events' },
        { label: 'Community Timeline', to: '/timeline' },
        { label: 'Notifications', to: '/notifications' },
        { label: 'League Intelligence', to: '/intelligence' },
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
  }, [hasRequestedItems])

  return (
    <label className="quick-jump">
      <span>Jump</span>
      <select
        aria-label="Quick jump menu"
        defaultValue=""
        onFocus={() => setHasRequestedItems(true)}
        onChange={(event) => {
          setHasRequestedItems(true)
          const nextPath = event.target.value

          if (nextPath) {
            preloadRoute(nextPath)
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
