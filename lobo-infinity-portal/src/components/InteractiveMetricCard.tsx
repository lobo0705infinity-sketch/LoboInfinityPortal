import { type ReactNode } from 'react'

type InteractiveMetricCardProps = {
  ariaLabel?: string
  className: string
  disabled?: boolean
  helperText?: string
  icon?: ReactNode
  label: string
  onActivate?: () => void
  value: ReactNode
}

export default function InteractiveMetricCard({
  ariaLabel,
  className,
  disabled,
  helperText,
  icon,
  label,
  onActivate,
  value,
}: InteractiveMetricCardProps) {
  const content = (
    <>
      {icon}
      <span className="interactive-metric-card-label">{label}</span>
      <strong className="interactive-metric-card-value">{value}</strong>
      {helperText ? <small className="interactive-metric-card-helper">{helperText}</small> : null}
    </>
  )

  if (onActivate) {
    return (
      <button
        aria-label={ariaLabel || label}
        className={`${className} interactive-metric-card interactive-metric-card-action`}
        disabled={disabled}
        onClick={onActivate}
        type="button"
      >
        {content}
      </button>
    )
  }

  return (
    <article className={`${className} interactive-metric-card`}>
      {content}
    </article>
  )
}
