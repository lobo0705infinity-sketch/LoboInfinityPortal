import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { getFactionIcon } from '../assets/operator-badges/factions'
import type { PlayerClassification } from '../services/playerClassification'
import {
  formatRingLabel,
  getEarnedRings,
  getOperatorBadgeDetails,
  getOperatorBadgeRows,
  type OperatorBadgeAchievement,
  type OperatorBadgeDetail,
  type OperatorBadgePlayer,
} from './operatorBadgeDetails'
import './OperatorBadge.css'

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
  const coreGradientId = `operator-core-${useId().replace(/:/g, '')}`
  const [modalOpen, setModalOpen] = useState(false)
  const playerName = player.displayName || player.name
  const selectedFaction = normalizePreferredFactionLabel(preferredFaction || player.favoriteFaction || '')
  const details = getOperatorBadgeDetails({
    achievements,
    classifications,
    competitiveHome,
    player,
    preferredFaction,
    rank,
  })
  const faction = details.faction
  const factionIcon = getFactionIcon(selectedFaction)
  const displayRank = rank ?? player.rank ?? 0
  const home = details.competitiveHome
  const rings = getEarnedRings(details.rings)
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
      onClick={() => setModalOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setModalOpen(true)
        }
      }}
      role="button"
      style={{
        '--operator-accent': '#4cc9f0',
        '--operator-secondary': '#f2b632',
      } as CSSProperties & Record<'--operator-accent' | '--operator-secondary', string>}
      tabIndex={0}
    >
      <div className="operator-badge-mark" aria-hidden="true">
        <svg className="operator-badge-svg" viewBox="0 0 320 360" role="img">
          <defs>
            <linearGradient id={coreGradientId} x1="0%" x2="100%" y1="0%" y2="100%">
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
            fill={`url(#${coreGradientId})`}
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

          <FactionCore icon={factionIcon} />
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
            <path className="operator-badge-rank-shadow" d="M117 270h86l20 20-20 24h-86l-20-24Z" />
            <path className="operator-badge-rank-face" d="M120 268h80l17 22-17 22h-80l-17-22Z" />
            <path className="operator-badge-rank-cut" d="M114 290h92" />
            <text x="160" y="299">{displayRank > 0 ? `#${displayRank}` : '--'}</text>
          </g>
          <g className="operator-badge-plate">
            <path className="operator-badge-plate-shadow" d="M58 309h204l22 21-22 27H58l-22-27Z" />
            <path className="operator-badge-plate-face" d="M63 306h194l21 24-21 24H63l-21-24Z" />
            <path className="operator-badge-plate-trim" d="M78 316h164M78 344h164" />
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
      <OperatorBadgeTooltip details={details} />
      {modalOpen ? (
        <div
          aria-modal="true"
          className="operator-badge-modal"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="operator-badge-modal-card">
            <button
              aria-label="Close Operator Badge details"
              onClick={() => setModalOpen(false)}
              type="button"
            >
              Close
            </button>
            <OperatorBadgeTooltip details={details} modal />
          </div>
        </div>
      ) : null}
    </figure>
  )
}

function OperatorBadgeTooltip({
  details,
  modal = false,
}: {
  details: OperatorBadgeDetail
  modal?: boolean
}) {
  const rows = getOperatorBadgeRows(details)

  return (
    <div className={modal ? 'operator-badge-tooltip is-modal' : 'operator-badge-tooltip'} role="tooltip">
      <strong>Operator Badge</strong>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
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
  if (!active) {
    return null
  }

  return (
    <g className={`operator-badge-module is-${tone} is-active`} transform={`translate(${x - 24} ${y - 24})`}>
      <path d="M24 2 44 13v22L24 46 4 35V13Z" />
      <g transform="translate(0 0)">{children}</g>
    </g>
  )
}

function FactionCore({ icon }: { icon: string }) {
  return (
    <g className="operator-badge-faction-mark">
      <image
        height="106"
        href={icon}
        preserveAspectRatio="xMidYMid meet"
        width="106"
        x="107"
        y="107"
      />
    </g>
  )
}
function truncateLabel(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}.` : value
}

function normalizePreferredFactionLabel(value: string) {
  return value.trim().replace(/\s*\(\d+\s+games?\)$/i, '')
}

export default OperatorBadge
