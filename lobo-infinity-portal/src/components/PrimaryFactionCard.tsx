import { type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFactionIcon } from '../assets/operator-badges/factions'
import { resolveArmyIdentity } from '../services/armyIdentity'
import { buildArmyIntelligenceFactionPath } from '../services/armyIntelligenceNavigation'
import './PrimaryFactionCard.css'

type PrimaryFactionCardProps = {
  className?: string
  faction?: string | null
  variant?: 'definition' | 'readonly'
}

const pendingFactionLabel = 'Faction Pending'

function PrimaryFactionCard({
  className = '',
  faction,
  variant = 'definition',
}: PrimaryFactionCardProps) {
  const navigate = useNavigate()
  const identity = resolveArmyIdentity(faction)
  const normalizedFaction = identity?.displayName || ''
  const displayFaction = normalizedFaction || pendingFactionLabel
  const icon = getFactionIcon(identity?.iconKey || normalizedFaction)
  const isInteractive = Boolean(identity)
  const ariaLabel = isInteractive
    ? `View ${displayFaction} Army Intelligence`
    : undefined
  const classes = [
    'primary-faction-card',
    `primary-faction-card--${variant}`,
    className,
    normalizedFaction ? 'has-faction' : 'is-pending',
    isInteractive ? 'interactive-metric-card interactive-metric-card-action is-interactive' : '',
  ].filter(Boolean).join(' ')
  const actionProps = isInteractive
    ? {
        'aria-label': ariaLabel,
        onClick: () => navigate(buildArmyIntelligenceFactionPath(normalizedFaction)),
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return
          }

          event.preventDefault()
          navigate(buildArmyIntelligenceFactionPath(normalizedFaction))
        },
        role: 'link',
        tabIndex: 0,
      }
    : {}

  if (variant === 'readonly') {
    return (
      <div className={classes} {...actionProps}>
        <span>Primary Faction</span>
        <strong>
          <PrimaryFactionValue faction={displayFaction} icon={icon} />
        </strong>
      </div>
    )
  }

  return (
    <div className={classes} {...actionProps}>
      <dt>Primary Faction</dt>
      <dd>
        <PrimaryFactionValue faction={displayFaction} icon={icon} />
      </dd>
    </div>
  )
}

function PrimaryFactionValue({ faction, icon }: { faction: string; icon: string }) {
  return (
    <span className="primary-faction-card-value">
      <img alt="" aria-hidden="true" decoding="async" loading="lazy" src={icon} />
      <span>{faction}</span>
    </span>
  )
}

export default PrimaryFactionCard
