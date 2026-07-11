import { Link } from 'react-router-dom'
import type { Standing } from '../types/dashboard'
import {
  formatDivisionLabel,
  getDivisionIdentity,
  getDivisionStyle,
} from '../utils/divisions'
import { formatPlayerName } from '../services/formatting'

type PlayerCardProps = {
  divisionLabel?: string
  eventId?: string
  player: Standing
}

function PlayerCard({ divisionLabel, eventId, player }: PlayerCardProps) {
  const profilePath = eventId
    ? `/players/${encodeURIComponent(player.player)}?eventId=${encodeURIComponent(eventId)}`
    : `/players/${encodeURIComponent(player.player)}`
  const identity = getDivisionIdentity(divisionLabel)
  const playerName = formatPlayerName(player.player, player.displayName)

  return (
    <Link
      className="player-card"
      style={getDivisionStyle(divisionLabel)}
      to={profilePath}
    >
      <div className="player-card-main">
        <div>
          <span className="division-badge player-card-division">
            {formatDivisionLabel(divisionLabel)}
          </span>
          <h2>{playerName}</h2>
        </div>
        <span className="player-card-chevron" aria-hidden="true">
          &gt;
        </span>
      </div>

      <div className="player-card-record">
        <span>{player.games} Games</span>
        <strong>
          {player.wins}-{player.losses}
        </strong>
      </div>

      <dl className="player-card-stats">
        <div>
          <dt>TP</dt>
          <dd>{player.tp}</dd>
        </div>
        <div>
          <dt>OP</dt>
          <dd>{player.op}</dd>
        </div>
        <div>
          <dt>VP</dt>
          <dd>{player.vp}</dd>
        </div>
      </dl>

      <span className="player-card-accent" aria-hidden="true">
        {identity.icon}
      </span>
    </Link>
  )
}

export default PlayerCard
