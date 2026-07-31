import { getFactionIcon } from '../assets/operator-badges/factions'
import './PrimaryFactionCard.css'

type PrimaryFactionCardProps = {
  className?: string
  faction?: string | null
  variant?: 'definition' | 'readonly'
}

const pendingFactionLabel = 'Faction Pending.'

function PrimaryFactionCard({
  className = '',
  faction,
  variant = 'definition',
}: PrimaryFactionCardProps) {
  const normalizedFaction = String(faction ?? '').trim()
  const displayFaction = normalizedFaction || pendingFactionLabel
  const icon = getFactionIcon(normalizedFaction)
  const classes = [
    'primary-faction-card',
    `primary-faction-card--${variant}`,
    className,
    normalizedFaction ? 'has-faction' : 'is-pending',
  ].filter(Boolean).join(' ')

  if (variant === 'readonly') {
    return (
      <div className={classes}>
        <span>Primary Faction</span>
        <strong>
          <PrimaryFactionValue faction={displayFaction} icon={icon} />
        </strong>
      </div>
    )
  }

  return (
    <div className={classes}>
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
