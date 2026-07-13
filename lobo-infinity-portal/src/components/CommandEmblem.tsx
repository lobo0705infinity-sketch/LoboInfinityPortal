import type { CSSProperties } from 'react'
import type { PlayerClassification } from '../services/playerClassification'
import './CommandEmblem.css'

export type CommandEmblemPlayer = {
  careerSummary?: {
    records?: {
      league?: { games?: number }
      tournament?: { games?: number }
    }
    totalGames?: number
  }
  displayName?: string
  division?: string
  favoriteFaction?: string
  name: string
  rank?: number
}

type CommandEmblemProps = {
  achievementRings?: string[]
  classifications?: PlayerClassification[]
  competitiveHome?: string
  player: CommandEmblemPlayer
  preferredFaction?: string
  rank?: number
  showBadges?: boolean
}

function CommandEmblem({
  achievementRings,
  classifications = [],
  competitiveHome = '',
  player,
  preferredFaction,
  rank,
  showBadges = true,
}: CommandEmblemProps) {
  const playerName = player.displayName || player.name
  const faction = preferredFaction || player.favoriteFaction || 'Neutral Command Core'
  const displayRank = rank ?? player.rank ?? 0
  const home = competitiveHome || player.division || 'Casual Player'
  const rings = achievementRings ?? deriveAchievementRings(player, classifications, displayRank)
  const variant = factionVariant(faction)
  const ariaLabel = [
    playerName,
    `Preferred faction ${faction}`,
    `Competitive home ${home}`,
    displayRank > 0 ? `Rank ${displayRank}` : 'Unranked',
    classifications.length ? `Classifications ${classifications.join(', ')}` : '',
    rings.length ? `Achievement rings ${rings.join(', ')}` : '',
  ].filter(Boolean).join('. ')

  return (
    <figure
      aria-label={ariaLabel}
      className="command-emblem"
      style={{
        '--emblem-accent': variant.accent,
        '--emblem-secondary': variant.secondary,
      } as CSSProperties & Record<'--emblem-accent' | '--emblem-secondary', string>}
    >
      <div className="command-emblem-mark" aria-hidden="true">
        <svg className="command-emblem-svg" viewBox="0 0 256 286" role="img">
          <circle className="command-emblem-ring is-base" cx="128" cy="128" r="101" />
          {rings.map((ring) => (
            <circle
              className={`command-emblem-ring is-${ring}`}
              cx="128"
              cy="128"
              key={ring}
              r={111}
            />
          ))}
          <path
            className="command-emblem-frame"
            d="M128 13 213 47 248 128 213 209 128 243 43 209 8 128 43 47Z"
          />
          <path
            className="command-emblem-frame-inner"
            d="M128 32 196 60 224 128 196 196 128 224 60 196 32 128 60 60Z"
          />
          <path
            className="command-emblem-core"
            d="M128 55 185 79 209 128 185 177 128 201 71 177 47 128 71 79Z"
          />
          <FactionCore variant={variant.id} />
          {rings.includes('league') ? (
            <g className="command-emblem-node is-league">
              <circle cx="26" cy="128" r="18" />
              <path d="M18 123h16v8H18zM21 119h10l-2 4h-6zM22 131h8v8h-8z" fill="currentColor" />
            </g>
          ) : null}
          {rings.includes('tournament') ? (
            <g className="command-emblem-node is-tournament">
              <circle cx="230" cy="128" r="18" />
              <path d="M230 116v24M218 128h24M222 120l16 16M238 120l-16 16" stroke="currentColor" strokeWidth="3" />
            </g>
          ) : null}
          <g className="command-emblem-node is-rank">
            <path d="M98 226h60l14 18-14 18H98l-14-18Z" />
            <text className="command-emblem-rank-text" x="128" y="249">
              {displayRank > 0 ? `#${displayRank}` : '--'}
            </text>
          </g>
          <path d="M48 248h160l16 18-16 18H48l-16-18Z" fill="rgba(5,6,8,.92)" stroke="rgba(76,201,240,.45)" strokeWidth="2" />
          <text className="command-emblem-name-text" x="128" y="269">
            {truncateLabel(playerName, 13)}
          </text>
          <text className="command-emblem-faction-text" x="128" y="280">
            {truncateLabel(faction, 24)}
          </text>
        </svg>
      </div>
      <figcaption className="command-emblem-home">{home}</figcaption>
      {showBadges && classifications.length > 0 ? (
        <div className="command-emblem-badges" aria-hidden="true">
          {classifications.map((classification) => (
            <span className="player-status-badge command-emblem-badge" key={classification}>
              <i />
              {classification}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  )
}

function FactionCore({ variant }: { variant: string }) {
  if (variant === 'hassassin') {
    return (
      <g>
        <path className="command-emblem-core-line" d="M128 72 166 167 128 139 90 167Z" />
        <path className="command-emblem-core-fill" d="M128 86 146 146 128 132 110 146Z" />
      </g>
    )
  }

  if (variant === 'nomads') {
    return (
      <g>
        <path className="command-emblem-core-line" d="M82 154 119 82 174 119 136 176Z" />
        <path className="command-emblem-core-fill" d="M109 149 128 107 153 126 135 158Z" />
      </g>
    )
  }

  if (variant === 'morats') {
    return (
      <g>
        <path className="command-emblem-core-line" d="M80 150 101 88 128 74 155 88 176 150 146 178H110Z" />
        <path className="command-emblem-core-fill" d="M104 140 117 108h22l13 32-24 20Z" />
      </g>
    )
  }

  if (variant === 'combined') {
    return (
      <g>
        <path className="command-emblem-core-line" d="M128 82c34 6 52 27 52 46s-18 40-52 46c-34-6-52-27-52-46s18-40 52-46Z" />
        <circle className="command-emblem-core-fill" cx="128" cy="128" r="22" />
      </g>
    )
  }

  if (variant === 'pano') {
    return (
      <g>
        <path className="command-emblem-core-line" d="M128 76 174 101 164 165 128 184 92 165 82 101Z" />
        <path className="command-emblem-core-fill" d="M128 98 151 112 146 153 128 164 110 153 105 112Z" />
      </g>
    )
  }

  return (
    <g>
      <path className="command-emblem-core-line" d="M128 70 184 174 128 144 72 174Z" />
      <circle className="command-emblem-core-fill" cx="128" cy="128" r="12" />
    </g>
  )
}

function deriveAchievementRings(
  player: CommandEmblemPlayer,
  classifications: PlayerClassification[],
  rank: number,
) {
  const rings = new Set<string>()
  const officialGames =
    (player.careerSummary?.records?.league?.games ?? 0) +
    (player.careerSummary?.records?.tournament?.games ?? 0)

  if (classifications.includes('League Player')) {
    rings.add('league')
  }

  if (classifications.includes('Tournament Player')) {
    rings.add('tournament')
  }

  if (classifications.includes('Veteran') || officialGames >= 50) {
    rings.add('veteran')
  }

  if (classifications.includes('Commissioner')) {
    rings.add('commissioner')
  }

  if (rank > 0 && rank <= 3) {
    rings.add('rank')
  }

  return Array.from(rings)
}

function factionVariant(faction: string) {
  const normalized = faction.toLowerCase()

  if (normalized.includes('hassassin') || normalized.includes('haqqislam')) {
    return { accent: '#b2122a', id: 'hassassin', secondary: '#f2b632' }
  }

  if (normalized.includes('nomad')) {
    return { accent: '#e3343f', id: 'nomads', secondary: '#4cc9f0' }
  }

  if (normalized.includes('morat')) {
    return { accent: '#f26a21', id: 'morats', secondary: '#f2b632' }
  }

  if (normalized.includes('combined')) {
    return { accent: '#9b5cff', id: 'combined', secondary: '#b2122a' }
  }

  if (normalized.includes('pan') || normalized.includes('pano')) {
    return { accent: '#4d8dff', id: 'pano', secondary: '#f4f6f8' }
  }

  return { accent: '#4cc9f0', id: 'operations', secondary: '#f2b632' }
}

function truncateLabel(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}.` : value
}

export default CommandEmblem
