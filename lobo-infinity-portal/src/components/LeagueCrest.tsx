import crest from '../assets/lobo-crest.svg'
import mark from '../assets/lobo-mark.svg'

function LeagueCrest({
  compact = false,
  label = 'Lobo Infinity League',
}: {
  compact?: boolean
  label?: string
}) {
  return (
    <img
      alt={label}
      className={compact ? 'league-crest compact' : 'league-crest'}
      src={compact ? mark : crest}
    />
  )
}

export default LeagueCrest
