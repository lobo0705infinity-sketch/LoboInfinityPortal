import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Standing } from '../types/dashboard'
import {
  formatDivisionLabel,
  getDivisionIdentity,
  getDivisionStyle,
} from '../utils/divisions'
import { formatPlayerName } from '../services/formatting'
import {
  resolvePlayerFactionPortrait,
  type FactionPortrait,
} from '../config/factionPortraits'

type PlayerCardProps = {
  divisionLabel?: string
  eventId?: string
  player: Standing
}

function PlayerCard({ divisionLabel, eventId, player }: PlayerCardProps) {
  const [showPortrait, setShowPortrait] = useState(true)
  const profilePath = eventId
    ? `/players/${encodeURIComponent(player.player)}?eventId=${encodeURIComponent(eventId)}`
    : `/players/${encodeURIComponent(player.player)}`
  const identity = getDivisionIdentity(divisionLabel)
  const playerName = formatPlayerName(player.player, player.displayName)
  const isCommunityCard = !eventId
  const badges = player.statusBadges ?? []
  const favoriteArmy = player.favoriteArmy || player.faction || 'Not recorded'
  const portrait = resolvePlayerFactionPortrait({
    currentEventArmy: eventId ? player.favoriteArmy : '',
    playerFaction: player.faction,
    preferredArmy: eventId ? '' : player.favoriteArmy,
  })
  const streak = player.currentWinStreak ?? 0
  const divisionBadgeLabel = getPlayerCardHomeLabel({
    badges,
    divisionLabel,
    eventScoped: Boolean(eventId),
  })

  return (
    <Link
      className={`player-card${portrait && showPortrait ? ' has-faction-portrait' : ''}`}
      style={getDivisionStyle(divisionLabel)}
      to={profilePath}
    >
      <div className="player-card-content">
        <div className="player-card-main">
          <div>
            <span className="division-badge player-card-division">
              {divisionBadgeLabel}
            </span>
            <h2>{playerName}</h2>
            {isCommunityCard && badges.length > 0 ? (
              <span className="player-card-badges" aria-label="Player status">
                {badges.map((badge) => (
                  <span className="player-status-badge" key={badge}>
                    {badge}
                  </span>
                ))}
              </span>
            ) : null}
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
          {isCommunityCard ? (
            <>
              <div className="player-card-stat-wide">
                <dt>Army</dt>
                <dd>{favoriteArmy}</dd>
              </div>
              <div>
                <dt>Streak</dt>
                <dd>{streak}</dd>
              </div>
            </>
          ) : null}
        </dl>

        {isCommunityCard && player.games === 0 ? (
          <p className="player-card-empty">No recorded games yet. Say hello!</p>
        ) : null}
      </div>

      {portrait && showPortrait ? (
        <PlayerCardPortrait
          onError={() => setShowPortrait(false)}
          portrait={portrait}
        />
      ) : null}

      <span className="player-card-accent" aria-hidden="true">
        {identity.icon}
      </span>
    </Link>
  )
}

function PlayerCardPortrait({
  onError,
  portrait,
}: {
  onError: () => void
  portrait: FactionPortrait
}) {
  return (
    <span
      className="player-card-portrait"
      aria-label={`${portrait.faction} portrait`}
    >
      <img
        alt={portrait.alt}
        decoding="async"
        loading="lazy"
        onError={onError}
        src={portrait.src}
      />
    </span>
  )
}

function getPlayerCardHomeLabel({
  badges,
  divisionLabel,
  eventScoped,
}: {
  badges: string[]
  divisionLabel?: string
  eventScoped: boolean
}) {
  const formattedDivision = eventScoped
    ? formatDivisionLabel(divisionLabel)
    : divisionLabel && divisionLabel !== 'Player Registry'
      ? divisionLabel
      : ''

  if (formattedDivision) {
    return formattedDivision
  }

  if (badges.includes('Casual Player')) {
    return 'Casual Player'
  }

  if (badges.includes('League Player')) {
    return 'League Player'
  }

  if (badges.includes('Tournament Player')) {
    return 'Tournament Player'
  }

  return 'Casual Player'
}

export default PlayerCard
