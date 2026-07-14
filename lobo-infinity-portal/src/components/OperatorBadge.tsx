import type { CSSProperties, ReactNode } from 'react'
import type { PlayerClassification } from '../services/playerClassification'
import './OperatorBadge.css'

export type OperatorBadgeAchievement = {
  title: string
  unlocked?: boolean
}

export type OperatorBadgePlayer = {
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

type OperatorBadgeProps = {
  achievements?: OperatorBadgeAchievement[]
  classifications?: PlayerClassification[]
  competitiveHome?: string
  player: OperatorBadgePlayer
  preferredFaction?: string
  rank?: number
  showBadges?: boolean
}

function OperatorBadge({
  achievements = [],
  classifications = [],
  competitiveHome = '',
  player,
  preferredFaction,
  rank,
  showBadges = true,
}: OperatorBadgeProps) {
  const playerName = player.displayName || player.name
  const faction = preferredFaction || player.favoriteFaction || 'Neutral Operator Badge'
  const displayRank = rank ?? player.rank ?? 0
  const home = normalizeCompetitiveHome(competitiveHome || player.division || '', classifications)
  const rings = deriveAchievementRings(player, classifications, achievements)
  const variant = factionVariant(faction)
  const ariaLabel = [
    playerName,
    `Preferred faction ${faction}`,
    `Competitive home ${home}`,
    displayRank > 0 ? `Rank ${displayRank}` : 'Unranked',
    classifications.length ? `Classification ${classifications.join(', ')}` : '',
    rings.length ? `Achievement rings ${rings.map(formatRingLabel).join(', ')}` : '',
  ].filter(Boolean).join('. ')

  return (
    <figure
      aria-label={ariaLabel}
      className="operator-badge"
      style={{
        '--operator-accent': variant.accent,
        '--operator-secondary': variant.secondary,
      } as CSSProperties & Record<'--operator-accent' | '--operator-secondary', string>}
    >
      <div className="operator-badge-mark" aria-hidden="true">
        <svg className="operator-badge-svg" viewBox="0 0 320 360" role="img">
          <defs>
            <linearGradient id={`operator-metal-${variant.id}`} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#6f7c86" />
              <stop offset="48%" stopColor="#121a24" />
              <stop offset="100%" stopColor="#050608" />
            </linearGradient>
            <linearGradient id={`operator-core-${variant.id}`} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="var(--operator-accent)" stopOpacity="0.36" />
              <stop offset="55%" stopColor="#050608" stopOpacity="0.94" />
              <stop offset="100%" stopColor="var(--operator-secondary)" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          <path
            className="operator-badge-outer"
            d="M160 22 257 62 298 160 257 258 160 298 63 258 22 160 63 62Z"
          />
          <path
            className="operator-badge-armature"
            d="M160 42 239 75 272 160 239 245 160 278 81 245 48 160 81 75Z"
          />
          <path
            className="operator-badge-core"
            d="M160 66 221 92 246 160 221 228 160 254 99 228 74 160 99 92Z"
            fill={`url(#operator-core-${variant.id})`}
          />
          <path
            className="operator-badge-inner"
            d="M160 84 204 103 222 160 204 217 160 236 116 217 98 160 116 103Z"
          />

          <AchievementArc ring="league-champion" rings={rings} />
          <AchievementArc ring="tournament-champion" rings={rings} />
          <AchievementArc ring="veteran" rings={rings} />
          <AchievementArc ring="hall-of-fame" rings={rings} />
          <AchievementArc ring="commissioner" rings={rings} />

          <FactionCore variant={variant.id} />
          <AchievementModule x={112} y={34} active={rings.includes('league-champion')} tone="league">
            <path d="M12 9h24v10c0 10-5 17-12 21-7-4-12-11-12-21Z" />
            <path d="M18 20h12M24 14v18" />
          </AchievementModule>
          <AchievementModule x={160} y={22} active={rings.includes('hall-of-fame')} tone="command">
            <path d="M10 32 16 13l11 13 11-13 6 19Z" />
            <path d="M12 36h32" />
          </AchievementModule>
          <AchievementModule x={208} y={34} active={rings.includes('tournament-champion')} tone="tournament">
            <path d="M24 9v31M9 24h31M14 14l20 20M34 14 14 34" />
          </AchievementModule>
          <AchievementModule x={55} y={162} active={rings.includes('veteran')} tone="league">
            <path d="M24 9 37 33H11Z" />
            <path d="M24 17v13" />
          </AchievementModule>
          <AchievementModule x={265} y={162} active={rings.includes('commissioner')} tone="tournament">
            <path d="M13 16h22l-4 22H17Z" />
            <path d="M18 11h12M20 22h8M19 29h10" />
          </AchievementModule>

          <g className="operator-badge-rank">
            <path d="M119 268h82l18 22-18 22h-82l-18-22Z" />
            <text x="160" y="299">{displayRank > 0 ? `#${displayRank}` : '--'}</text>
          </g>
          <g className="operator-badge-plate">
            <path d="M63 306h194l21 24-21 24H63l-21-24Z" />
            <text className="operator-badge-name" x="160" y="335">
              {truncateLabel(playerName, 13)}
            </text>
            <text className="operator-badge-faction" x="160" y="349">
              {truncateLabel(faction, 24)}
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="operator-badge-home">{home}</figcaption>
      {showBadges && classifications.length > 0 ? (
        <div className="operator-badge-classifications" aria-hidden="true">
          {classifications.map((classification) => (
            <span className="player-status-badge operator-badge-classification" key={classification}>
              <i />
              {classification}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  )
}

function AchievementArc({
  ring,
  rings,
}: {
  ring: string
  rings: string[]
}) {
  return rings.includes(ring) ? (
    <circle className={`operator-badge-ring is-${ring}`} cx="160" cy="160" r="128" />
  ) : null
}

function AchievementModule({
  active,
  children,
  tone,
  x,
  y,
}: {
  active: boolean
  children: ReactNode
  tone: 'command' | 'league' | 'tournament'
  x: number
  y: number
}) {
  return (
    <g className={`operator-badge-module is-${tone}${active ? ' is-active' : ''}`} transform={`translate(${x - 24} ${y - 24})`}>
      <path d="M24 2 44 13v22L24 46 4 35V13Z" />
      <g transform="translate(0 0)">{children}</g>
    </g>
  )
}

function FactionCore({ variant }: { variant: string }) {
  if (variant === 'hassassin') {
    return (
      <g className="operator-badge-faction-mark">
        <path d="M160 92 207 220 160 183 113 220Z" />
        <path d="M160 118 181 187 160 170 139 187Z" />
      </g>
    )
  }

  if (variant === 'nomads') {
    return (
      <g className="operator-badge-faction-mark">
        <path d="M105 194 150 98 218 143 172 222Z" />
        <path d="M139 186 160 132 190 151 169 197Z" />
      </g>
    )
  }

  if (variant === 'morats') {
    return (
      <g className="operator-badge-faction-mark">
        <path d="M101 186 126 108 160 91 194 108 219 186 181 225H139Z" />
        <path d="M129 176 145 135h30l16 41-31 27Z" />
      </g>
    )
  }

  if (variant === 'combined') {
    return (
      <g className="operator-badge-faction-mark">
        <path d="M160 104c42 7 65 32 65 56s-23 49-65 56c-42-7-65-32-65-56s23-49 65-56Z" />
        <circle cx="160" cy="160" r="28" />
      </g>
    )
  }

  if (variant === 'pano') {
    return (
      <g className="operator-badge-faction-mark">
        <path d="M160 96 216 128 204 205 160 228 116 205 104 128Z" />
        <path d="M160 122 188 139 182 188 160 201 138 188 132 139Z" />
      </g>
    )
  }

  return (
    <g className="operator-badge-faction-mark">
      <path d="M160 86 227 222 160 183 93 222Z" />
      <circle cx="160" cy="160" r="15" />
      <path d="M160 183 160 222" />
    </g>
  )
}

function deriveAchievementRings(
  player: OperatorBadgePlayer,
  classifications: PlayerClassification[],
  achievements: OperatorBadgeAchievement[],
) {
  const rings = new Set<string>()
  const officialGames =
    (player.careerSummary?.records?.league?.games ?? 0) +
    (player.careerSummary?.records?.tournament?.games ?? 0)
  const unlockedAchievements = achievements
    .filter((achievement) => achievement.unlocked !== false)
    .map((achievement) => achievement.title.toLowerCase())

  if (unlockedAchievements.some((title) => title.includes('league champion'))) {
    rings.add('league-champion')
  }

  if (unlockedAchievements.some((title) => title.includes('tournament champion'))) {
    rings.add('tournament-champion')
  }

  if (
    unlockedAchievements.some((title) => title.includes('hall of fame')) ||
    unlockedAchievements.some((title) => title.includes('legend'))
  ) {
    rings.add('hall-of-fame')
  }

  if (
    classifications.includes('Veteran') ||
    officialGames >= 50 ||
    unlockedAchievements.some((title) => title.includes('veteran'))
  ) {
    rings.add('veteran')
  }

  if (
    classifications.includes('Commissioner') ||
    unlockedAchievements.some((title) => title.includes('commissioner'))
  ) {
    rings.add('commissioner')
  }

  return Array.from(rings)
}

function normalizeCompetitiveHome(
  value: string,
  classifications: PlayerClassification[],
) {
  const normalized = value.trim().toLowerCase()

  if (normalized.includes('main man')) {
    return 'Main Man'
  }

  if (normalized.includes('proving grounds a')) {
    return 'Proving Grounds A'
  }

  if (normalized.includes('proving grounds b')) {
    return 'Proving Grounds B'
  }

  if (classifications.includes('Casual Player') || !normalized) {
    return 'Casual Player'
  }

  return 'Casual Player'
}

function factionVariant(faction: string) {
  const normalized = faction.toLowerCase()

  if (normalized.includes('hassassin') || normalized.includes('haqqislam') || normalized.includes('ramah')) {
    return { accent: '#b2122a', id: 'hassassin', secondary: '#f2b632' }
  }

  if (
    normalized.includes('nomad') ||
    normalized.includes('bakunin') ||
    normalized.includes('corregidor') ||
    normalized.includes('tunguska')
  ) {
    return { accent: '#e3343f', id: 'nomads', secondary: '#4cc9f0' }
  }

  if (normalized.includes('morat')) {
    return { accent: '#f26a21', id: 'morats', secondary: '#f2b632' }
  }

  if (normalized.includes('combined')) {
    return { accent: '#9b5cff', id: 'combined', secondary: '#b2122a' }
  }

  if (normalized.includes('pan') || normalized.includes('pano') || normalized.includes('winterfor')) {
    return { accent: '#4d8dff', id: 'pano', secondary: '#f4f6f8' }
  }

  return { accent: '#4cc9f0', id: 'operations', secondary: '#f2b632' }
}

function formatRingLabel(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function truncateLabel(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}.` : value
}

export default OperatorBadge
