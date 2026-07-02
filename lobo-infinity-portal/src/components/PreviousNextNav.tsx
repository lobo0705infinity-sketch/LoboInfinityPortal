import { Link } from 'react-router-dom'

type NavTarget = {
  label: string
  to: string
}

type PreviousNextNavProps = {
  next?: NavTarget | null
  previous?: NavTarget | null
}

function PreviousNextNav({ next, previous }: PreviousNextNavProps) {
  if (!previous && !next) {
    return null
  }

  return (
    <nav className="previous-next-nav" aria-label="Previous and next">
      {previous ? (
        <Link to={previous.to}>
          <span>Previous</span>
          <strong>{previous.label}</strong>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={next.to}>
          <span>Next</span>
          <strong>{next.label}</strong>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}

export default PreviousNextNav
